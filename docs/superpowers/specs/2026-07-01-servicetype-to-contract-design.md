# 서비스유형 저장을 차량 → 매칭(계약)으로 이동 Design

**Date:** 2026-07-01
**Branch:** `cc-servicetype-to-contract` (off `dev`)
**Status:** Approved (design), pending spec review
**Asana:** (CLEVER) SI-썬더크루 → "웹사이트 수정 사항" #1 파생 결정

---

## 1. 배경 / 결정

서비스유형(CALL·SINGLE·SEQUENTIAL·ROUND·OTHER)은 지금 `bikes.service_type`(차량)에 저장된다.
그러나 운영상 서비스유형은 **매칭(라이더-차량 배정) 시점에 결정**되는 값이다. 재매칭하면 덮어써지고
계약별 이력이 남지 않는 현재 구조가 부정확하다. **결정: serviceType 저장을 차량에서 떼어
매칭(계약, `RiderBikeContract`)으로 이동.**

**핵심 원칙:** 차량의 serviceType = **그 차량의 활성계약의 serviceType**, 활성계약이 없으면 **OTHER(기타)**.

---

## 2. 목표 / 비목표

**목표**
- serviceType를 `rider_bike_contracts.service_type`로 이동, `bikes.service_type` 제거.
- serviceType를 읽는 모든 경로(표시 12 + 로직 8)를 "활성계약 경유(없으면 OTHER)"로 재배선.
- serviceType 설정을 매칭(계약)으로 일원화 — 차량 등록/수정 폼·차량 벌크에서 제거, 매칭 엑셀은 계약에 기록.

**비목표**
- 다중값(Set) — 아님(활성계약 1개 컨벤션, 차량당 serviceType 1개).
- 활성계약 유일성 DB 하드 제약 — 안 함(기존 데이터 충돌 위험). `limit 1`(최신 start_at) 컨벤션 유지.
- `BikeServiceType` enum 자체 변경 — 없음(값·라벨 그대로, 저장 위치만 이동).
- 프론트 응답 계약(각 차량/핀/계약이 serviceType 필드 보유) — 유지(소스만 계약, 미계약=OTHER라 null 없음).

---

## 3. 데이터 모델 / 마이그레이션 (V50)

현재: `bikes.service_type varchar(20) NOT NULL`, CHECK `ck_bikes_service_type in (5값)`, 인덱스
`ix_bikes_service_type_active`. `rider_bike_contracts`(테이블, `V2` 생성)에는 serviceType 없음.

**V50 순서** (제약위반·아웃티지 회피 — [[feedback_migration_constraint_order]]):
1. `alter table rider_bike_contracts add column service_type varchar(20)` (nullable로 생성).
2. 백필: `update rider_bike_contracts c set service_type = (select b.service_type from bikes b where b.id = c.bike_id)` — 모든 계약(활성+종료)에 그 차량의 현재값. 차량이 없는 고아 계약(있으면)은 `'OTHER'`.
3. `alter table rider_bike_contracts alter column service_type set default 'OTHER'`, `... set not null`.
4. `alter table rider_bike_contracts add constraint ck_rider_bike_contracts_service_type check (service_type in ('CALL','SINGLE','SEQUENTIAL','ROUND','OTHER'))`.
5. 인덱스: `create index ix_rbc_service_type_active on rider_bike_contracts(service_type) where terminated_at is null and deleted_at is null` (배차/필터 조회용).
6. `bikes`: `drop constraint ck_bikes_service_type`, `drop index ix_bikes_service_type_active`, `drop column service_type`.

(2에서 CHECK 없는 상태로 백필 → 4에서 CHECK 추가하므로 중간 위반 없음.)

---

## 4. 활성계약 해석 (공용)

**차량 → serviceType 해석 규칙:** `serviceTypeOf(bikeId)` =
`riderBikeContractRepository.findActiveByBikeId(bikeId).map(RiderBikeContract::getServiceType).orElse(BikeServiceType.OTHER)`.
- 활성 = `terminated_at IS NULL AND deleted_at IS NULL`, 최신 1개(`limit 1`, 기존 쿼리 컨벤션).
- 미계약/미해결 → **OTHER**.

**엔티티:** `RiderBikeContract`에 `@Enumerated(EnumType.STRING) @Column(name="service_type", nullable=false, length=20) BikeServiceType serviceType` 추가. `create(...)`에 serviceType 파라미터 추가하되 **null이면 팩토리가 OTHER로 강제**(JPA insert 시 null이면 NOT NULL 위반이므로 DB default에 의존하지 않고 엔티티 레벨에서 보장) → **어떤 계약 생성 경로가 serviceType를 안 넘겨도 안전(OTHER)**. `updateServiceType(BikeServiceType)` 뮤테이터 추가.
`Bike`에서 `serviceType` 필드·getter·`create`/`updateBasicProfile`의 serviceType 파라미터 제거.

