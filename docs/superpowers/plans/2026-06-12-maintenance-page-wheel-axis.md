# 정비 관리 페이지 + 휠타입×엔진 2축 카탈로그 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 정비 카탈로그 편집을 `/management/maintenance`(좌측 레일 4번째)로 되살리고, 분류를 엔진(전기/내연) + **휠(2륜/4륜)** 2축으로 확장.

**Architecture:** `MaintenanceItem`에 휠 축 `appliesToWheel` 독립 컬럼 추가(엔진 `appliesTo` 유지). 차량 적용 = 엔진 AND 휠 매치. V37 add-column(기본 BOTH). 편집기 안 A(엔진 3섹션 + 휠 배지/select).

**Tech Stack:** Spring Boot (Java 21), Flyway, JPA, Next.js, TS. 브랜치 `cc-maintenance-page`(생성됨). Bash 절대경로 cd. 백엔드 게이트 compileJava compileTestJava(계약테스트 Docker→CI). 프론트 typecheck/lint/build.

**현재 핵심(탐색 확인):**
- `MaintenanceItem.create(name, appliesTo, parentItemId, cycleKm, cycleMonths, cycleLabel, displayOrder, memo)` (line 53) + `updateCatalog(name, appliesTo, parentItemId, cycleKm, cycleMonths, cycleLabel, displayOrder, enabled, memo)` (line 78). 필드 `appliesTo`(line 30).
- `MaintenanceReadService.listItemsForBike` → `itemRepository.findByAppliesToInAndDeletedAtIsNullOrderByDisplayOrderAsc(appliesTo)`.
- `MaintenanceCommandService.createItem`/`updateItem` (lines 45/63) 가 `request.appliesTo()` 전달.
- DTO: `MaintenanceItemReadResponse`(record, `from`), `MaintenanceItemCreateRequest`(@NotNull appliesTo), `MaintenanceItemUpdateRequest`.
- 프론트: `MaintenancePanel`(엔진 3섹션 filter, line 30-38), `MaintenanceItemDetailDialog`(appliesTo select line 72-76), `app/actions.ts` create/update/delete maintenance actions(+`parseAppliesTo`, redirect `/?tab=maintenance`), `ServiceOpsMaintenanceItem` 타입, `vehicle-maintenance-data.ts`(loadMaintenanceDataset = 전체 items), `summarizeMaintenanceByBike`(engine map) + `app/page.tsx` 호출부, `AppShell` NAV(3항목).
- 차량 상세 번들 = `client.listMaintenanceItemsForBike(bikeId)`(백엔드 필터) → deriveMaintenanceRows 무변경.

---

### Task 1: 백엔드 — 휠 축 (enum + 엔티티 + V37 + 필터 + DTO + 테스트)

**Files:**
- Create: `.../maintenance/domain/MaintenanceWheelApplies.java`
- Create: `.../resources/db/migration/V37__add_maintenance_applies_to_wheel.sql`
- Modify: `.../maintenance/domain/MaintenanceItem.java`
- Modify: `.../maintenance/repository/MaintenanceItemRepository.java`
- Modify: `.../maintenance/service/MaintenanceReadService.java`
- Modify: `.../maintenance/service/MaintenanceCommandService.java`
- Modify: `.../maintenance/dto/MaintenanceItemReadResponse.java`, `MaintenanceItemCreateRequest.java`, `MaintenanceItemUpdateRequest.java`
- Test: maintenance 계약 테스트

- [ ] **Step 1: enum**

`MaintenanceWheelApplies.java`:
```java
package com.thundercrew.opsapi.maintenance.domain;

/** 정비 항목의 휠타입 적용 축. 엔진 축(MaintenanceAppliesTo)과 직교. */
public enum MaintenanceWheelApplies {
    TWO_WHEEL,   // 2륜 전용
    FOUR_WHEEL,  // 4륜 전용
    BOTH         // 공통(양쪽)
}
```

- [ ] **Step 2: V37 마이그레이션**

