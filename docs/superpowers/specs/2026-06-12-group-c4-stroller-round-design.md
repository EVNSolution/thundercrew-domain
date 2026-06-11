# Group C4 — 유모차 클리닝 (수거 → 배송 2단계 라운드) Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement the plan derived from this spec.

**Goal:** 유모차 클리닝의 "전체 수거 → 전체 배송" 2단계 배치 흐름을 구축한다. 엑셀 한 행(담당 차량+고객+주소)이 그 고객의 **수거 + 배송 왕복 태스크**를 만들고, 운영자는 1단계로 전체 수거를 완료한 뒤 '배송 시작'으로 2단계 전체 배송으로 전환한다.

**Architecture:** 기존 C0/C2 `DispatchOrder`(태스크 단위)를 확장한다 — `kind`(PICKUP/DELIVERY) + `batch_id`(라운드) 컬럼 추가 + 신규 `dispatch_batch`(라운드, 단계 상태) 엔티티. **활성 단계의 태스크만 ASSIGNED로 존재**시켜(배송 주문은 '배송 시작' 시점에 생성), 대시보드·배차 큐·시동 알림의 핫패스 쿼리를 C2/C3와 동일하게 유지한다. 엑셀 벌크·지오코딩·배차 큐 UI·시동 알림(C3)을 재사용한다.

**Tech Stack:** Spring Boot (Java 21), Flyway, JPA `Repository<T,UUID>`, Apache POI, NCP Geocoding(프론트), Next.js App Router, TypeScript.

---

## 1. 범위

### 이번 스펙 (C4)
- 유모차 라운드 도메인: `DispatchBatch`(단계) + `DispatchOrder` 확장(kind/batch).
- 엑셀 업로드 → 라운드 생성(수거 태스크) → 전체 수거 완료 → '배송 시작' → 배송 태스크 생성 → 전체 배송 완료 → 라운드 종료.
- /management "유모차 라운드" 섹션(단계·진척·업로드·배송 시작), 차량 상세 배차 큐 + 지도 + 시동 알림에 수거/배송 라벨.

### 범위 외 (후속/별도)
- 배민 배송(C1)
- 다중 동시 활성 라운드(이번엔 1개만)
- 수거지 ≠ 배송지(주소 분리), 픽업 2지점
- 실제 경로 계산, 세척장 위치, 라이더 앱 연동
- 새 `STROLLER` serviceType (CLEANING 재사용)

---

## 2. 핵심 동작 결정 (확정)

| 항목 | 결정 |
|---|---|
| 수거/배송 구조 | **왕복** — 한 고객(주소 1개) = 수거 + 배송. 엑셀 한 행이 두 태스크의 소스 |
| 단계 전환 | **전체 수거 완료 후 일괄 전환** — 모든 PICKUP COMPLETED → 운영자 '배송 시작' → 전체 배송 단계 |
| 배정 | 엑셀 행마다 **담당 차량번호 명시** (C2/C3 동일 템플릿) |
| 배송 주문 생성 시점 | **'배송 시작' 전환 시 생성** (업로드 시엔 수거만) → 항상 활성 단계만 ASSIGNED → 기존 쿼리 무수정 |
| 차량 serviceType | **CLEANING 재사용** (새 enum 없음). 유모차 여부 = batch 소속으로 구분 → 시동 알림/필터 무료 재사용 |
| 동시 활성 라운드 | **1개** (업로드 = 라운드 1개) |
| 시동 알림 | C3 재사용 — CLEANING 차량 출발 시 현재 태스크(수거/배송) 고객 표시 |

---

## 3. 백엔드 (service-ops-api · `com.thundercrew.opsapi.dispatch`)

### 3.1 마이그레이션 `V34__add_dispatch_batch_and_order_kind.sql`
- `dispatch_orders` ALTER:
  - `kind varchar(20) not null default 'DELIVERY'` + check (`PICKUP`,`DELIVERY`) — 기존 단건(C2/C3) 주문은 DELIVERY로 백필
  - `batch_id uuid null` (라운드 식별; 단건 주문은 null) + 인덱스 `(batch_id, kind, status)`
