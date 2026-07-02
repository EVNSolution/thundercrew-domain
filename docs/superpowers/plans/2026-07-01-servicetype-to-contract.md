# 서비스유형 저장 차량→매칭(계약) 이동 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `serviceType` 저장을 `bikes.service_type`에서 `rider_bike_contracts.service_type`로 옮기고, 모든 읽기/쓰기 경로를 "활성계약 경유(없으면 OTHER)"로 재배선한다.

**Architecture:** 차량의 serviceType = 활성계약(terminated/deleted null, 최신 1개)의 값, 미계약이면 OTHER. 표시 경로는 활성계약에서 소싱, 배차/검증 로직은 대상 차량의 활성계약 serviceType로 판정, 매칭 엑셀·UI는 계약에 기록. 차량 등록/수정에서 serviceType 제거.

**Tech Stack:** Java 21 / Spring Boot / Gradle / Flyway / 순수 JDBC(대시보드) + JPA, Next.js/TypeScript(프론트).

**Worktree:** `C:\Users\user\.config\superpowers\worktrees\thundercrew-domain\cc-servicetype-to-contract` (branch `cc-servicetype-to-contract`, off `dev`). Bash 툴(git-bash). 메인 체크아웃 건드리지 말 것.

**Reference spec:** `docs/superpowers/specs/2026-07-01-servicetype-to-contract-design.md`

**중요(빌드/테스트):** 백엔드 계약테스트는 Testcontainers/Docker 필요 — 이 환경에서 미실행일 수 있음. 각 태스크는 **`./gradlew.bat compileJava` + `compileTestJava`로 컴파일**을 1차 게이트로 삼고, 테스트는 가능하면 실행(안 되면 미실행 명시). git-bash에서 `./gradlew.bat ...` 사용.

---

## Task 1: V50 마이그레이션 — service_type를 계약으로 이동

**Files:**
- Create: `development/backend/src/main/resources/db/migration/V50__move_service_type_to_contract.sql`

- [ ] **Step 1: 마이그레이션 작성**

```sql
-- rider_bike_contracts 에 service_type 추가 (nullable 로 시작 → 백필 → NOT NULL + CHECK)
alter table rider_bike_contracts add column service_type varchar(20);

-- 각 계약을 그 차량의 현재 serviceType 으로 백필. 차량이 없는 고아 계약은 OTHER.
update rider_bike_contracts c
   set service_type = coalesce((select b.service_type from bikes b where b.id = c.bike_id), 'OTHER');

alter table rider_bike_contracts alter column service_type set default 'OTHER';
alter table rider_bike_contracts alter column service_type set not null;
alter table rider_bike_contracts add constraint ck_rider_bike_contracts_service_type
    check (service_type in ('CALL', 'SINGLE', 'SEQUENTIAL', 'ROUND', 'OTHER'));
create index ix_rbc_service_type_active
    on rider_bike_contracts(service_type)
    where terminated_at is null and deleted_at is null;

-- bikes 에서 service_type 제거 (제약·인덱스 먼저)
alter table bikes drop constraint if exists ck_bikes_service_type;
drop index if exists ix_bikes_service_type_active;
alter table bikes drop column service_type;
```

- [ ] **Step 2: 커밋** (Flyway 검증은 이후 컴파일/테스트 태스크에서 컨테이너 기동 시 확인)

```bash
cd development/backend && git add src/main/resources/db/migration/V50__move_service_type_to_contract.sql
git commit -m "$(cat <<'EOF'
feat(db): V50 — service_type를 bikes에서 rider_bike_contracts로 이동

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: RiderBikeContract 엔티티 + 리포지토리

**Files:**
- Modify: `development/backend/.../contract/domain/RiderBikeContract.java`
- Modify: `development/backend/.../contract/repository/RiderBikeContractRepository.java`

- [ ] **Step 1: 엔티티에 serviceType 추가** (`RiderBikeContract.java`)

import 추가: `import com.thundercrew.opsapi.bike.domain.BikeServiceType;`, `import jakarta.persistence.Enumerated;`, `import jakarta.persistence.EnumType;`

필드 추가(memo 아래):
```java
    @Enumerated(EnumType.STRING)
    @Column(name = "service_type", nullable = false, length = 20)
    private BikeServiceType serviceType;
