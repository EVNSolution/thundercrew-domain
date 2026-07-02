# 배차 주문 편집·추적 보강 Design

**Date:** 2026-07-02
**Branch:** `cc-dispatch-edit-tracking` (off `dev`)
**Status:** Approved (design), pending spec review
**Asana:** (CLEVER) SI-썬더크루 → "웹사이트 수정 사항" #4 "업무관리 효율화 방안 파악"

---

## 1. 배경 / 결정

운영자가 콜/단일/순차/왕복 배차를 더 효율적으로 수행하도록 개선한다. 페인포인트 조사 결과(운영자 답변):

1. **엑셀로 적재한 배차 목록을 정정할 방법이 없다** — 현재 배차 주문에 **수정(update) 경로가 아예 없음**. 오타·주소·차량 하나 고치려 해도 취소 후 재업로드해야 함.
2. **진행상황 추적이 답답하다** — `DispatchMonitorTable`이 읽기 전용이고 **ASSIGNED만** 표시. 완료되면 목록에서 사라져 진행률(완료 N/전체 M)이 안 보임. 새로고침도 수동.
3. **취소도 목록에서 못 함** — 취소(soft-delete) API는 있으나 모니터에서 노출 안 됨.

**결정(사용자 승인, Approach A):** 엑셀 인테이크는 그대로 두고, 웹에 **편집·재배정·취소 + 진행상황 추적**을 보강한다. 완료 처리는 **라이더(드라이버 앱)** 담당(현행 유지) — 운영자 웹은 추적만.

**비목표(향후 개선):** 실시간 SSE 푸시, 라이더 완료사진 열람, 순번 드래그 재정렬, 배차 입력의 웹 폼 대체.

---

## 2. 목표 / 비목표

**목표**
- 배차 주문 **필드 편집**(고객명·연락처·주소+좌표·배정차량·순번)을 웹에서.
- 목록에서 **취소(삭제)**.
- **진행상황 추적**: 완료 포함 조회 + 차량별 완료/전체 진행률 + 자동 새로고침.

**비목표**
- DB 스키마 변경 — **없음**(DispatchOrder 테이블에 필요한 컬럼 이미 존재, 마이그레이션 불필요).
- 완료 처리 UI — 안 함(라이더 앱 담당). 배차 완료의 기존 로직·감사는 그대로.
- SSE/웹소켓 실시간 — 안 함(폴링으로 충분).
- 배차 입력 방식 변경 — 안 함(엑셀 유지).

---

## 3. 편집 API (백엔드)

**신규 `PATCH /api/v1/dispatch-orders/{id}`** — ADMIN 게이트(기존 컨트롤러와 동일).

`DispatchOrderUpdateRequest` — **전체 치환** 방식(sparse PATCH 아님): 프론트가 편집 다이얼로그의 현재값 전체를 채워 보내고, 서버는 받은 값으로 필드를 덮어쓴다. 필드:
- `customerName`(필수), `customerPhone`(필수), `address`(필수), `latitude`(필수), `longitude`(필수), `bikeId`(필수), `sequence`(선택 — 없으면 재배정 시 tail append, 미재배정 시 현재값 유지)

`DispatchOrderCommandService.update(UUID id, DispatchOrderUpdateRequest req)`:
1. `findByIdAndDeletedAtIsNull(id)` — 없으면 404.
2. **상태 가드**: `status == ASSIGNED`만 편집 가능. COMPLETED면 `InvalidStateTransitionException`(409). (배송 완료된 주문 불변.)
3. **왕복(batch) 가드**: `batchId != null`이면 고객명·연락처·주소·좌표 수정은 허용하되 **bikeId 변경(재배정)·sequence 변경은 거부**(배치 단계/큐 불변식 보호). 위반 시 `InvalidStateTransitionException`.
4. **재배정**(요청 bikeId ≠ 현재 bikeId, 비-batch): 대상 차량 `findByIdAndDeletedAtIsNull` 검증 + 유형이 `CALL/SINGLE/SEQUENTIAL` 중 하나인지 검증(모니터 통합 풀). 순번 = 요청 sequence 있으면 그 값, 없으면 `대상 큐 최대 sequence + 1`(tail append).
5. **필드 반영**: 도메인 메서드로 mutate(§4). 트랜잭션 종료 시 dirty-checking flush.
6. **감사**: `auditLogCommandService.log("DISPATCH_ORDER", id, "__updated__", null, customerName)`.
7. `DispatchOrderReadResponse.from(order)` 반환.