- `dispatch_batch` 신규 (V33 컨벤션 준수):
  - `id uuid pk`, `idx bigserial unique`
  - `status varchar(20) not null` (`COLLECTING`,`DELIVERING`,`DONE`) + check
  - 표준 audit/soft-delete: `created_at/by`, `updated_at/by`, `deleted_at/by`

### 3.2 도메인
- **`DispatchOrder`** (확장): `kind`(enum `DispatchOrderKind{PICKUP,DELIVERY}`), `batchId`(UUID nullable) 필드. 신규 팩토리 `createForBatch(bikeId, name, phone, address, lat, lng, sequence, kind, batchId)`. 기존 `create(...)`는 `kind=DELIVERY, batchId=null`로 위임(하위호환).
- **`DispatchBatch`** (신규, `DisplaySequencedEntity` 상속): `status`(enum `DispatchBatchStatus{COLLECTING,DELIVERING,DONE}`). 정적 팩토리 `create()`(status=COLLECTING). 메서드 `startDelivery()`(COLLECTING→DELIVERING), `markDone(actorId,Instant)`(DELIVERING→DONE). 잘못된 전환은 `IllegalStateException`.
- **`DispatchBatchRepository`** (`Repository<DispatchBatch,UUID>`): `findByStatusInAndDeletedAtIsNull`(활성 라운드 조회), `findByIdAndDeletedAtIsNull`, `save`.
- **`DispatchOrderRepository`** 추가: `findByBatchIdAndDeletedAtIsNull`, `findByBatchIdAndKindAndStatusAndDeletedAtIsNull`(게이트/진척 집계).

### 3.3 서비스
- **`DispatchRoundService`** (`@Transactional`):
  - `createRound(rows)`: 활성 라운드 존재 시 거부(동시 1개). `DispatchBatch` 생성(COLLECTING). 각 행 → 담당 차량 lookup, `kind=PICKUP` 주문 생성(차량별 sequence = max+1), batchId 연결. 좌표는 행에 포함(프론트 지오코딩 선처리).
  - `startDelivery(batchId)`: 배치 COLLECTING 검증. 해당 배치 **모든 PICKUP COMPLETED** 검증(미완료 시 거부, 메시지). 각 PICKUP에서 같은 차량/고객/주소/좌표로 `kind=DELIVERY` 주문 생성(ASSIGNED, sequence 부여). `batch.startDelivery()`.
  - `activeRound()`(readOnly): 활성 배치 + 진척(수거 완료/전체, 배송 완료/전체, 단계) DTO.
- **`DispatchOrderCommandService.complete(id)`** 확장: 완료 주문이 batch 소속 DELIVERY이고 해당 배치 전 DELIVERY가 모두 COMPLETED면 `batch.markDone(...)`. (PICKUP 완료는 단계 전환 안 함 — '배송 시작'은 운영자 클릭.)

### 3.4 컨트롤러 (ArchUnit allow-list — issue_70)
- `DispatchBatchReadController` `@RequestMapping("/api/v1/dispatch-batches")`: GET `/active`(현재 라운드+진척).
- `DispatchBatchCommandController`: POST `/round`(라운드 생성 = bulk apply), POST `/{id}/start-delivery`. (Read/Command 분리, `isDispatchBatchCommand` allow-list 등록 — write-route + @RequestBody 규칙 양쪽.)
- 라운드 업로드 미리보기/검증은 C2 `DispatchOrderBulkService` 패턴 재사용(차량번호 검증 + NEW/ERROR). apply만 라운드 생성 경로.

### 3.5 Dashboard 확장
- `DashboardMapStateResponse.BikePin`에 `currentDispatchKind`(PICKUP/DELIVERY nullable) 1필드 추가 — current(최저 seq ASSIGNED) 주문의 kind. current 선택 로직은 **무변경**(활성 단계만 ASSIGNED이므로).

