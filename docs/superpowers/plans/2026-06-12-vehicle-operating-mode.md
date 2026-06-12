# 차량 운영 방식 (serviceType 5종 재분류) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `BikeServiceType` 값을 도메인명(DELIVERY/CLEANING/OTHER)에서 운영 방식 5종(CALL/SINGLE/SEQUENTIAL/ROUND/OTHER)으로 in-place 교체하고, 분기 로직을 패밀리 매핑(cleaning=SEQUENTIAL∪ROUND, delivery=CALL∪SINGLE∪OTHER)으로 전환해 동작을 보존한다.

**Architecture:** 타입명 `BikeServiceType`·컬럼 `service_type` 유지, 값만 교체(V36). 백엔드/프론트의 `=== "CLEANING"`/`=== "DELIVERY"` 분기를 패밀리 헬퍼로 교체. 지도 필터 6칩 + 차량 편집폼 5옵션.

**Tech Stack:** Spring Boot (Java 21), Flyway, JPA, Next.js App Router, TypeScript.

**작업 경로:** 백엔드 `development/service-ops-api`, 프론트 `development/front-admin-web`. Bash 절대경로 cd (cwd 매 호출 리셋). 브랜치 `cc-operating-mode` 체크아웃 — 새 브랜치 만들지 말 것. ArchUnit Docker 불필요, 계약 테스트 Docker 필요(컴파일만). 프론트 `npm run typecheck && lint && build`.

**매핑 (기준):**
- 값: `DELIVERY→SINGLE`, `CLEANING→SEQUENTIAL`, `OTHER→OTHER`(유지). 신규 `CALL`,`ROUND`.
- cleaning-family = `SEQUENTIAL ∪ ROUND` (시동알림·시뮬 cleaning phase). delivery-family = `CALL ∪ SINGLE ∪ OTHER`. 시스템배차 = `CALL ∪ SINGLE`.
- 라벨: CALL=콜 배차, SINGLE=단일 배차, SEQUENTIAL=순차 배차, ROUND=왕복 배차, OTHER=기타.

---

### Task 1: 백엔드 enum + V36 마이그레이션

**Files:**
- Modify: `development/service-ops-api/src/main/java/com/thundercrew/opsapi/bike/domain/BikeServiceType.java`
- Create: `development/service-ops-api/src/main/resources/db/migration/V36__rebrand_bikes_service_type_to_operating_mode.sql`

- [ ] **Step 1: enum 값 교체 + 패밀리 헬퍼**

`BikeServiceType.java` 전체 교체:
```java
package com.thundercrew.opsapi.bike.domain;

/**
 * 차량 운영 방식. 배차가 동작하는 방식으로 차량을 분류한다(필터·알림·시뮬 분기 축).
 */
public enum BikeServiceType {
    /** 콜 배차 — 단건 콜, 라이더 수락/시스템 자동 배차. */
    CALL,
    /** 단일 배차 — 목적지 1개 단순 배차. */
    SINGLE,
    /** 순차 배차 — 목적지 + 순서 큐. */
    SEQUENTIAL,
    /** 왕복 배차 — 일괄 수거 → 배송 2단계. */
    ROUND,
    /** 기타. */
    OTHER;

    /** 시동 알림·청소형 시뮬 대상(순차·왕복). */
    public boolean isCleaningFamily() {
        return this == SEQUENTIAL || this == ROUND;
    }

    /** 배송형 시뮬·시스템 배차 후보(콜·단일·기타). */
    public boolean isDeliveryFamily() {
        return !isCleaningFamily();
    }
}
```

- [ ] **Step 2: V36 마이그레이션**

`V36__rebrand_bikes_service_type_to_operating_mode.sql`:
```sql
-- 기존 분류 → 운영 방식 매핑 (OTHER 는 유지)
update bikes set service_type = 'SINGLE'     where service_type = 'DELIVERY';
update bikes set service_type = 'SEQUENTIAL' where service_type = 'CLEANING';
-- check 제약 재생성
alter table bikes drop constraint ck_bikes_service_type;
alter table bikes add constraint ck_bikes_service_type
    check (service_type in ('CALL', 'SINGLE', 'SEQUENTIAL', 'ROUND', 'OTHER'));
-- 컬럼 기본값 변경 (기존 default 'DELIVERY')
alter table bikes alter column service_type set default 'SINGLE';
```
(기존 `ck_bikes_service_type` 이름·`default 'DELIVERY'` 는 V25 에서 확인됨. 실제와 다르면 실제 이름 사용.)