컨트롤러: `DispatchOrderCommandController`에 `@PatchMapping("/{id}")` 추가.

---

## 4. 도메인 (백엔드)

`DispatchOrder`에 mutate 메서드 추가(둘 다 `status == ASSIGNED` 가드 내장, 위반 시 `InvalidStateTransitionException`):
- `updateDetails(String customerName, String customerPhone, String address, double latitude, double longitude)` — 고객/주소 필드 갱신.
- `reassign(UUID bikeId, long sequence)` — 배정 차량+순번 갱신.

기존 필드/컬럼만 사용(신규 컬럼 없음). `service_ops_api`의 `dispatch_orders` 테이블은 `bike_id, customer_name, customer_phone, address, latitude, longitude, sequence, status, batch_id, kind, deleted_at …`를 이미 보유.

---

## 5. 추적용 읽기 보강 (백엔드)

현재 모니터 데이터 소스(`DispatchOrderReadService.listActiveAssigned()`)는 ASSIGNED만 조회 → 완료가 사라져 진행률이 안 보임. 진행률 표시를 위해 **당일 완료(COMPLETED) 포함** 조회를 추가한다.

- **`DispatchOrderReadResponse`는 이미 `status`, `completedAt`, `completedBy`, `hasCompletionPhoto`를 노출** → **응답 DTO 변경 불필요.**
- `DispatchOrderReadService`에 `listActiveWithTodayCompleted()` 추가: 기존 `listActiveAssigned()`(ASSIGNED 전체) + **당일 완료**(COMPLETED, `completedAt >= 오늘 0시 KST`)를 합쳐 반환. 오늘 0시는 주입된 `Clock`으로 계산(`Asia/Seoul`).
- 리포지토리: 신규 `findByStatusAndCompletedAtAfterAndDeletedAtIsNull(DispatchOrderStatus, Instant)` 추가(COMPLETED + 당일). ASSIGNED는 기존 `findByStatusAndDeletedAtIsNull` 재사용.
- 컨트롤러: 모니터 전용 조회를 읽기 컨트롤러에 노출(`GET /api/v1/dispatch-orders?includeCompleted=true` 파라미터 분기 또는 신규 경로). **기존 ASSIGNED-only 경로(지도/차량상세 큐 소비자)는 건드리지 않음.**
- 완료 폭주 방지는 "당일" 제한으로 충분(무한 페이지네이션 불필요).

---

## 6. 프론트 — 편집 다이얼로그 + 액션형 모니터

**API 클라이언트 (`lib/services/service-ops-api.ts`)**
- `updateDispatchOrder(id, payload)` — `PATCH /dispatch-orders/{id}`.
- 모니터 조회를 완료 포함 버전으로(신규 액션이 호출).
- `ServiceOpsDispatchOrder`에 `status`, `completedAt` 필드 확인/추가.

**서버액션 (`app/dispatch/actions.ts`)**
- `updateDispatchOrderAction(id, payload)` — 인증 클라이언트로 update 호출.
- `cancelDispatchOrderAction(id)` — 기존 DELETE(`cancel`) 호출(액션 없으면 신설).
- 완료 포함 조회 액션(`listActiveDispatchOrdersAction` 확장 또는 `listDispatchMonitorAction` 신설).

**`DispatchMonitorTable` 액션형 전환**
- 컬럼 추가: **상태**(ASSIGNED=진행중 / COMPLETED=완료), 툴바에 **진행률**(완료 N / 전체 M).
- 완료 행은 흐리게(muted) 표시, 진행중 위로 정렬(차량→상태→순번).
- 행별 액션(ASSIGNED만): **수정** 버튼 → `DispatchOrderEditDialog` 열기, **취소** 버튼 → confirm 후 `cancelDispatchOrderAction`. COMPLETED 행은 액션 숨김.
- **자동 새로고침**: `setInterval` 15초 폴링(언마운트 시 clear) + 기존 수동 "새로고침" 유지. 편집/취소 성공 후 즉시 재조회.