`V37__add_maintenance_applies_to_wheel.sql`:
```sql
-- 휠 축 추가. 기존 항목은 기본 'BOTH'(전 휠 적용). add-column + check 동시 —
-- 기존 행이 모두 default 'BOTH' 라 check 위반 없음(값-재브랜드 아님).
alter table maintenance_items
    add column applies_to_wheel varchar(20) not null default 'BOTH';

alter table maintenance_items
    add constraint ck_maintenance_items_applies_to_wheel
        check (applies_to_wheel in ('TWO_WHEEL', 'FOUR_WHEEL', 'BOTH'));
```

- [ ] **Step 3: 엔티티**

`MaintenanceItem.java`: 
- 필드 추가: `@Enumerated(EnumType.STRING) @Column(name = "applies_to_wheel", nullable = false, length = 20) private MaintenanceWheelApplies appliesToWheel;` (appliesTo 필드 옆).
- `create(...)` 팩토리에 파라미터 `MaintenanceWheelApplies appliesToWheel` 추가(appliesTo 다음) + `item.appliesToWheel = appliesToWheel;`.
- `updateCatalog(...)`에 파라미터 `MaintenanceWheelApplies appliesToWheel` 추가(appliesTo 다음) + `if (appliesToWheel != null) { this.appliesToWheel = appliesToWheel; }` (기존 appliesTo 패턴 따라).
- getter `getAppliesToWheel()` 추가.

- [ ] **Step 4: 리포지토리**

`MaintenanceItemRepository.java`: 메서드 추가:
```java
    List<MaintenanceItem> findByAppliesToInAndAppliesToWheelInAndDeletedAtIsNullOrderByDisplayOrderAsc(
            List<MaintenanceAppliesTo> appliesTo, List<MaintenanceWheelApplies> appliesToWheel);
```
(import `MaintenanceWheelApplies`.)

- [ ] **Step 5: 차량별 필터**

`MaintenanceReadService.listItemsForBike`: 휠 목록 추가 + 새 쿼리 사용:
```java
        List<MaintenanceAppliesTo> appliesTo = bike.getEngineType() == BikeEngineType.ELECTRIC
                ? List.of(MaintenanceAppliesTo.ELECTRIC, MaintenanceAppliesTo.BOTH)
                : List.of(MaintenanceAppliesTo.ICE, MaintenanceAppliesTo.BOTH);
        List<MaintenanceWheelApplies> appliesToWheel = bike.getWheelType() == BikeWheelType.FOUR_WHEEL
                ? List.of(MaintenanceWheelApplies.FOUR_WHEEL, MaintenanceWheelApplies.BOTH)
                : List.of(MaintenanceWheelApplies.TWO_WHEEL, MaintenanceWheelApplies.BOTH);
        return itemRepository
                .findByAppliesToInAndAppliesToWheelInAndDeletedAtIsNullOrderByDisplayOrderAsc(appliesTo, appliesToWheel)
                .stream().map(MaintenanceItemReadResponse::from).toList();
```
(import `MaintenanceWheelApplies`, `BikeWheelType`. `Bike.getWheelType()` 존재 확인 — wheelType NOT NULL default TWO_WHEEL.)

- [ ] **Step 6: DTO**

- `MaintenanceItemReadResponse`: record에 `MaintenanceWheelApplies appliesToWheel` 추가 + `from(item)`에 `item.getAppliesToWheel()` 매핑.
- `MaintenanceItemCreateRequest`: `@NotNull MaintenanceWheelApplies appliesToWheel` 추가.
- `MaintenanceItemUpdateRequest`: `MaintenanceWheelApplies appliesToWheel`(nullable) 추가.

- [ ] **Step 7: CommandService 전달**

`MaintenanceCommandService.createItem`: `MaintenanceItem.create(... request.appliesTo(), request.appliesToWheel(), ...)`. `updateItem`: `item.updateCatalog(... request.appliesTo(), request.appliesToWheel(), ...)`. (파라미터 위치 = 엔티티 시그니처와 일치하게.)

