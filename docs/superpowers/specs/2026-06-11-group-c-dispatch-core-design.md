# Group C (C0+C2) — 배차 코어 + 엑셀 배차형 배송 Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement the plan derived from this spec.

**Goal:** 실제 운영 full-stack 배차(dispatch) 도메인을 신규 구축한다. 차량(bike)에 종속된 **주문 큐**를 두고, 엑셀로 배차형 배송 주문을 벌크 적재(담당 차량번호 명시)하며, 운영자가 콘솔에서 큐를 확인·완료 처리한다. 현재 배차 정보는 지도/차량 상세에 실데이터로 반영된다.

**Architecture:** 새 `dispatch` 도메인(Spring Boot full-stack)을 기존 클리닝 `BikeNextCustomer`·프론트 시뮬레이션과 **독립**으로 만든다. 프론트는 기존 지도(MapShell)·차량 상세 다이얼로그·엑셀 벌크(Group B BulkRowStatus/Summary/미리보기) 인프라를 재사용한다.

**Tech Stack:** Spring Boot (Java 21), Flyway, JPA `Repository<T,UUID>`, Apache POI, NCP Geocoding, Next.js App Router, NCP Maps SDK, TypeScript.

---

## 1. 범위

### 이번 스펙 (C0 + C2)
- **C0 — 배차 코어:** DispatchOrder 도메인(엔티티+API), 차량당 주문 큐(여러 건, 순서 처리), 배정→완료 상태, 지도/차량상세 반영.
- **C2 — 엑셀 배차형 배송:** 엑셀 벌크 적재(각 행에 담당 차량번호 명시), diff 미리보기, 저장.

### 범위 외 (후속 사이클)
- C1 배민 배송: 웹 단일 콜 입력, 라이더 수락, 시스템 자동 배정
- C3 클리닝: 배차 + 시동(출발) 알림 — 기존 next-customer/ignition와의 통합
- C4 유모차 클리닝: 전체 수거 → 전체 배송 2단계 배치
- 실제 차량 이동/경로 계산, 픽업 지점(2지점), 라이더 앱 연동

---

## 2. 핵심 동작 결정 (확정)

| 항목 | 결정 |
|---|---|
| 성격 | 실제 운영 full-stack (백엔드 엔티티 + API, 실제 배정/상태 관리) |
| 배정 방식 | 엑셀 각 행에 **담당 차량번호 명시** → 업로드 시 그대로 배정 (Group B upsert 패턴) |
| 주문 구조 | **단일 목적지형** — 차량번호 + 고객명 + 연락처 + 배송지(주소→좌표) |
| 차량당 배차 | **여러 건 큐(목록)**, 순서대로 처리 |
| 상태/완료 | **배정(ASSIGNED) → 완료(COMPLETED)**, 운영자가 콘솔에서 '완료' 클릭 → 큐의 다음 건이 현재 배차가 됨 |
| 도메인 구조 | **새 DispatchOrder 도메인(독립)**, 기존 클리닝 next-customer는 건드리지 않음 |
| 마커 배지 N | 지도 마커 "배송 중 · N건"의 N을 **실제 ASSIGNED 큐 잔여 수**로 연결 |
| 지오코딩 실패 행 | **ERROR(빨강)로 표시 + 저장 제외** — 운영자가 주소 수정 후 재업로드 |

---

## 3. 백엔드 (service-ops-api)

### 3.1 도메인: `com.thundercrew.opsapi.dispatch`
- **Flyway `V33__create_dispatch_orders_table.sql`** — 기존 마이그레이션 컨벤션(battery_stations 등) 준수:
  - `id uuid pk`, `idx bigserial unique`
  - `bike_id uuid not null` (배정 차량; FK 또는 논리 참조 — 기존 도메인 컨벤션 따름)
  - `customer_name text not null`, `customer_phone text not null`
  - `address text not null`, `latitude double precision not null`, `longitude double precision not null`
  - `sequence bigint not null` (차량 큐 내 순서)
  - `status varchar(20) not null` (ASSIGNED, COMPLETED) + check 제약
  - `completed_at timestamptz`
  - 표준 audit/soft-delete: `created_at/by`, `updated_at/by`, `deleted_at/by`
  - 인덱스: `(bike_id, status, sequence)` (큐 조회용)
- **`DispatchOrder`** 엔티티 — `DisplaySequencedEntity` 상속. `DispatchOrderStatus` enum(ASSIGNED/COMPLETED). 정적 팩토리 `create(...)`, `complete(actorId, clock)` 메서드.
- **`DispatchOrderRepository`** (`Repository<DispatchOrder, UUID>`): `findByBikeIdAndDeletedAtIsNullOrderBySequenceAsc`, `findByBikeIdAndStatusAndDeletedAtIsNull...`, `findByIdAndDeletedAtIsNull`, `save`, 대시보드용 일괄 조회.
- **DTO:** `DispatchOrderReadResponse`(from factory), `DispatchOrderCreateRequest`(@NotBlank/@Size, lat/lng range — Group B Tip/Station 검증 컨벤션), bulk DTO는 Group B `common` bulk DTO 재사용.