```

`create(...)` 시그니처에 `BikeServiceType serviceType` 파라미터 추가(마지막), 본문에서 **null이면 OTHER 강제**:
```java
    public static RiderBikeContract create(
            UUID riderId,
            UUID bikeId,
            UUID contractTemplateId,
            Instant startAt,
            Instant endAt,
            String memo,
            BikeServiceType serviceType
    ) {
        RiderBikeContract contract = new RiderBikeContract();
        contract.riderId = riderId;
        contract.bikeId = bikeId;
        contract.contractTemplateId = contractTemplateId;
        contract.startAt = startAt;
        contract.endAt = endAt;
        contract.memo = memo;
        contract.serviceType = serviceType != null ? serviceType : BikeServiceType.OTHER;
        return contract;
    }
```

getter + 뮤테이터 추가:
```java
    public BikeServiceType getServiceType() {
        return serviceType;
    }

    public void updateServiceType(BikeServiceType serviceType) {
        if (serviceType != null) {
            this.serviceType = serviceType;
        }
    }
```

- [ ] **Step 2: 리포지토리에 배치 조회 추가** (`RiderBikeContractRepository.java`)

`findActiveByBikeId` 아래에 추가 — 여러 차량의 활성계약을 한 번에(N+1 회피). native 결과를 엔티티로 매핑:
```java
    @Query(value = """
            select distinct on (bike_id) *
            from rider_bike_contracts
            where bike_id in (:bikeIds)
              and terminated_at is null
              and deleted_at is null
            order by bike_id, start_at desc
            """, nativeQuery = true)
    java.util.List<RiderBikeContract> findActiveByBikeIdIn(@Param("bikeIds") java.util.Collection<UUID> bikeIds);
```
(호출부에서 `Map<UUID,BikeServiceType>`로 접어 사용.)

- [ ] **Step 3: 컴파일**

Run: `cd development/backend && ./gradlew.bat compileJava`
Expected: BUILD SUCCESSFUL. (아직 `create` 호출부 2곳이 6-인자라 실패할 수 있음 → Task 4에서 갱신. 이 태스크는 엔티티/리포 컴파일만 확인하고 호출부는 Task 4에서 함께 green. 만약 여기서 create 호출부 때문에 실패하면 Task 4의 create 호출부 수정까지 같은 커밋 범위로 당겨 처리.)

- [ ] **Step 4: 커밋**

```bash
cd development/backend && git add src/main/java/com/thundercrew/opsapi/contract/domain/RiderBikeContract.java src/main/java/com/thundercrew/opsapi/contract/repository/RiderBikeContractRepository.java
git commit -m "$(cat <<'EOF'
feat(contract): RiderBikeContract에 serviceType(+null→OTHER) + 활성계약 배치조회

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

> **주의(Task 2·4 결합):** `RiderBikeContract.create`는 호출부가 2곳(ContractBulkService, RiderBikeContractCommandService)이라, create 시그니처를 바꾸면 컴파일이 깨진다. Task 2와 Task 4를 **연속**으로 실행하고, compileJava green은 Task 4 끝에서 확인한다(중간 커밋은 허용).

---

## Task 3: Bike에서 serviceType 제거 (엔티티·DTO·커맨드·벌크)

**Files:**
- Modify: `development/backend/.../bike/domain/Bike.java`
- Modify: `development/backend/.../bike/dto/BikeCreateRequest.java`, `BikeUpdateRequest.java`
- Modify: `development/backend/.../bike/service/BikeCommandService.java`
- Modify: `development/backend/.../bike/service/BikeBulkService.java`

- [ ] **Step 1: `Bike.java`** — `serviceType` 필드·`@Column`·getter 제거. `create(...)`·`updateBasicProfile(...)` 시그니처에서 `BikeServiceType serviceType` 파라미터 및 관련 대입 라인 제거. `BikeServiceType` import 제거.

- [ ] **Step 2: `BikeCreateRequest.java`·`BikeUpdateRequest.java`** — `BikeServiceType serviceType` 레코드 컴포넌트 및 관련 import/주석 제거.

- [ ] **Step 3: `BikeCommandService.java`** — create의 `BikeServiceType serviceType = ... SINGLE ...` 및 `Bike.create(..., serviceType, ...)` 인자 제거; update의 `updateBasicProfile(..., request.serviceType(), ...)`에서 serviceType 인자 제거. `BikeServiceType` import 제거.

