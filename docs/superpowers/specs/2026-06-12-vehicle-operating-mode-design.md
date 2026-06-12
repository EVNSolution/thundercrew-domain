# 차량 운영 방식 (operating mode) — serviceType 5종 재분류 Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement the plan derived from this spec.

**Goal:** 차량 분류를 도메인 명(배송/클리닝/기타)에서 **배차 동작 방식 5종**으로 재정의한다 — `CALL`(콜 배차)/`SINGLE`(단일 배차)/`SEQUENTIAL`(순차 배차)/`ROUND`(왕복 배차)/`OTHER`(기타). 지도 필터·차량 편집폼이 이 5종을 쓰고, 기존 분기 로직(시동 알림·시스템 배차·시뮬레이션)은 "패밀리 멤버십"으로 매핑해 동작을 보존한다.

**Architecture:** 기존 `BikeServiceType` enum + `bikes.service_type` 컬럼을 **값만 in-place 교체**(타입명/컬럼명 유지 → 35개 사용처의 타입 참조는 그대로, 값 분기만 갱신). 새 컬럼/도메인을 만들지 않는다.

**Tech Stack:** Spring Boot (Java 21), Flyway, JPA, Next.js App Router, TypeScript.

**비범위:** 시스템 배차를 CALL 전용으로 좁히기, 마커 declutter/범례, 관리 테이블 검색/필터, 타입명·컬럼명 리네임(`BikeServiceType`/`service_type` 유지).

---

## 1. 운영 방식 5종

| enum | 라벨 | 동작 | 패밀리 |
|---|---|---|---|
| `CALL` | 콜 배차 | 단건 콜, 라이더 수락/시스템 자동 배차 (C1) | delivery |
| `SINGLE` | 단일 배차 | 목적지 1개 단순 배차 (C2) | delivery |
| `SEQUENTIAL` | 순차 배차 | 목적지 + 순서 큐 (C3) | cleaning |
| `ROUND` | 왕복 배차 | 일괄 수거 → 배송 2단계 (C4) | cleaning |
| `OTHER` | 기타 | 분류 외 | (delivery 동작) |

**패밀리(기존 동작 보존):**
- **cleaning-family** = `SEQUENTIAL ∪ ROUND` → 시동 알림 + 시뮬 cleaning phase(IDLE→MOVING, 목적지 기반).
- **delivery-family** = `CALL ∪ SINGLE ∪ OTHER` → 시뮬 delivery phase(자동 MOVING). (기존 DELIVERY+OTHER 동작.)
- **시스템 배차**(배민 콜 자동 배차) = `CALL ∪ SINGLE` 중 least-loaded (OTHER 제외; 기존 DELIVERY 동작 보존).

---

## 2. 백엔드 (service-ops-api)

### 2.1 enum
`bike/domain/BikeServiceType.java`: 값 교체 → `{ CALL, SINGLE, SEQUENTIAL, ROUND, OTHER }`. JavaDoc 갱신("차량 운영 방식").

### 2.2 마이그레이션 `V36__rebrand_bikes_service_type_to_operating_mode.sql`
```sql
-- 기존 분류 → 운영 방식 매핑
update bikes set service_type = 'SINGLE'     where service_type = 'DELIVERY';
update bikes set service_type = 'SEQUENTIAL' where service_type = 'CLEANING';
-- 'OTHER' 는 그대로 유지
-- check 제약 재생성
alter table bikes drop constraint ck_bikes_service_type;
alter table bikes add constraint ck_bikes_service_type
    check (service_type in ('CALL', 'SINGLE', 'SEQUENTIAL', 'ROUND', 'OTHER'));
-- 컬럼 기본값 변경 (기존 default 'DELIVERY')
alter table bikes alter column service_type set default 'SINGLE';
```
(`ix_bikes_service_type_active` 인덱스는 값 종류 무관 → 변경 없음.)

### 2.3 분기 로직 — 패밀리 헬퍼
`BikeServiceType` 에 헬퍼 추가(또는 서비스에서 집합 비교):
```java
public boolean isCleaningFamily() { return this == SEQUENTIAL || this == ROUND; }
public boolean isDeliveryFamily() { return this == CALL || this == SINGLE || this == OTHER; }
```
적용:
- **`DeliveryCallService.systemDispatch`**: `serviceType == DELIVERY` 필터 → `serviceType == CALL || serviceType == SINGLE` (OTHER 제외). 메시지 "가용 배송 차량" 유지.
- (기타 백엔드에서 serviceType 을 분기하는 곳이 있으면 동일하게 패밀리로. 구현 단계에서 grep — `DashboardMapStateService`/`BikeNextCustomerService` 등은 단순 노출이면 무변경.)