---

## 5. 읽기 재배선 — 표시(DISPLAY)

| 위치 | 지금 | 이후 |
|------|------|------|
| `DashboardMapQueryRepository` (raw SQL) | `select b.service_type from bikes b` | 활성계약 LEFT JOIN + `COALESCE(ac.service_type,'OTHER')`. 다중 활성계약 방지 위해 `DISTINCT ON (b.id) ... order by b.id, ac.start_at desc` 또는 LATERAL로 1개만. (기존에도 rider_bike_contracts JOIN 있음 — 카디널리티 주의해 확장.) |
| `DashboardMapStateService` | `row.serviceType()` | 무변경(row가 COALESCE 값 보유) |
| `BikeReadResponse.from(bike)` | `bike.getServiceType()` | 호출 서비스가 `serviceTypeOf(bike.id)` 주입 |
| `ContractReadService` → `RiderBikeContractReadResponse` | `bike.getServiceType()` | `contract.getServiceType()`(자연스러움) |
| `RiderVehicleReadService` | `bike.getServiceType()` | 이미 활성계약 로드됨(line 40) → `contract.getServiceType()`(없으면 OTHER) |

프론트 응답 필드(`BikePin.serviceType`, `BikeReadResponse.serviceType`, `RiderVehicleResponse.serviceType`,
`RiderBikeContractReadResponse.serviceType`)는 **그대로 유지**(항상 값 있음, 미계약=OTHER).

---

## 6. 읽기 재배선 — 로직(LOGIC)

각 서비스가 대상 차량의 활성계약 serviceType로 판정(없으면 OTHER → 타입 가드 자연 불일치).

| 서비스 | 지금 | 이후 |
|--------|------|------|
| `DeliveryCallService` | `filter(b -> b.getServiceType()==CALL)`, 검증 `!=CALL` | 후보 차량들의 활성계약 serviceType 배치 조회(bikeId→type 맵) 후 CALL 필터/검증 |
| `DispatchOrderBulkService` | `bike.getServiceType()!=SINGLE/SEQUENTIAL` (행 루프) | 행별 차량 활성계약 serviceType로 검증. 에러메시지도 그 값 사용 |
| `DispatchRoundService` | `bike.getServiceType()!=ROUND` | 차량 활성계약 serviceType로 검증 |
| `BikeNextCustomerService` | `!bike.getServiceType().isCleaningFamily()` | 활성계약 serviceType로 `isCleaningFamily()` 판정(OTHER=배송패밀리) |

`BikeServiceType.isCleaningFamily()`(enum 메서드) 유지 — 이제 계약에서 얻은 값에 호출.
배치 조회 헬퍼(예: `RiderBikeContractRepository.findActiveByBikeIdIn(Collection<UUID>)` → `Map<UUID,BikeServiceType>`)를 추가해 N+1 회피.

---

## 7. 쓰기 재배선

| 위치 | 지금 | 이후 |
|------|------|------|
| `ContractBulkService.apply` | Excel col1 → `bike.updateBasicProfile(...,st,...)` (차량에 씀) | 생성/갱신하는 **계약에** serviceType 기록(`create(...,st)` / `updateServiceType(st)`). 공란/미인식 → OTHER |
| `ContractBulkService.export`/log | `serviceTypeLabel(bike.getServiceType())` | `serviceTypeLabel(contract.getServiceType())` |
| `BikeCommandService.create/update` | serviceType 기본 SINGLE / 요청값 반영 | serviceType 제거 |
| `BikeCreateRequest`/`BikeUpdateRequest` | `serviceType` 필드 | 제거 |
| `BikeBulkService.apply` | 신규차량 `SINGLE` 하드코딩 | serviceType 미설정(차량은 이제 serviceType 안 가짐) |

계약을 만드는 다른 경로(계약 command 서비스가 있으면)도 serviceType 세팅(기본 OTHER 또는 요청값) — 탐색 시 확인.

---

## 8. 프론트엔드

- **차량 등록(`CreateVehicleDialog`)·수정(`VehicleDetailDialog` 편집폼)에서 서비스유형 select 제거** — 서비스유형은 매칭에서만 설정.
- 표시(차량상세 뷰 "운영 방식", 지도 마커, 매칭 패널)는 응답의 serviceType 그대로 사용 — 미계약=OTHER("기타")라 **null 케이스 없음**, 기존 `serviceTypeLabel` 그대로.
- 지도 필터(`ServiceTypeFilterTabs`)는 무변경 — 미계약 차량은 OTHER 버킷에 뜸.
- 관련 프론트 타입(`ServiceOpsBike`/`FrontendVehicle`의 serviceType)은 유지. 차량 생성/수정 input 타입에서 serviceType 제거.