- [ ] **Step 4: `BikeBulkService.java`** — 신규차량 `Bike.create(..., BikeServiceType.SINGLE, ...)`에서 serviceType 인자 제거; `updateBasicProfile(...)` 호출에서 serviceType 인자 제거. `BikeServiceType` import 제거.

- [ ] **Step 5: 컴파일** (Task 5-8 완료 전까지 다른 reader가 깨질 수 있으므로, 이 태스크는 **위 4파일 자체의 문법**만 확인하고 전체 green은 Task 8에서. 가능하면 `./gradlew.bat compileJava`로 남은 깨진 참조 목록을 수집해 다음 태스크 입력으로.)

Run: `cd development/backend && ./gradlew.bat compileJava 2>&1 | grep -A2 "error:" | head -60`
Expected: 남은 에러는 전부 "다른 reader가 bike.getServiceType() 호출" (Task 5-8 대상). 이 파일들 자체 문법 에러는 없어야 함.

- [ ] **Step 6: 커밋**

```bash
cd development/backend && git add src/main/java/com/thundercrew/opsapi/bike/
git commit -m "$(cat <<'EOF'
refactor(bike): Bike에서 serviceType 제거 (엔티티·DTO·커맨드·벌크)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: 계약 쓰기 경로 — 매칭 엑셀·UI가 serviceType를 계약에 기록

**Files:**
- Modify: `development/backend/.../contract/service/ContractBulkService.java`
- Modify: `development/backend/.../contract/service/RiderBikeContractCommandService.java`
- Modify: `development/backend/.../contract/dto/RiderBikeContractCreateRequest.java`

- [ ] **Step 1: `ContractBulkService.apply`** — 현재 (lines ~99-115) col1 파싱값을 **차량**에 쓰는 부분을 삭제하고, 생성/갱신하는 **계약**에 반영:
  - 기존 `bike.get().updateBasicProfile(null,null,null,null,st,null); bikeRepository.save(...)` 블록 제거.
  - 신규 계약: `RiderBikeContract.create(rider, bike, template, startAt, endAt, null, st)` (마지막 인자 st, null이면 팩토리가 OTHER).
  - 기존 계약 갱신 분기: `existing.get().updateServiceType(st); existing.get().updateDates(...); contractRepository.save(existing.get());` (st 공란/미인식이면 null → 무변경).
  - `st = parseServiceType(cell(cols,1))`는 유지.

- [ ] **Step 2: `ContractBulkService.export`/`exportLog`** — `serviceTypeLabel(bike.getServiceType())` → `serviceTypeLabel(c.getServiceType())` (계약 `c` 사용). export의 col1, exportLog의 svcType 둘 다.

- [ ] **Step 3: `RiderBikeContractCreateRequest.java`** — `BikeServiceType serviceType`(nullable) 컴포넌트 추가(import 포함).

- [ ] **Step 4: `RiderBikeContractCommandService.create`** — `RiderBikeContract.create(...)` 호출에 `request.serviceType()` 추가(null이면 팩토리가 OTHER). update 경로에 serviceType 변경을 원하면 `RiderBikeContractUpdateRequest`+`contract.updateServiceType(...)`도 추가(선택 — 최소구현은 create만).

- [ ] **Step 5: 컴파일**

Run: `cd development/backend && ./gradlew.bat compileJava`
Expected: 계약 관련 파일 + `RiderBikeContract.create` 호출부 2곳 모두 정합. (남은 에러는 Task 5-8의 bike.getServiceType reader들.)

- [ ] **Step 6: 커밋**

```bash
cd development/backend && git add src/main/java/com/thundercrew/opsapi/contract/
git commit -m "$(cat <<'EOF'
feat(contract): 매칭 엑셀·UI가 serviceType를 계약에 기록 (차량 대신)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 표시 읽기 재배선 (계약/라이더/차량 응답)

**Files:**
- Modify: `development/backend/.../contract/service/ContractReadService.java`
- Modify: `development/backend/.../rider/service/RiderVehicleReadService.java`
- Modify: `development/backend/.../bike/dto/BikeReadResponse.java` + 그 호출 서비스(BikeReadService 등)

- [ ] **Step 1: `ContractReadService`** (line ~87) — `RiderBikeContractReadResponse.from(..., bike.getServiceType())` → `contract.getServiceType()`. (계약 응답이 계약의 serviceType 직접 사용.)