- [ ] **Step 8: 컴파일 + 계약 테스트**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/service-ops-api && ./gradlew compileJava -q
```
계약 테스트(`grep -rln "maintenance-items\|listItemsForBike\|MaintenanceItemCreate" src/test/java`): 기존 create 요청에 appliesToWheel 누락 시 @NotNull 422 → 기존 테스트에 `appliesToWheel` 추가. 신규: 2륜·전기 / 4륜·내연 / 공통 항목 시드 후 `GET /api/v1/bikes/{id}/maintenance-items`가 차량 (엔진,휠) 조합 + 공통만 반환하는지(예: 2륜·전기 차량 → 2륜·전기 항목 + ELECTRIC/BOTH×TWO_WHEEL/BOTH 교집합). create/update가 appliesToWheel 저장.
```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/service-ops-api && ./gradlew compileJava compileTestJava -q
```

- [ ] **Step 9: 커밋**
```bash
cd /c/Users/user/repositories/clever/thundercrew-domain && git add development/service-ops-api/src development/service-ops-api/src/main/resources/db/migration && git commit -m "feat(maintenance): wheel-type axis (appliesToWheel) + V37 + per-bike filter"
```
Co-Authored-By 라인 포함.

---

### Task 2: 프론트 — 타입 + 데이터 로더 + 정비 페이지 + 레일

**Files:**
- Modify: `lib/services/service-ops-api.ts`
- Create: `app/management/maintenance/page.tsx`
- Modify: `components/layout/AppShell.tsx`
- (확인) `lib/services/vehicle-maintenance-data.ts` (전체 카탈로그 로더 재사용)

- [ ] **Step 1: 타입**

`service-ops-api.ts`: `export type ServiceOpsMaintenanceWheelApplies = "TWO_WHEEL" | "FOUR_WHEEL" | "BOTH";`. `ServiceOpsMaintenanceItem`에 `appliesToWheel: ServiceOpsMaintenanceWheelApplies;` 추가. create/update 메서드의 payload 타입/바디에 `appliesToWheel` 포함(기존 appliesTo 옆 — 메서드 READ 후 추가).

- [ ] **Step 2: 정비 페이지**

`app/management/maintenance/page.tsx`:
```tsx
import { MaintenancePanel } from "@/components/management/MaintenancePanel";
import { loadMaintenanceDataset } from "@/lib/services/vehicle-maintenance-data";

export const dynamic = "force-dynamic";

export default async function ManagementMaintenancePage() {
  const dataset = await loadMaintenanceDataset();
  return (
    <div className="management-page">
      <MaintenancePanel items={dataset.items} />
    </div>
  );
}
```
(`loadMaintenanceDataset`가 전체 `maintenance-items`를 반환하는지 READ로 확인 — `vehicle-maintenance-data.ts`에 `loadMaintenanceDataset`/유사 함수 존재. 함수명·반환형이 다르면 맞춰서. 미인증/오류 시 빈 items 폴백.)

- [ ] **Step 3: 레일 4번째 항목**

`AppShell.tsx` `NAV` 배열에 추가(업무 관리 다음):
```tsx
  {
    href: "/management/maintenance",
    label: "정비 관리",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-.7-.7-2.5 2.4-2.3z" />
      </svg>
    )
  }