- [ ] **Step 3: 컴파일**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/service-ops-api && ./gradlew compileJava -q
```
Expected: BUILD SUCCESSFUL.

- [ ] **Step 4: 커밋**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain && git add development/service-ops-api/src/main/java/com/thundercrew/opsapi/bike/domain/BikeServiceType.java development/service-ops-api/src/main/resources/db/migration/V36__rebrand_bikes_service_type_to_operating_mode.sql && git commit -m "feat(opmode): BikeServiceType 5-value operating mode + V36 migration"
```

---

### Task 2: 백엔드 분기 사이트 + 계약 테스트

**Files:**
- Modify: `.../bike/service/BikeBulkService.java`
- Modify: `.../dispatch/service/DeliveryCallService.java`
- Modify: 영향받는 계약 테스트들

- [ ] **Step 1: BikeBulkService 기본값**

READ `BikeBulkService.java`. 약 69행 `BikeServiceType.DELIVERY` (벌크 차량 생성 기본값)을 `BikeServiceType.SINGLE` 로 교체.

- [ ] **Step 2: DeliveryCallService 시스템 배차 필터**

READ `DeliveryCallService.java`. `systemDispatch` 의 DELIVERY 필터:
```java
.filter(b -> b.getServiceType() == BikeServiceType.DELIVERY)
```
를 시스템 배차 후보(콜∪단일)로 교체:
```java
.filter(b -> b.getServiceType() == BikeServiceType.CALL
        || b.getServiceType() == BikeServiceType.SINGLE)
```
(에러 메시지 "가용 배송 차량이 없습니다." 유지.)

- [ ] **Step 3: 다른 serviceType 분기 grep**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/service-ops-api && grep -rn "ServiceType\.\(DELIVERY\|CLEANING\)\|getServiceType() ==" src/main/java
```
나오는 곳(예상: 위 2곳 외 없음. DashboardMapStateService/BikeNextCustomerService 가 serviceType 을 단순 노출/저장만 하면 무변경)을 확인하고, **값 분기**가 있으면 패밀리 헬퍼(`isCleaningFamily()`/`isDeliveryFamily()`)로 교체. 단순 노출은 건드리지 말 것.

- [ ] **Step 4: 계약 테스트 갱신**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/service-ops-api && grep -rln "DELIVERY\|CLEANING\|service_type" src/test/java
```
serviceType 값을 시드/단언하는 테스트(특히 `DeliveryCallApiContractTests` 의 `seedDeliveryBike`(service_type='DELIVERY')→`'SINGLE'`, `seedCleaningBike`(='CLEANING')→`'SEQUENTIAL'`; 그 외 Bike/Dashboard 계약 테스트의 service_type 시드)를 새 값으로 교체. DeliveryCall 의 systemDispatch 테스트가 CALL/SINGLE 만 선택하고 SEQUENTIAL/ROUND/OTHER 는 제외하는지 단언 유지(seedCleaningBike 가 SEQUENTIAL 이 되며 자동으로 후보 제외됨 — 케이스3 "no delivery bike" 가 여전히 통과하도록 시드를 SEQUENTIAL 로). 헬퍼 메서드 SQL 의 service_type 리터럴도 교체.

- [ ] **Step 5: 컴파일 (main + test)**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/service-ops-api && ./gradlew compileJava compileTestJava -q
```
Expected: BUILD SUCCESSFUL. (계약 테스트 실행은 Docker 필요 → CI.)

- [ ] **Step 6: 커밋**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain && git add development/service-ops-api/src/main/java development/service-ops-api/src/test/java && git commit -m "feat(opmode): systemDispatch=CALL∪SINGLE, bulk default SINGLE, tests to new values"
```

---

### Task 3: 프론트 타입 + 필터 탭 + 라벨/헬퍼

**Files:**
- Modify: `lib/services/service-ops-api.ts`
- Modify: `lib/services/fleet-simulation.ts` (헬퍼만 추가)
- Modify: `components/overview/ServiceTypeFilterTabs.tsx`