- [ ] **Step 2: `RiderVehicleReadService`** (line ~59) — 이미 활성계약을 로드(line ~40)하므로, `RiderVehicleResponse(..., bike.getServiceType(), ...)`를 `contract.getServiceType()`로. 활성계약이 없을 수 있으면 `contract != null ? contract.getServiceType() : BikeServiceType.OTHER`.

- [ ] **Step 3: `BikeReadResponse`** — `from(Bike bike)`가 `bike.getServiceType()`를 쓰던 것을, 활성계약 기반 값으로. `from`에 `BikeServiceType serviceType` 파라미터를 추가하고, 호출 서비스(bike read/list)가 `riderBikeContractRepository.findActiveByBikeId(bike.getId()).map(RiderBikeContract::getServiceType).orElse(BikeServiceType.OTHER)`를 주입. (호출 서비스에 repository 의존성 추가.)

- [ ] **Step 4: 컴파일** — `cd development/backend && ./gradlew.bat compileJava` → 이 3경로 정합 확인(배차/대시보드는 Task 6-7).

- [ ] **Step 5: 커밋**

```bash
cd development/backend && git add src/main/java/com/thundercrew/opsapi/contract/service/ContractReadService.java src/main/java/com/thundercrew/opsapi/rider/service/RiderVehicleReadService.java src/main/java/com/thundercrew/opsapi/bike/dto/BikeReadResponse.java src/main/java/com/thundercrew/opsapi/bike/service/
git commit -m "$(cat <<'EOF'
refactor(read): 계약/라이더/차량 응답 serviceType를 활성계약(없으면 OTHER)에서 소싱

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: 대시보드 SQL — 활성계약 serviceType + OTHER 폴백

**Files:**
- Modify: `development/backend/.../dashboard/repository/DashboardMapQueryRepository.java`

- [ ] **Step 1:** `findCurrentBikeStates`의 raw SQL(대략 lines 41-85)에서 `b.service_type`(line ~47)을, 이미 존재하는 `left join lateral (... from rider_bike_contracts c ...)`(line ~68) 안에서 `c.service_type`를 노출하도록 하고 SELECT를 `coalesce(c.service_type, 'OTHER') as service_type`로 변경. lateral이 활성(terminated/deleted null) + 최신 1개를 고르는지 확인하고 아니면 그렇게 보정(`order by c.start_at desc limit 1`).

- [ ] **Step 2:** `mapBikePinRow`(line ~113) `BikeServiceType.valueOf(rs.getString("service_type"))`는 그대로 동작(값이 항상 있음, COALESCE OTHER).

- [ ] **Step 3: 컴파일 + (가능시) 대시보드 계약테스트**

Run: `cd development/backend && ./gradlew.bat compileJava`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 4: 커밋**

```bash
cd development/backend && git add src/main/java/com/thundercrew/opsapi/dashboard/repository/DashboardMapQueryRepository.java
git commit -m "$(cat <<'EOF'
refactor(dashboard): 핀 serviceType를 활성계약(없으면 OTHER)에서 소싱

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: 배차/검증 로직 — 활성계약 경유 판정

**Files:**
- Modify: `development/backend/.../dispatch/service/DeliveryCallService.java`
- Modify: `development/backend/.../dispatch/service/DispatchOrderBulkService.java`
- Modify: `development/backend/.../dispatch/service/DispatchRoundService.java`
- Modify: `development/backend/.../bike/service/BikeNextCustomerService.java`

각 서비스에 `RiderBikeContractRepository` 의존성 주입. 헬퍼: 단건은 `findActiveByBikeId(id).map(RiderBikeContract::getServiceType).orElse(BikeServiceType.OTHER)`, 다건은 `findActiveByBikeIdIn(ids)`를 `Map<UUID,BikeServiceType>`로 접기.

- [ ] **Step 1: `DeliveryCallService`** — line ~46 `.filter(b -> b.getServiceType() == CALL)`: 후보 bikeId들의 활성계약 맵을 미리 만들고 `.filter(b -> svcMap.getOrDefault(b.getId(), OTHER) == CALL)`. line ~76 `if (bike.getServiceType() != CALL)` → `if (serviceTypeOf(bike.getId()) != CALL)`.