### 3.6 테스트
`DispatchRoundApiContractTests` (PostgresContainerSupport): 라운드 생성(수거 주문 N건, 배치 COLLECTING), 수거 완료, 미완료 상태 start-delivery 거부, 전체 수거 후 start-delivery → 배송 주문 N건 생성 + 배치 DELIVERING, 배송 완료 → 배치 DONE, 동시 라운드 생성 거부, dashboard currentDispatchKind 반영.

---

## 4. 프론트엔드 (front-admin-web)

### 4.1 타입 + API 클라이언트 (service-ops-api.ts)
- `ServiceOpsDispatchRound`(status, 수거/배송 진척 수치), `ServiceOpsDispatchOrderKind`. BikePin에 `currentDispatchKind` 추가 + 정규화.
- 메서드: `getActiveDispatchRound()`, `createDispatchRound(rows)`, `startDispatchDelivery(batchId)`, 라운드 미리보기(C2 preview 재사용).

### 4.2 서버 액션 (app/dispatch/actions.ts 또는 stroller actions)
`previewRoundAction`(C2 previewDispatchAction 패턴 — 지오코딩), `createRoundAction(rows)`, `startDeliveryAction(batchId)` — `{ok,error}` + `revalidatePath("/management")`,`("/")`.

### 4.3 /management "유모차 라운드" 섹션
차량/라이더/매칭/배차 옆 **유모차 라운드** 섹션:
- 현재 단계 배지: 수거 중 / 배송 중 / 진행 라운드 없음
- 진척: "수거 N/M 완료", "배송 N/M 완료"
- **유모차 엑셀 업로드**(C2 ExcelImport/preview 모달 재사용, 라운드 생성)
- **'배송 시작' 버튼**: 단계 COLLECTING + 전체 수거 완료일 때만 활성. 클릭 → `startDeliveryAction`.

### 4.4 지도 / 차량 상세 / 알림 (수거·배송 라벨)
- 차량 상세 "배차 큐": 현재/대기 각 건에 **수거/배송 라벨**(order.kind). 완료/취소는 기존 그대로.
- 시동 알림(벨/말풍선): 현재 태스크 고객명 + **수거/배송 라벨**(currentDispatchKind). C3 알림 경로 재사용.
- 지도 마커 배지: 기존 "N건" 유지(선택적으로 단계 라벨). 시뮬 이동은 currentDispatch 좌표(기존 C3 가드) 그대로.

---

## 5. 데이터 흐름

```
[엑셀 업로드(차량/고객/연락처/주소)] → 미리보기(차량 검증+지오코딩, C2)
  → createRound: DispatchBatch(COLLECTING) + 행마다 PICKUP 주문(ASSIGNED)
[수거] 차량이 현재 수거지로(시뮬·시동 알림) → 운영자 배차 큐 완료
  → 전체 PICKUP 완료 시 '배송 시작' 활성
[배송 시작] startDelivery: 게이트 검증 → PICKUP들로 DELIVERY 주문 생성(ASSIGNED) + 배치 DELIVERING
[배송] 차량이 현재 배송지로 → 운영자 완료 → 마지막 배송 완료 시 배치 DONE
[대시보드] 활성 단계 주문만 ASSIGNED → currentDispatch(+kind) 제공 → 마커/알림/큐
```

## 6. 배포 영향
- **V34 마이그레이션 신규** (dispatch_orders ALTER + dispatch_batch) — api 재기동 시 Flyway 적용. 파이프라인 `-x test`라 스키마/엔티티 매핑 일치 필수.
- 백엔드+프론트 변경. 지오코딩은 프론트(C2 hybrid) 재사용.

## 7. 비범위 재확인
배민(C1), 다중 동시 라운드, 수거지≠배송지, 실제 경로/세척장, 새 serviceType 은 이 스펙에 포함하지 않는다.
