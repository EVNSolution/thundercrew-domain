# Group C1 — 배민 배송 (단건 콜: 시스템 자동 배차 / 라이더 수락) Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement the plan derived from this spec.

**Goal:** 배민 배송 단건 콜을 웹 폼으로 입력하고, 두 가지 배정 방식 — **시스템 자동 배차**(가용 라이더 즉시 배정) 또는 **라이더 수락**(미배정 OFFERED → 운영자가 라이더 지정해 수락) — 으로 처리한다. 단일 목적지(고객 배달지) call.

**Architecture:** 기존 `DispatchOrder`를 확장한다 — `DispatchOrderStatus`에 `OFFERED` 추가 + `bike_id`를 nullable로. 배정된(ASSIGNED) 콜은 기존 단건 배차와 동일(배차 큐/지도/완료 재사용); OFFERED는 "차량 없는 status"로 표현해 대시보드·큐·알림 핫패스(차량별 ASSIGNED 기준)에서 자연히 제외된다. 시스템 배차는 가장 적게 배정된 DELIVERY 차량을 자동 선택, 라이더 수락은 운영자가 차량을 지정한다.

**Tech Stack:** Spring Boot (Java 21), Flyway, JPA `Repository<T,UUID>`, NCP Geocoding(프론트), Next.js App Router, TypeScript.

---

## 1. 범위

### 이번 스펙 (C1)
- 배민 콜 단건 웹 입력(고객명/연락처/배달지 + 배정 모드).
- **시스템 자동 배차**: 가용 DELIVERY 차량 자동 선택 → 즉시 ASSIGNED.
- **라이더 수락**: OFFERED 생성 → 운영자가 차량 지정 수락 → ASSIGNED.
- OFFERED 콜 목록 + 수락 UI. 배정된 콜은 기존 배차 큐/완료 재사용.

### 범위 외 (후속/별도)
- 가게 픽업(2지점), 실제 배민 API 연동, 라이더 앱(실제 수락)
- 콜 자동 재배정/만료, 라이더 거절 흐름, 다중 라이더 브로드캐스트 경쟁 수락
- 시동 알림(배민=DELIVERY, 알림은 CLEANING 전용 — 변경 없음)
- 새 serviceType (DELIVERY 재사용)

---

## 2. 핵심 동작 결정 (확정)

| 항목 | 결정 |
|---|---|
| call 구조 | **단일 목적지** — 고객명+연락처+배달지(주소→좌표) |
| 배정 방식 | call마다 선택: **시스템 자동 배차** 또는 **라이더 수락** |
| 시스템 자동 선택 규칙 | **가장 적게 배정된(ASSIGNED 큐가 짧은) DELIVERY 차량**. 동률은 임의. 가용 차량 없으면 409 에러 |
| OFFERED 표현 | **DispatchOrderStatus.OFFERED + bike_id null** (새 도메인 아님). 수락 시 차량 지정 + sequence 부여 + ASSIGNED |
| OFFERED 풀 | 특정 라이더 미지정(미배정). 수락 시 운영자가 차량 선택 |
| 차량 serviceType | DELIVERY 재사용 (새 enum 없음) |
| 입력 | 단건 웹 폼 (엑셀 없음). 지오코딩은 프론트 server action(C2 hybrid 재사용) |

---

## 3. 백엔드 (service-ops-api · `com.thundercrew.opsapi.dispatch`)

### 3.1 마이그레이션 `V35__dispatch_orders_offered_status.sql`
- `alter table dispatch_orders alter column bike_id drop not null;` (OFFERED 콜은 차량 미배정)
- 기존 status check 제약(`ck_dispatch_orders_status in ('ASSIGNED','COMPLETED')`)을 **drop 후 재생성**해 `OFFERED` 포함:
  - `alter table dispatch_orders drop constraint ck_dispatch_orders_status;`
  - `alter table dispatch_orders add constraint ck_dispatch_orders_status check (status in ('OFFERED','ASSIGNED','COMPLETED'));`