```

- [ ] **Step 4: typecheck + lint + 커밋**
```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web && npm run typecheck && npm run lint
cd /c/Users/user/repositories/clever/thundercrew-domain && git add development/front-admin-web/lib/services/service-ops-api.ts development/front-admin-web/app/management/maintenance development/front-admin-web/components/layout/AppShell.tsx && git commit -m "feat(maintenance): /management/maintenance page + rail entry + wheel type"
```
(typecheck 실패가 MaintenancePanel/Dialog의 appliesToWheel 미반영(Task 3 대상)이면 그 파일 내부 에러는 Task 3에서 — 이 태스크 파일 내부 에러 0 목표. 단 MaintenancePanel을 페이지가 마운트하므로 빌드 통과 위해 Task 3와 함께 typecheck/lint가 깔끔해야 할 수 있음 — 그 경우 Task 3 먼저 끝낸 뒤 함께 검증. 안전하게: 이 태스크의 typecheck는 신규 페이지/타입/레일만 보고, 전체 통과는 Task 3 말미 + Task 5에서 보장.) Co-Authored-By 포함.

---

### Task 3: 프론트 — 편집기 휠 축 (배지 + select + 액션)

**Files:**
- Modify: `components/management/MaintenancePanel.tsx`
- Modify: `components/management/MaintenanceItemDetailDialog.tsx`
- Modify: `app/actions.ts`

- [ ] **Step 1: MaintenancePanel 휠 배지**

엔진 3섹션(전기/내연/공통) 유지. 각 항목 행에 휠타입 배지/셀 추가 — `item.appliesToWheel` → 라벨(TWO_WHEEL=2륜, FOUR_WHEEL=4륜, BOTH=공통). 행 렌더 구조(READ)에 배지 span 또는 컬럼 추가. 헬퍼 `wheelLabel(appliesToWheel)`.

- [ ] **Step 2: MaintenanceItemDetailDialog 휠 select**

생성·수정 폼의 `appliesTo` select 아래에 **휠타입 select** 추가:
```tsx
<label>휠타입
  <select name="appliesToWheel" defaultValue={row?.appliesToWheel ?? "BOTH"}>
    <option value="TWO_WHEEL">2륜</option>
    <option value="FOUR_WHEEL">4륜</option>
    <option value="BOTH">공통</option>
  </select>
</label>
```
(기존 appliesTo select 마크업 패턴 따라. 생성 모드 기본 BOTH.)

- [ ] **Step 3: 서버액션**

`app/actions.ts`:
- `parseAppliesToWheel(value)` 헬퍼 추가(`parseAppliesTo` 패턴 — "TWO_WHEEL"|"FOUR_WHEEL"|"BOTH" 검증).
- `createMaintenanceItemAction`/`updateMaintenanceItemAction`: 폼에서 `appliesToWheel` 파싱해 client.createMaintenanceItem/updateMaintenanceItem payload에 포함.
- create/update/delete 액션의 redirect `/?tab=maintenance` → `/management/maintenance` (전부).

- [ ] **Step 4: typecheck + lint + build + 커밋**
```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web && npm run typecheck && npm run lint && npm run build
cd /c/Users/user/repositories/clever/thundercrew-domain && git add development/front-admin-web/components/management/MaintenancePanel.tsx development/front-admin-web/components/management/MaintenanceItemDetailDialog.tsx development/front-admin-web/app/actions.ts && git commit -m "feat(maintenance): editor wheel-type badge + select + action wiring"
```
Co-Authored-By 포함. Expected: 전부 통과.

---

### Task 4: 프론트 — 요약 derive 엔진+휠 확장

**Files:**
- Modify: `components/management/vehicle-maintenance-derive.ts`
- Modify: `app/page.tsx`

- [ ] **Step 1: summarizeMaintenanceByBike 휠 반영**

`summarizeMaintenanceByBike`: 현재 `bikeEngineTypeById: Map<string,"ELECTRIC"|"ICE">`로 엔진만 필터. 휠 맵 파라미터 추가:
```ts
export function summarizeMaintenanceByBike(
  items, records,
  bikeEngineTypeById: Map<string, "ELECTRIC" | "ICE">,
  bikeWheelTypeById: Map<string, "TWO_WHEEL" | "FOUR_WHEEL">,
  now = new Date()
)
```
필터를 엔진(ELECTRIC→ELECTRIC|BOTH, ICE→ICE|BOTH) **AND** 휠(FOUR_WHEEL→FOUR_WHEEL|BOTH, else TWO_WHEEL|BOTH)로. 차량별 `applicableItems` = engine 매치 ∩ wheel 매치.

- [ ] **Step 2: app/page.tsx 호출부**

`summarizeMaintenanceByBike` 호출부에 `bikeWheelTypeById` 맵 구성·전달(차량 목록에서 `wheelType` 추출, 미상 시 TWO_WHEEL fallback — 백엔드 기본과 일치). engine 맵 구성 코드 옆에 추가.

- [ ] **Step 3: typecheck + lint + build + 커밋**
```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web && npm run typecheck && npm run lint && npm run build
cd /c/Users/user/repositories/clever/thundercrew-domain && git add development/front-admin-web/components/management/vehicle-maintenance-derive.ts development/front-admin-web/app/page.tsx && git commit -m "feat(maintenance): summary keys by engine + wheel"
```
Co-Authored-By 포함.

---

### Task 5: 최종 검증 + PR

- [ ] **Step 1: 풀 검증**
```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/service-ops-api && ./gradlew compileJava compileTestJava -q
cd /c/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web && npm run typecheck && npm run lint && npm run build
cd /c/Users/user/repositories/clever/thundercrew-domain && (git diff dev --name-only | grep -i "db/migration") && echo "V37 present" 
```
Expected: 백엔드/프론트 통과, V37 마이그레이션 1개(add-column), 빌드에 `/management/maintenance` 라우트.

- [ ] **Step 2: PR (→ dev)**
```bash
cd /c/Users/user/repositories/clever/thundercrew-domain && git push -u origin cc-maintenance-page && gh pr create --base dev --title "정비 관리 페이지 + 휠타입×엔진 2축 카탈로그" --body "$(cat <<'EOF'
## Summary
- 좌측 레일 4번째 "정비 관리" → /management/maintenance (미마운트였던 카탈로그 편집기 복구)
- 정비 분류를 엔진(전기/내연) + **휠(2륜/4륜)** 2축으로: MaintenanceItem.appliesToWheel(BOTH 포함) 추가
- 차량별 정비 = 엔진 매치 AND 휠 매치 (listItemsForBike), 차량 상세 자동 반영
- 편집기: 엔진 3섹션 유지 + 휠 배지/select. 요약 derive 엔진+휠 확장