---

## 9. 테스트

**백엔드 계약테스트 갱신(Testcontainers/Docker 필요 — 환경상 미실행 가능, 그 경우 컴파일+로직리뷰로 보완 명시):**
- `BikeCommandApiContractTests`: 차량 생성/수정 응답에서 serviceType 제거/기대치 조정(이제 차량이 안 가짐 → 응답 필드가 활성계약 경유거나 제거).
- `ContractBulkApiTests`: 매칭 엑셀 col1 → **계약** serviceType 기록·export 검증.
- `DeliveryCallApiContractTests`/`DispatchOrderApiContractTests`/`DispatchRoundApiContractTests`: 대상 차량에 해당 serviceType의 **활성계약**을 세팅해야 가드 통과하도록 픽스처 수정.
- `BikeNextCustomerApiContractTests`: cleaning 판정이 계약 serviceType 기반.
- `DashboardMapApiContractTests`: 핀 serviceType이 활성계약(없으면 OTHER)에서 옴.
- `RiderSelfReadApiContractTests`/`RiderDriverApiContractTests`: 라이더 차량 응답 serviceType이 계약에서.
- `BikeBulkApiTests`: 차량 벌크가 serviceType 안 건드림.
- 신규 단위 테스트: `serviceTypeOf`(활성계약 있음→그 값 / 없음→OTHER), 배치 조회 헬퍼.

---

## 10. 엣지 / 불변식
- 미계약 차량 → OTHER(모든 표시·로직에서). 지도 핀은 계속 표시(LEFT JOIN, INNER 아님).
- 다중 활성계약(컨벤션 위반 데이터)이 있어도 대시보드 SQL은 최신 1개만(DISTINCT ON), 서비스 조회는 `findActiveByBikeId`(limit 1)로 일관.
- 매칭 엑셀 공란/미인식 라벨 → 계약 serviceType = OTHER(차량 삭제 아님).
- 마이그레이션: 신규 컬럼 CHECK를 백필 뒤 추가(중간 위반 없음), 구 컬럼/제약/인덱스 마지막 제거.

---

## 11. 손대는 파일 요약 (백엔드 중심)

| 파일 | 변경 |
|------|------|
| `db/migration/V50__move_service_type_to_contract.sql` | 신규 마이그레이션 |
| `contract/domain/RiderBikeContract.java` | serviceType 필드+create/mutator |
| `contract/repository/RiderBikeContractRepository.java` | `findActiveByBikeIdIn` 배치 조회 추가 |
| `bike/domain/Bike.java` | serviceType 필드·getter·파라미터 제거 |
| `bike/dto/BikeCreateRequest.java`·`BikeUpdateRequest.java` | serviceType 제거 |
| `bike/service/BikeCommandService.java`·`BikeBulkService.java` | serviceType 세팅 제거 |
| `bike/dto/BikeReadResponse.java` (+read 서비스) | serviceType 소스=활성계약 |
| `dashboard/repository/DashboardMapQueryRepository.java` | SQL 활성계약 JOIN+COALESCE OTHER |
| `dispatch/service/DeliveryCallService.java`·`DispatchOrderBulkService.java`·`DispatchRoundService.java` | 계약 경유 판정 |
| `bike/service/BikeNextCustomerService.java` | 계약 경유 cleaning 판정 |
| `contract/service/ContractBulkService.java` | serviceType를 계약에 read/write |
| `contract/service/ContractReadService.java`·`rider/service/RiderVehicleReadService.java` | 계약 serviceType 소스 |
| 프론트 `CreateVehicleDialog.tsx`·`VehicleDetailDialog.tsx` | serviceType 폼 필드 제거 |
| 프론트 타입/입력 (`service-ops-api.ts` 등) | 차량 create/update input에서 serviceType 제거 |
| 다수 계약테스트 | 픽스처/기대치 갱신 |

---

## 12. 검증 계획
- 백엔드: 영향 계약테스트(Docker 필요 시 미실행 명시) + `./gradlew compileJava`로 전체 컴파일.
- 프론트: `npm run typecheck`, `npm run lint`.
- 런타임(지도 미계약 차량=기타 표시, 매칭 엑셀→계약 반영)은 경쟁 dev 서버 금지 규칙상 사용자 dev/릴리즈 후 QA.