### 3.2 서비스
- `DispatchOrderReadService` (@Transactional readOnly): 차량 큐 조회.
- `DispatchOrderCommandService` (@Transactional): 단건 생성(차량 큐에 append, sequence = 해당 차량 max+1), `complete(id)`, `cancel(id)`(소프트 삭제). markDeleted/Clock 등 기존 command service 패턴.
- `DispatchOrderBulkService`: 엑셀 preview/apply. 행별 평가 — 차량번호 활성 bike 존재 검증(없으면 ERROR), 주소 지오코딩(실패 시 ERROR), 신규=NEW. apply 시 각 행을 해당 차량 큐에 ASSIGNED append.
  - 지오코딩: 프로젝트의 NCP Geocoding 재사용. 배포 환경에 server-only `NCP_MAP_CLIENT_SECRET`가 있으므로 **백엔드 지오코딩**이 자연스러움(없으면 프론트 `ncp-geocoder` 선처리). 정확한 위치는 plan 단계에서 결정.

### 3.3 컨트롤러 (ArchUnit allow-list 주의 — issue_70 규칙)
기존 도메인처럼 Read/Command 컨트롤러 **분리** + `ArchitectureBoundaryTests` allow-list에 `isDispatchCommand` 등록(쓰기 라우트/@RequestBody).
- `DispatchOrderReadController` `@RequestMapping("/api/v1/dispatch-orders")`: GET `/bikes/{bikeId}` (또는 query), bulk export.
- `DispatchOrderCommandController`: POST `` (단건), POST `/{id}/complete`, DELETE `/{id}`, POST `/bulk-preview`, POST `/bulk-apply`.

### 3.4 Dashboard 확장
- `DashboardMapStateResponse`의 BikePin(또는 별도 맵)에 **현재 배차**(고객명/주소/좌표) + **큐 잔여(ASSIGNED) 건수** 추가. `DashboardMapStateService`가 활성 ASSIGNED 주문을 차량별로 집계해 포함.

### 3.5 테스트
`DispatchOrderApiContractTests` (PostgresContainerSupport): 단건 생성→큐 append, complete→다음 건 현재화, cancel(소프트삭제), bulk-preview/apply(차량번호 검증·지오코딩 실패 ERROR·NEW), 큐 sequence 순서, dashboard map-state에 현재 배차 포함.

---

## 4. 프론트엔드 (front-admin-web)

### 4.1 타입 + API 클라이언트 (service-ops-api.ts)
- `ServiceOpsDispatchOrder`, `DispatchOrderUpsertPayload`, bulk 타입(Group B `ServiceOpsBulk*` 재사용).
- 클라이언트 메서드: `listDispatchOrders(bikeId)`, `createDispatchOrder`, `completeDispatchOrder(id)`, `cancelDispatchOrder(id)`, `previewDispatchOrders(file)`, `applyDispatchOrders(...)`.
- `FrontendDashboardBikePin`에 `currentDispatch?`(고객/주소/좌표) + `dispatchQueueCount` 추가, dashboard 정규화에 반영.

### 4.2 서버 액션 (app/dispatch/actions.ts 또는 management actions)
`completeDispatchOrderAction`, `cancelDispatchOrderAction`, bulk preview/apply 액션 — 기존 `{ok,error}` 결과 패턴 + `revalidatePath("/")`/management 경로.

### 4.3 /management "배차" 섹션
차량/라이더/매칭 옆에 **배차** 섹션: 현재 ASSIGNED 주문 테이블(차량번호/고객/연락처/주소/순번) + 내려받기(export)/업로드(ExcelImportButton + BulkPreviewModal 재사용). 템플릿 `dispatch-template.xlsx` (차량번호/고객명/연락처/배송지주소).

### 4.4 지도/차량 상세 연동
- **마커 배지:** MapShell의 "배송 중 · N건" N을 `dispatchQueueCount`(실제 ASSIGNED 잔여)로 연결.
- **차량 상세 다이얼로그:** "배차 큐" 섹션 — 현재 배차(고객/주소) + 대기 목록, 각 건 **완료/취소** 버튼(서버 액션 호출 → revalidate).
- 현재 배차 목적지 핀: 기존 next-customer 마커/타겟 패턴 재사용 가능(독립 데이터).

---

## 5. 데이터 흐름

```
[엑셀 업로드] → bulk-preview (차량번호 검증 + 지오코딩) → diff 미리보기(신규/오류)
    → bulk-apply → 각 행을 해당 차량 큐에 ASSIGNED append (sequence 부여)
[운영자] 차량 상세 "배차 큐"에서 현재 배차 확인 → '완료' → COMPLETED + 다음 ASSIGNED 현재화
[지도] dashboard map-state가 차량별 현재 배차 + 큐 잔여 수 제공 → 마커 배지 N + 핀
```

## 6. 배포 영향
- **DB 마이그레이션 V33 신규** (dispatch_orders) — api 재기동 시 Flyway 자동 적용. (배포 파이프라인은 `-x test`라 마이그레이션 정확성 = 재기동 시 검증; 스키마/엔티티 매핑 일치 필수.)
- 백엔드 + 프론트 모두 변경. NCP 지오코딩(server secret 또는 프론트) 사용.

## 7. 비범위 재확인
배민 콜/라이더 수락(C1), 자동 배정, 클리닝 시동 알림(C3), 유모차 2단계(C4), 픽업 2지점, 실제 이동 시뮬은 이 스펙에 포함하지 않는다.