- 기존 인덱스/데이터는 영향 없음(OFFERED 신규 값).

### 3.2 도메인
- **`DispatchOrderStatus`**: `OFFERED` 추가 → `{OFFERED, ASSIGNED, COMPLETED}`.
- **`DispatchOrder`**:
  - `bikeId` nullable 허용(필드 타입 UUID 그대로, not-null 제약은 DB에서 제거; 엔티티 `@Column(nullable = true)`).
  - 신규 팩토리 `createOffered(customerName, customerPhone, address, latitude, longitude)`: status=OFFERED, bikeId=null, sequence=0(미배정), kind=DELIVERY.
  - 신규 메서드 `assign(UUID bikeId, long sequence)`: OFFERED→ASSIGNED 전환(상태 검증; OFFERED 아니면 `InvalidStateTransitionException`), bikeId·sequence 설정.
  - 기존 `create(...)`(ASSIGNED)·`createForBatch(...)`·`complete(...)` 변경 없음.
- **`DispatchOrderRepository`** 추가: `findByStatusAndDeletedAtIsNullOrderByCreatedAtAsc(DispatchOrderStatus)`(OFFERED 목록), `countByBikeIdAndStatusAndDeletedAtIsNull(UUID, DispatchOrderStatus)` 또는 기존 `findByStatusAndDeletedAtIsNull(ASSIGNED)` 재사용해 in-memory 집계.

### 3.3 서비스 — `DeliveryCallService` (`@Transactional`)
- `systemDispatch(customerName, phone, address, lat, lng)`: 가용 DELIVERY 차량 자동 선택 → `commandService.appendForBike(bikeId, ...)`(ASSIGNED). 선택 규칙: `bikeRepository.findAllByDeletedAtIsNull()`에서 serviceType==DELIVERY 필터 → 각 차량의 ASSIGNED 주문 수(`dispatchOrderRepository.findByStatusAndDeletedAtIsNull(ASSIGNED)` 그룹 집계) 최소 차량. 후보 없으면 `InvalidStateTransitionException("가용 배송 차량이 없습니다.")`.
- `offerCall(customerName, phone, address, lat, lng)`: `DispatchOrder.createOffered(...)` 저장(OFFERED, bike null). 반환 DTO.
- `acceptCall(orderId, bikeId)`: OFFERED 주문 find-or-404, 차량 존재 검증, `order.assign(bikeId, nextSequence(bikeId))`(dirty-checking). 이미 ASSIGNED면 `InvalidStateTransitionException`.
- `listOffered()`(readOnly): OFFERED 주문 목록(createdAt asc).
- nextSequence는 기존 CommandService 헬퍼 패턴(차량 max+1) 재사용(필요 시 노출).

### 3.4 컨트롤러 (ArchUnit allow-list — 기존 `isDispatchCommand` 커버)
`DispatchOrderCommandController`(`/api/v1/dispatch-orders`)에 라우트 추가(이미 allow-list 등록된 컨트롤러라 신규 predicate 불필요):
- `POST /calls/system` (@RequestBody system 콜) → 자동 배차.
- `POST /calls/offer` (@RequestBody) → OFFERED 생성.
- `POST /calls/{id}/accept` (@RequestBody {bikeId}) → 수락.
`DispatchOrderReadController`에 `GET /calls/offered` → OFFERED 목록.
DTO: `DeliveryCallCreateRequest`(@NotBlank name/phone/address, lat/lng range), `DeliveryCallAcceptRequest`(@NotNull bikeId). 응답은 기존 `DispatchOrderReadResponse`(이미 kind/status 포함; bikeId nullable 반영).

### 3.5 Dashboard / 큐 영향
- OFFERED 주문은 bike_id null → 차량별 ASSIGNED 쿼리(currentDispatch·배차 큐·export)에 **미포함**(변경 없음). 수락되면 ASSIGNED로 그 차량 큐 합류.
- `DispatchOrderReadResponse.bikeId`가 null 가능해짐(OFFERED) — 프론트 타입도 nullable.