- [ ] **Step 1: 타입 교체**

`lib/services/service-ops-api.ts` L134:
```ts
export type ServiceOpsBikeServiceType = "DELIVERY" | "CLEANING" | "OTHER";
```
→
```ts
export type ServiceOpsBikeServiceType = "CALL" | "SINGLE" | "SEQUENTIAL" | "ROUND" | "OTHER";
```
(다른 위치의 `| "OTHER"` (L397 부근)는 이 타입과 무관하면 건드리지 말 것 — grep 으로 해당 union 이 serviceType 인지 확인.)

- [ ] **Step 2: cleaning-family 헬퍼 (공용)**

`lib/services/fleet-simulation.ts` 의 `ServiceType` 정의(L11) 교체 + 헬퍼 export 추가:
```ts
export type ServiceType = "CALL" | "SINGLE" | "SEQUENTIAL" | "ROUND" | "OTHER";

/** 청소형(순차·왕복) 운영 방식 — 시동 알림 + 청소 시뮬 phase 대상. */
export function isCleaningServiceType(t: ServiceType | string | null | undefined): boolean {
  return t === "SEQUENTIAL" || t === "ROUND";
}
```

- [ ] **Step 3: ServiceTypeFilterTabs 6칩**

`components/overview/ServiceTypeFilterTabs.tsx` 의 `TABS` 교체:
```ts
const TABS: { value: ServiceTypeFilter; label: string }[] = [
  { value: "ALL", label: "전체" },
  { value: "CALL", label: "콜 배차" },
  { value: "SINGLE", label: "단일 배차" },
  { value: "SEQUENTIAL", label: "순차 배차" },
  { value: "ROUND", label: "왕복 배차" },
  { value: "OTHER", label: "기타" }
];
```
(`ServiceTypeFilter = ServiceOpsBikeServiceType | "ALL"` 그대로 — 새 값 자동 반영.)

- [ ] **Step 4: typecheck + lint**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web && npm run typecheck && npm run lint
```
Expected: 통과. (이 시점에 VehicleDetailDialog/MapShell/FleetSimulationContext 의 옛 값 비교가 타입 에러를 낼 수 있음 — Task 4/5 에서 정리. 만약 typecheck 가 실패하면 그 에러는 Task 4/5 대상 파일인지 확인하고, **이 태스크 범위(3개 파일)만** 통과하도록 두되 전체 통과는 Task 5 말미에 보장. 실패가 3개 파일 내부면 수정.)

- [ ] **Step 5: 커밋**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain && git add development/front-admin-web/lib/services/service-ops-api.ts development/front-admin-web/lib/services/fleet-simulation.ts development/front-admin-web/components/overview/ServiceTypeFilterTabs.tsx && git commit -m "feat(opmode): frontend type 5-value + cleaning-family helper + filter 6 chips"
```

---

### Task 4: VehicleDetailDialog — 라벨 + 편집 select + phase 라벨

**Files:**
- Modify: `components/management/VehicleDetailDialog.tsx`

- [ ] **Step 1: 상세 필드 라벨 + serviceTypeLabel 헬퍼**

L198 `<DetailField label="서비스" ...>` → `label="운영 방식"`.
`serviceTypeLabel` 헬퍼(L310–313):
```ts
function serviceTypeLabel(t?: ServiceOpsBikeServiceType): string {
  if (t === "CLEANING") return "클리닝";
  if (t === "OTHER") return "기타";
  return "배송";
}
```
→
```ts
function serviceTypeLabel(t?: ServiceOpsBikeServiceType): string {
  switch (t) {
    case "CALL": return "콜 배차";
    case "SINGLE": return "단일 배차";
    case "SEQUENTIAL": return "순차 배차";
    case "ROUND": return "왕복 배차";
    case "OTHER": return "기타";
    default: return "단일 배차";
  }
}
```

- [ ] **Step 2: 편집 select 5옵션**