- [ ] **Step 2: `DispatchOrderBulkService`** — lines ~80/146/214 `bike.getServiceType() != SINGLE/SEQUENTIAL`: 행별 `serviceTypeOf(bike.getId())`로 판정. 에러메시지의 `bike.getServiceType()`도 해석값 사용.

- [ ] **Step 3: `DispatchRoundService`** — line ~66 `bike.getServiceType() != ROUND` → `serviceTypeOf(bike.getId()) != ROUND`.

- [ ] **Step 4: `BikeNextCustomerService`** — line ~69 `!bike.getServiceType().isCleaningFamily()` → `!serviceTypeOf(bike.getId()).isCleaningFamily()` (OTHER=배송패밀리라 미계약 차량은 cleaning 아님).

- [ ] **Step 5: 컴파일 (전체 green 기대)**

Run: `cd development/backend && ./gradlew.bat compileJava && ./gradlew.bat compileTestJava`
Expected: **BUILD SUCCESSFUL** — 이제 `bike.getServiceType()` 참조가 전부 사라져 메인 소스 컴파일 완료. (`compileTestJava`는 테스트가 옛 serviceType API를 쓰면 실패 → Task 9에서 수정.)

- [ ] **Step 6: 커밋**

```bash
cd development/backend && git add src/main/java/com/thundercrew/opsapi/dispatch/ src/main/java/com/thundercrew/opsapi/bike/service/BikeNextCustomerService.java
git commit -m "$(cat <<'EOF'
refactor(dispatch): 배차/NextCustomer 가드를 활성계약 serviceType로 판정

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: 프론트 — 차량 수정 폼에서 serviceType 제거

**Files:**
- Modify: `development/frontend/components/management/VehicleDetailDialog.tsx`
- Modify: `development/frontend/app/actions.ts` (`updateVehicleFromOverviewAction`, `parseServiceType`)
- Modify: `development/frontend/lib/services/service-ops-api.ts` (VehicleUpdateInput/VehicleCreateInput serviceType)

- [ ] **Step 1: `VehicleDetailDialog.tsx`** — 수정 모드 폼의 `<label>운영 방식 <select name="serviceType">…</select></label>` 블록(대략 254-263행) 제거. **뷰 모드의 `<DetailField label="운영 방식" value={serviceTypeLabel(vehicle.serviceType)} />`(204행)는 유지**(이제 계약 유래 값 표시). `serviceTypeLabel` 헬퍼는 뷰에서 계속 쓰이므로 유지.

- [ ] **Step 2: `actions.ts`** — `updateVehicleFromOverviewAction`에서 `serviceType` 파싱/전송 라인 제거(`const serviceType = parseServiceType(...)` + `updateVehicle({..., serviceType, ...})`의 serviceType 키). 미사용이 된 `parseServiceType` 제거.

- [ ] **Step 3: `service-ops-api.ts`** — `VehicleUpdateInput`/`VehicleCreateInput`에서 `serviceType?` 제거, `updateVehicle`/`createVehicle`가 body에 serviceType를 안 넣도록. **`ServiceOpsBike`/`FrontendVehicle`의 `serviceType?`(응답 표시용)는 유지.**

- [ ] **Step 4: 검증**

```bash
cd development/frontend
[ -d node_modules ] || npm install
npm run typecheck && npm run lint
```
Expected: 에러 없음.

- [ ] **Step 5: 커밋**

```bash
cd development/frontend && git add components/management/VehicleDetailDialog.tsx app/actions.ts lib/services/service-ops-api.ts
git commit -m "$(cat <<'EOF'
refactor(frontend): 차량 수정 폼에서 serviceType 제거 (매칭에서만 설정)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: 계약테스트 갱신 + 최종 검증 + PR

**Files:** 백엔드 계약테스트 다수(아래), 검증/PR.

- [ ] **Step 1: `compileTestJava` 에러 수집** — `cd development/backend && ./gradlew.bat compileTestJava 2>&1 | grep -A2 "error:" | head -80`. 옛 serviceType API(예: `bike.getServiceType()`, `BikeCreateRequest(..., serviceType, ...)`, 응답의 serviceType 기대치)를 쓰는 테스트가 나온다.