### 2.4 DTO·검증·엑셀
- `BikeCreateRequest`/`BikeUpdateRequest`/`BikeBulkService`: serviceType 값 검증/파싱을 새 5값으로. 엑셀 업로드의 serviceType 컬럼은 한글 라벨(콜 배차/단일 배차/순차 배차/왕복 배차/기타) ↔ enum 매핑(기존 매핑 방식 따라). export 도 새 라벨.
- `BikeReadResponse`/`DashboardMapStateResponse`: serviceType 그대로 노출(값만 바뀜).

### 2.5 테스트
serviceType 을 쓰는 계약 테스트(Bike, DeliveryCall least-loaded, Dashboard 등)의 시드/단언을 새 값으로 갱신. DeliveryCall 의 "DELIVERY 차량" 시드 → `SINGLE`/`CALL` 로, "CLEANING" → `SEQUENTIAL`. systemDispatch 가 CALL∪SINGLE 만 고르고 OTHER/SEQUENTIAL/ROUND 는 제외하는지 검증 추가.

---

## 3. 프론트엔드 (front-admin-web)

### 3.1 타입 + 라벨
- `ServiceOpsBikeServiceType` = `"CALL" | "SINGLE" | "SEQUENTIAL" | "ROUND" | "OTHER"`.
- 공용 라벨 매핑(콜 배차/단일 배차/순차 배차/왕복 배차/기타).

### 3.2 지도 필터
`ServiceTypeFilterTabs`: 탭 = 전체 + 콜 배차 + 단일 배차 + 순차 배차 + 왕복 배차 + 기타 (6칩). `ServiceTypeFilter = ServiceOpsBikeServiceType | "ALL"`. 필터 적용 로직은 serviceType 동등 비교 그대로.

### 3.3 차량 편집폼 + 표시
- `VehicleDetailDialog`: 상세 "서비스" 필드 라벨 → **"운영 방식"**, 값 = 새 라벨. 편집 모드 select(배송/클리닝/기타 3옵션) → 5옵션(CALL/SINGLE/SEQUENTIAL/ROUND/OTHER). `serviceTypeLabel` 헬퍼 갱신.
- `app/actions.ts`(updateVehicle…): serviceType 값 전달 그대로(값만 바뀜).

### 3.4 MapShell 배지
`MapShell` 의 serviceType 기반 배지 라벨/색 분기(`!serviceType || serviceType === "DELIVERY"` 등)를 패밀리 기준으로: cleaning-family(SEQUENTIAL/ROUND) = 기존 클리닝 라벨(이동 중/작업 중/대기 중), 그 외(CALL/SINGLE/OTHER) = 기존 배송 라벨(배송 중/대기). 헬퍼 `isCleaningFamily(serviceType)` 프론트 유틸.

### 3.5 시뮬레이션
`FleetSimulationContext`/`fleet-simulation.ts` 의 `serviceType === "CLEANING"` 분기(초기 phase, nextCustomer/currentDispatch 이동, 시동 알림 대상) → **cleaning-family(SEQUENTIAL∪ROUND)** 체크로. `ServiceType` 타입(프론트 시뮬)도 5값 또는 family 헬퍼로.

---

## 4. 데이터 흐름 / 영향
- enum 값 in-place 교체 → 타입 참조는 무변경, **값 분기 지점만** 패밀리/신규값으로 갱신.
- **V36 마이그레이션**(값 매핑 + 제약 재생성 + default) — 재기동 시 Flyway 적용. 엔티티 enum 과 DB 제약 값 일치 필수(불일치 시 기존 행 로드/검증 실패).

## 5. 검증
- 백엔드 `compileJava + compileTestJava`, 프론트 `typecheck + lint + build`.
- 프로덕션 QA: 지도 필터 6칩 동작(콜/단일/순차/왕복/기타) + 카운트 갱신, 차량 편집폼 운영 방식 5옵션, 시동 알림(순차/왕복 차량) 정상, 시스템 배차(콜·단일 차량만 자동 배정).

## 6. 비범위 재확인
타입명/컬럼명 리네임, 시스템배차 CALL 전용 좁히기, 마커 declutter/범례, 관리 테이블 필터는 이 스펙에 포함하지 않는다.