## 배포 영향
- **V37 마이그레이션**: maintenance_items에 applies_to_wheel 컬럼 add (기본 'BOTH', check). add-column이라 안전(기존 행 BOTH로 채움, V36식 값-재브랜드 아님). 재기동 시 Flyway 적용.

## Test Plan
- [x] 백엔드 compileJava + compileTestJava, 프론트 typecheck+lint+build, V37 add-column
- [ ] 계약 테스트(CI): (엔진,휠) 조합 필터
- [ ] 프로덕션 QA: 레일 정비 관리→페이지, 항목 생성/수정 엔진+휠 지정, 휠 배지, 차량 상세 정비가 (엔진,휠) 조합만

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

**1. Spec 커버리지:** enum/엔티티/V37/repo/필터/DTO/command/테스트(T1), 타입·페이지·레일(T2), 편집기 배지·select·액션·redirect(T3), 요약 derive(T4), 검증·PR(T5). ✓ 차량상세 derive 무변경(백엔드 필터). ✓

**2. 플레이스홀더 스캔:** enum/migration/필터/페이지/레일SVG/select 완전 코드. "READ 후 패턴 따라"(panel 행 구조, dialog select 마크업, 데이터로더 함수명, create/update payload)는 코드베이스 의존 — 대상·방법 구체. placeholder 아님.

**3. 타입/이름 일관성:** 백엔드 `MaintenanceWheelApplies{TWO_WHEEL,FOUR_WHEEL,BOTH}` ↔ 프론트 `ServiceOpsMaintenanceWheelApplies` 동일 3값. 컬럼 `applies_to_wheel` ↔ 필드 `appliesToWheel` ↔ DTO/타입/폼 name="appliesToWheel" 일관. repo 메서드명 = 필터 쿼리 시그니처. listItemsForBike 휠 필터 ↔ 차량 상세 자동.

**구현자 주의:** V37은 add-column+check(기존 행 default 'BOTH'라 안전) — V36식 UPDATE-before-DROP 아님. `MaintenanceItem.create`/`updateCatalog` 파라미터 위치에 appliesToWheel를 appliesTo 바로 다음으로 일관 삽입(엔티티·CommandService·CreateRequest 매핑 위치 정렬). 차량상세 deriveMaintenanceRows는 손대지 말 것(백엔드 필터로 충분). Task2 중간 typecheck는 Task3 미완으로 실패할 수 있음 — 전체 통과는 T3·T5에서 보장.