L253–256:
```tsx
<select name="serviceType" defaultValue={vehicle.serviceType ?? "DELIVERY"}>
  <option value="DELIVERY">배송</option>
  <option value="CLEANING">클리닝</option>
  <option value="OTHER">기타</option>
</select>
```
→
```tsx
<select name="serviceType" defaultValue={vehicle.serviceType ?? "SINGLE"}>
  <option value="CALL">콜 배차</option>
  <option value="SINGLE">단일 배차</option>
  <option value="SEQUENTIAL">순차 배차</option>
  <option value="ROUND">왕복 배차</option>
  <option value="OTHER">기타</option>
</select>
```
편집 라벨도 "서비스 유형" → "운영 방식"(해당 `<label>` 텍스트가 있으면 교체).

- [ ] **Step 3: renderPhaseLabel 패밀리화**

L872–876:
```ts
function renderPhaseLabel(phase: SimulatedBikeState["phase"], serviceType: ServiceType): string {
  if (serviceType === "DELIVERY") {
    return phase === "MOVING" ? "배송 중" : "대기";
  }
  // CLEANING or OTHER
```
를 cleaning-family 기준으로:
```ts
function renderPhaseLabel(phase: SimulatedBikeState["phase"], serviceType: ServiceType): string {
  if (!isCleaningServiceType(serviceType)) {
    return phase === "MOVING" ? "배송 중" : "대기";
  }
  // cleaning-family (순차·왕복)
```
(나머지 블록 — 이동 중/작업 중/대기 중 — 유지.) `isCleaningServiceType` 를 `@/lib/services/fleet-simulation` 에서 import.

- [ ] **Step 4: typecheck + lint**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web && npm run typecheck && npm run lint
```
Expected: 통과(또는 잔여 에러가 Task 5 대상인 MapShell/FleetSimulationContext 면 그대로 — 이 파일 내부 에러는 0).

- [ ] **Step 5: 커밋**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain && git add development/front-admin-web/components/management/VehicleDetailDialog.tsx && git commit -m "feat(opmode): vehicle detail 운영 방식 label/select(5) + family phase label"
```

---

### Task 5: 시뮬 + MapShell 패밀리 분기

**Files:**
- Modify: `lib/services/fleet-simulation.ts`
- Modify: `components/overview/FleetSimulationContext.tsx`
- Modify: `components/dashboard/MapShell.tsx`

- [ ] **Step 1: fleet-simulation.ts 내부 CLEANING 분기**

READ. `serviceType === "CLEANING"` 으로 청소 phase(IDLE 시작, nextCustomerDestination 이동)를 분기하는 곳을 `isCleaningServiceType(serviceType)` 로 교체. `makeInitialState` 의 기본값 `serviceType = "DELIVERY"` → `"SINGLE"`. (Step 2(Task3)에서 export 한 `isCleaningServiceType` 사용 — 같은 파일이라 직접 호출.)

- [ ] **Step 2: FleetSimulationContext.tsx 분기**

READ. `pin?.serviceType === "CLEANING"` (L116,122,127,155 등) → `isCleaningServiceType(pin?.serviceType)`. 기본값 `serviceType: pin?.serviceType ?? "DELIVERY"`(L138) → `?? "SINGLE"`. `isCleaningServiceType` import 추가.

- [ ] **Step 3: MapShell.tsx 배지/말풍선 패밀리화**

READ. `serviceBadgeMarkup`(L754) 의 `if (!serviceType || serviceType === "DELIVERY")`(L757) → `if (!serviceType || !isCleaningServiceType(serviceType))` (delivery-family/미지정 = 배송 라벨). 주석(L750-751) 갱신. `showBubble`(L883) 의 `serviceType === "CLEANING"` → `isCleaningServiceType(serviceType)`. `isCleaningServiceType` import 추가.

- [ ] **Step 4: typecheck + lint + build**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web && npm run typecheck && npm run lint && npm run build
```
Expected: 전부 통과(전체 프론트에서 옛 "DELIVERY"/"CLEANING" 비교 잔존 0).

- [ ] **Step 5: 커밋**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain && git add development/front-admin-web/lib/services/fleet-simulation.ts development/front-admin-web/components/overview/FleetSimulationContext.tsx development/front-admin-web/components/dashboard/MapShell.tsx && git commit -m "feat(opmode): simulation + map badge use cleaning-family branching"
```

---

### Task 6: 최종 검증 + PR