- [ ] **Step 2: 테스트 픽스처/기대치 수정** — 대상(Explore 확인): `BikeCommandApiContractTests`(생성/수정 요청에서 serviceType 제거, 응답 기대치는 활성계약 없으면 OTHER), `ContractBulkApiTests`(엑셀 col1 → **계약** serviceType 저장·export 검증), `DeliveryCallApiContractTests`/`DispatchOrderApiContractTests`/`DispatchRoundApiContractTests`(대상 차량에 해당 serviceType의 **활성계약** 픽스처 생성 후 가드 통과), `BikeNextCustomerApiContractTests`(cleaning 계약), `DashboardMapApiContractTests`(핀 serviceType=활성계약/OTHER), `RiderSelfReadApiContractTests`/`RiderDriverApiContractTests`(라이더 차량 serviceType=계약), `BikeBulkApiTests`(차량 벌크가 serviceType 안 건드림). 각 테스트가 계약을 만드는 헬퍼가 있으면 serviceType 인자를 추가.

- [ ] **Step 3: 컴파일 + (가능시) 영향 테스트 실행**

Run: `cd development/backend && ./gradlew.bat compileJava compileTestJava`
Expected: BUILD SUCCESSFUL.
가능하면: `./gradlew.bat test --tests "com.thundercrew.opsapi.ContractBulkApiTests" --tests "com.thundercrew.opsapi.DeliveryCallApiContractTests" --tests "com.thundercrew.opsapi.DashboardMapApiContractTests"` (Docker 필요; 미기동이면 미실행 명시).

- [ ] **Step 4: 프론트 최종 검증** — `cd development/frontend && npm run typecheck && npm run lint`.

- [ ] **Step 5: 커밋 + push + PR(→dev)**

```bash
cd development/backend && git add src/test/
git commit -m "$(cat <<'EOF'
test: serviceType 계약 이동에 맞춰 계약테스트 픽스처/기대치 갱신

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
git push -u origin cc-servicetype-to-contract
gh pr create --base dev --head cc-servicetype-to-contract --title "서비스유형 저장을 차량→매칭(계약)으로 이동" --body "$(cat <<'EOF'
## Summary
- `bikes.service_type` → `rider_bike_contracts.service_type` (V50: 계약 컬럼 추가→차량값 백필→차량 컬럼/제약/인덱스 제거).
- 차량 serviceType = 활성계약(terminated/deleted null, 최신 1개)의 값, **미계약이면 OTHER**. 지도 핀은 계속 표시.
- 표시(대시보드 SQL·계약·라이더·차량 응답) + 로직(배차 CALL/SINGLE/SEQUENTIAL/ROUND 가드, NextCustomer cleaning)을 활성계약 경유로 재배선.
- 매칭 엑셀·UI는 serviceType를 계약에 기록. 차량 등록/수정 폼·차량 벌크·DTO에서 serviceType 제거.
- 계약 팩토리가 null→OTHER 강제(생성 경로 누락 안전).

## Test Plan
- [ ] 백엔드 `compileJava`+`compileTestJava` 성공
- [ ] 영향 계약테스트(ContractBulk/DeliveryCall/Dispatch*/DashboardMap/RiderSelf/BikeNextCustomer/BikeBulk) 갱신·통과 (Docker 환경 기준)
- [ ] 프론트 typecheck/lint clean

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 6: finishing-a-development-branch** 스킬로 마무리.

---

## 자기검토 노트
- **스펙 커버리지:** 마이그레이션(T1)·엔티티/리포(T2)·차량제거(T3)·계약쓰기(T4)·표시읽기(T5)·대시보드SQL(T6)·로직읽기(T7)·프론트폼(T8)·테스트/PR(T9) — 스펙 §3-9 전부 매핑.
- **결정 반영:** 미계약=OTHER(T2 팩토리·T5·T6·T7), 폼 제거(T8·T3), 배차 계약경유(T7), 활성계약 limit-1(T2·T6 DISTINCT ON).
- **컴파일 결합 주의:** `RiderBikeContract.create`/`bike.getServiceType()` 시그니처 변경이 교차하므로 T2→T4는 연속, 전체 메인 컴파일 green은 **T7 끝**, 테스트 컴파일 green은 **T9**. 각 태스크 커밋은 부분적으로 컴파일 안 될 수 있음(리팩터 특성) — 구현자는 이를 인지하고 진행.
- **타입 정합:** `serviceTypeOf(UUID)→BikeServiceType`(OTHER 폴백), `RiderBikeContract.create(...,serviceType)`, `findActiveByBikeIdIn(Collection)→List` — 사용처 일치.