### 3.6 테스트
`DeliveryCallApiContractTests`(PostgresContainerSupport): 시스템 배차(가용 차량 자동 선택 → ASSIGNED, bike 지정됨), 가용 차량 없음 → 409, offer(OFFERED, bike null) → GET /calls/offered 포함, accept(OFFERED→ASSIGNED, bike·sequence 설정) → 차량 큐 조회에 등장, 이미 ASSIGNED accept → 409, 시스템 배차 시 least-loaded 선택(2차량 중 적게 배정된 쪽).

---

## 4. 프론트엔드 (front-admin-web)

### 4.1 타입 + API 클라이언트 (service-ops-api.ts)
- `ServiceOpsDispatchOrderStatus`에 `"OFFERED"` 추가. `ServiceOpsDispatchOrder.bikeId`를 `string | null`로.
- 메서드: `systemDispatchCall(payload)`, `offerCall(payload)`, `acceptCall(orderId, bikeId)`, `listOfferedCalls()`.

### 4.2 서버 액션 (app/dispatch/actions.ts)
- `createSystemCallAction(formData)`: 주소 지오코딩(`geocodeAddress`, C2 패턴) → `systemDispatchCall({name,phone,address,lat,lng})`. 지오코딩 실패/가용차량 없음 → `{ok:false,error}`(409 한글 메시지 노출).
- `createOfferedCallAction(formData)`: 지오코딩 → `offerCall(...)`.
- `acceptCallAction(orderId, bikeId)`: `acceptCall(...)`.
- `listOfferedCallsAction()`: OFFERED 목록(미인증/오류 시 빈 배열).
- 모두 `{ok,error}` + `revalidatePath("/management")`,`("/")`.

### 4.3 /management "배민 콜" 섹션 (BaeminCallPanel)
- **콜 입력 폼**: 고객명 / 연락처 / 배달지(주소 검색) + **모드 라디오**(시스템 자동 배차 / 라이더 수락). 제출 → 모드에 따라 system/offer 액션.
- **OFFERED 콜 목록**: 미배정 콜 카드(고객/주소) + **수락** 버튼 → 차량 선택(드롭다운: DELIVERY 차량 또는 매칭 차량) → `acceptCallAction(orderId, bikeId)`.
- 시스템 배차 성공 시 배정 차량 표시; 가용 차량 없음 등 에러는 `{ok:false}` 메시지로.
- 차량 선택 드롭다운 데이터: 기존 차량 목록(매칭/운영 차량)에서 DELIVERY 추출.

### 4.4 지도 / 차량 상세
- 변경 최소: 수락/시스템 배차로 ASSIGNED 되면 기존 배차 큐(차량 상세) + 지도 배지(N건)에 자동 반영(기존 C0/C2 로직). 별도 UI 불필요.

---

## 5. 데이터 흐름

```
[배민 콜 입력(고객/연락처/주소 + 모드)] → 지오코딩(프론트)
  ├ 시스템 자동 배차 → systemDispatch: least-loaded DELIVERY 차량 선택 → ASSIGNED 주문(차량 큐 합류)
  └ 라이더 수락 → offer: OFFERED 주문(bike null) → /management OFFERED 목록
        → 운영자 '수락' + 차량 선택 → accept: bike·sequence 설정 + ASSIGNED(차량 큐 합류)
[배정 후] 차량 상세 배차 큐 + 지도 배지에 반영 → 운영자 '완료'(기존 C0/C2)
```

## 6. 배포 영향
- **V35 마이그레이션 신규**(bike_id nullable + status check 재생성) — 재기동 시 Flyway 적용. 기존 데이터 영향 없음(OFFERED 신규 값). 엔티티 매핑(bikeId nullable) 일치 필수.
- 백엔드 + 프론트. 지오코딩 프론트(C2 hybrid) 재사용.

## 7. 비범위 재확인
가게 픽업 2지점, 실제 배민/라이더 앱 연동, 콜 만료/거절/재배정, 시동 알림(배민), 새 serviceType 은 이 스펙에 포함하지 않는다.