**`DispatchOrderEditDialog.tsx` (신규)**
- 필드: 고객명·연락처·주소(`AddressSearchButton` 재사용 → 좌표 재지오코딩)·배정차량(select: CALL/SINGLE/SEQUENTIAL 차량)·순번(number).
- 제출 → `updateDispatchOrderAction`. 실패 시 에러 표시(완료됨 409, 비호환/배치 400).
- 기존 편집 다이얼로그(`VehicleDetailDialog` 편집폼) 패턴·클래스 재사용.

배치는 `/management/operations` 페이지에 이미 통합 모니터가 있는 위치 그대로 사용.

---

## 7. 엣지 케이스

- **완료 주문 편집** → 백엔드 409, UI는 COMPLETED 행에 수정/취소 버튼 미노출.
- **왕복(batch) 주문 재배정/재정렬** → 백엔드 400(고객·주소만 허용). UI 편집 다이얼로그에서 batch 주문이면 차량/순번 필드 비활성.
- **주소 수정 시 좌표 누락** → 주소검색으로 좌표 확보 강제(좌표 없으면 제출 불가), bulk-apply와 동일 규칙.
- **재배정 대상 유형 비호환**(OTHER·청소형 등) → 400.
- **동시 편집** → last-write-wins(dirty checking). 별도 낙관적 락 없음(1차 범위 밖).

---

## 8. 테스트

**백엔드 계약테스트(`DispatchOrder*ContractTests` 확장 또는 신규 `DispatchOrderUpdateContractTests`):**
- PATCH로 고객/주소 필드 반영.
- 재배정 시 대상 차량 + 순번 = 대상 큐 tail+1.
- COMPLETED 주문 PATCH → 409.
- batch 주문 재배정 → 400.
- 편집 성공 시 `audit_logs`에 `DISPATCH_ORDER/__updated__` 1건.
- ⚠️ Testcontainers/Docker 필요 → 로컬(Docker) 또는 배포 후 QA. `compileTestJava`가 컴파일 게이트. [[reference_no_backend_test_ci]]

**프론트:** `npm run typecheck && npm run lint`. 런타임은 배포/사용자 dev QA(경쟁 서버 금지).

---

## 9. 손대는 파일 요약

| 파일 | 변경 |
|------|------|
| `dispatch/dto/DispatchOrderUpdateRequest.java` | 신규 |
| `dispatch/domain/DispatchOrder.java` | `updateDetails`, `reassign` 추가 |
| `dispatch/service/DispatchOrderCommandService.java` | `update(id, req)` + 감사 |
| `dispatch/service/DispatchOrderReadService.java` | `listActiveWithTodayCompleted()` (ASSIGNED + 당일 COMPLETED) |
| `dispatch/repository/DispatchOrderRepository.java` | `findByStatusAndCompletedAtAfterAndDeletedAtIsNull` |
| `dispatch/controller/DispatchOrderReadController.java` | 모니터 조회(`includeCompleted`) 노출 |
| `dispatch/controller/DispatchOrderCommandController.java` | `PATCH /{id}` |
| `dispatch/dto/DispatchOrderReadResponse.java` | 변경 없음 (status·completedAt 이미 노출) |
| 프론트 `lib/services/service-ops-api.ts` | `updateDispatchOrder` + 모니터 조회 + 타입 |
| 프론트 `app/dispatch/actions.ts` | update/cancel/모니터 액션 |
| 프론트 `components/management/DispatchMonitorTable.tsx` | 액션형 + 상태/진행률 + 폴링 |
| 프론트 `components/management/DispatchOrderEditDialog.tsx` | 신규 |
| `DispatchOrder*ContractTests` | 편집·재배정·거부·감사 검증 |

## 10. 검증 계획

- 백엔드: `./gradlew.bat compileJava compileTestJava` + (Docker 있으면) 편집 계약테스트.
- 프론트: typecheck/lint.
- 런타임: 배포/사용자 dev에서 — 엑셀 적재 → 모니터에서 수정(주소·차량·순번)·취소 → 반영 확인, 라이더 완료 시 진행률 갱신 확인.