- [ ] **Step 1: 백엔드 + 프론트 풀 검증**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/service-ops-api && ./gradlew compileJava compileTestJava -q
cd /c/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web && npm run typecheck && npm run lint && npm run build
cd /c/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web && grep -rn '"DELIVERY"\|"CLEANING"' components lib app | grep -vi "PICKUP\|kind\|test" || echo "no stray old values"
```
Expected: 백엔드 컴파일 성공, 프론트 빌드 성공, 옛 serviceType 값(`"DELIVERY"`/`"CLEANING"`) 잔존 없음(주: `DispatchOrderKind`의 "DELIVERY"는 별개 — grep 제외).

- [ ] **Step 2: PR (→ dev)**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain && git diff dev --stat && git push -u origin cc-operating-mode && gh pr create --base dev --title "차량 운영 방식: serviceType 5종 재분류 (콜/단일/순차/왕복/기타)" --body "$(cat <<'EOF'
## Summary
차량 분류를 도메인명에서 **배차 동작 방식 5종**으로 재정의 (`BikeServiceType` 값 in-place 교체).
- CALL(콜 배차)/SINGLE(단일 배차)/SEQUENTIAL(순차 배차)/ROUND(왕복 배차)/OTHER(기타)
- **V36**: DELIVERY→SINGLE, CLEANING→SEQUENTIAL, OTHER 유지 + check 제약 재생성 + default SINGLE
- 분기 로직 패밀리 매핑(동작 보존): cleaning=순차∪왕복(시동알림·시뮬), 시스템배차=콜∪단일
- 지도 필터 6칩 + 차량 편집폼 5옵션 + 상세 "운영 방식" 라벨

## 배포 영향
- **V36 마이그레이션 신규** (값 매핑 + 제약 + default) — 재기동 시 Flyway 적용. enum↔제약 값 일치.

## Test Plan
- [x] 백엔드 compile(main+test), 프론트 typecheck/lint/build, 옛 값 잔존 0
- [ ] 계약 테스트(Docker/CI)
- [ ] 프로덕션 QA: 지도 필터 6칩 + 카운트, 차량 편집폼 5옵션, 시동알림(순차/왕복), 시스템배차(콜/단일)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

**1. Spec coverage:** enum 5값(Task1), V36(Task1), 패밀리 헬퍼(Task1 백엔드/Task3 프론트), BikeBulk default·DeliveryCall 필터(Task2), 계약 테스트(Task2), 프론트 타입·필터(Task3), 편집폼·라벨·phase(Task4), 시뮬·MapShell 패밀리(Task5), 검증·PR(Task6). ✓ 비범위(타입명 리네임·시스템배차 CALL전용·declutter) 제외.

**2. Placeholder scan:** enum/migration/helper/필터/select/serviceTypeLabel 완전 코드. 분기 사이트는 현재 코드 before→after 제시. Task2 Step3/4·Task5 의 "READ + grep 후 교체"는 코드베이스 의존(정확한 잔여 사이트)이라 구체 대상(파일·라인·패턴·헬퍼)을 명시 — placeholder 아님.

**3. Type consistency:** `BikeServiceType{CALL,SINGLE,SEQUENTIAL,ROUND,OTHER}` + `isCleaningFamily/isDeliveryFamily`(백). 프론트 `ServiceOpsBikeServiceType`/`ServiceType` 동일 5값 + `isCleaningServiceType`(fleet-simulation.ts export, MapShell/FleetSimulationContext/VehicleDetailDialog 가 import). 라벨(콜 배차/단일 배차/순차 배차/왕복 배차/기타) 전 태스크 일관. 마이그레이션 매핑(DELIVERY→SINGLE, CLEANING→SEQUENTIAL) 일관.

**구현자 주의:** 태스크 간 typecheck 가 중간에 실패할 수 있음(옛 값 비교가 여러 파일에 흩어짐) — 각 태스크는 자기 파일 내부 에러 0 을 목표로 하고, **전체 typecheck/lint/build 통과는 Task5 Step4 + Task6 에서 보장**. Task3 의 typecheck 실패가 MapShell/FleetSimulationContext/VehicleDetailDialog(아직 미수정) 때문이면 정상 — 진행.
