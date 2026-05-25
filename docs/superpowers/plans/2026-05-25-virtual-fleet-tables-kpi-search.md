# Virtual Fleet Tables / KPI / Search (PR-B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the `virtualFleet` snapshot (introduced in PR-A) into the vehicles table, riders table, root-page KPI tiles, and the unified `OverviewMapSearch` matching, so toggling 데모 시작 makes the whole page light up — 22 vehicles, 21 riders, KPI deltas, search hits — not just the map markers.

**Architecture:** Each consumer reads `virtualFleet` from `useFleetSimulation()` and merges raw data with the virtual fleet via a small `useMemo`. The KPI tile block is extracted from the server `page.tsx` into a new client component that subscribes to live simulation so the 시동 차량 count updates per tick. No new context channels; PR-A already exposes everything we need.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript. No new runtime deps. No backend changes. No test runner — verification = `npm run typecheck` + `npm run lint` + manual smoke.

**Reference doc:** `docs/superpowers/specs/2026-05-25-virtual-fleet-tables-kpi-search-design.md`.

---

## File Structure

| Path | Purpose | Action |
| ---- | ------- | ------ |
| `components/overview/OverviewKpiTiles.tsx` | New client component — renders the two KPI cards from server-supplied base counts + live virtual/simulated overlay | **Create** |
| `app/page.tsx` | Replace inline KPI JSX with `<OverviewKpiTiles .../>`; counts continue to be computed server-side and passed as props | **Modify** |
| `components/management/VehiclesPanel.tsx` | Merge `data.vehicles ⊕ virtualFleet.vehicles` before filtering | **Modify** |
| `components/management/RidersPanel.tsx` | Merge `data.riders ⊕ virtualFleet.riders` before filtering | **Modify** |
| `components/overview/OverviewMapBanner.tsx` | Merge `bikeActiveRiderById` / `riderInfoById` with virtualFleet's before passing to `OverviewMapSearch` | **Modify** |
| `components/overview/FullscreenMapHost.tsx` | Same merge for the fullscreen search | **Modify** |

No tests directory — verification by typecheck + lint + manual smoke.

---

## Task 1: Branch sanity check

**Files:** none

- [ ] **Step 1: Verify branch + spec**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain
git status
git log --oneline -3
ls docs/superpowers/specs/2026-05-25-virtual-fleet-tables-kpi-search-design.md
ls docs/superpowers/plans/2026-05-25-virtual-fleet-tables-kpi-search.md
```

Expected: branch `cc-225-virtual-fleet-tables-kpi-search`, recent commit `01d487b` (spec). Both doc files exist. Working tree clean.

---

## Task 2: Merge virtual vehicles into `VehiclesPanel`

**Files:**
- Modify: `development/front-admin-web/components/management/VehiclesPanel.tsx`

Build an `effectiveVehicles` array (raw + virtual) and replace every `data.vehicles` usage with it.

- [ ] **Step 1: Read the file to confirm current shape**

```bash
grep -n "useFleetSimulation\|data\.vehicles\|applyVehicleFilters" C:/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web/components/management/VehiclesPanel.tsx
```

Expected: file currently has no `useFleetSimulation` import. `data.vehicles` is referenced on lines ~120, ~126, ~162 (per spec).

- [ ] **Step 2: Add the new import**

Add alongside other `@/components/overview/` imports near the top:

```tsx
import { useFleetSimulation } from "@/components/overview/FleetSimulationContext";
```

If `useMemo` is not already in the existing react import, add it (it should already be since the file uses memoization).

- [ ] **Step 3: Read the fleet context and derive effective vehicles**

Inside the `VehiclesPanel` component body, near the other hooks (above the `applyVehicleFilters` `useMemo`), add:

```tsx
const { virtualFleet } = useFleetSimulation();
const effectiveVehicles = useMemo(() => {
  if (!virtualFleet) return data.vehicles;
  return [...data.vehicles, ...virtualFleet.vehicles];
}, [data.vehicles, virtualFleet]);
```

- [ ] **Step 4: Swap `data.vehicles` references**

Find the `applyVehicleFilters` invocation:
```tsx
const visibleVehicles = useMemo(
  () =>
    applyVehicleFilters({
      vehicles: data.vehicles,
      ...
    }),
  [data.vehicles, filters, bikePinById, deviceUidByBikeId, maintenanceSummaryByBike]
);
```

Change `vehicles: data.vehicles` to `vehicles: effectiveVehicles`, and replace `data.vehicles` in the deps array:

```tsx
const visibleVehicles = useMemo(
  () =>
    applyVehicleFilters({
      vehicles: effectiveVehicles,
      filters,
      bikePinById,
      deviceUidByBikeId,
      maintenanceSummaryByBike
    }),
  [effectiveVehicles, filters, bikePinById, deviceUidByBikeId, maintenanceSummaryByBike]
);
```

Find the filter-controls count prop:
```tsx
count={{ visible: visibleVehicles.length, total: data.vehicles.length }}
```

Change to:
```tsx
count={{ visible: visibleVehicles.length, total: effectiveVehicles.length }}
```

Confirm via grep that no other `data.vehicles` reference exists in the file — if it does, swap to `effectiveVehicles` (or leave only if it's intentional, e.g., a banner that shows the raw count).

- [ ] **Step 5: Static checks**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web
npm run typecheck
npm run lint
```

Both must exit 0.

- [ ] **Step 6: Commit**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain
git add development/front-admin-web/components/management/VehiclesPanel.tsx
git commit -m "VehiclesPanel: show virtual fleet rows when demo is running

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Merge virtual riders into `RidersPanel`

**Files:**
- Modify: `development/front-admin-web/components/management/RidersPanel.tsx`

Same pattern as Task 2 but for riders.

- [ ] **Step 1: Confirm current shape**

```bash
grep -n "useFleetSimulation\|data\.riders\|applyRiderFilters" C:/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web/components/management/RidersPanel.tsx
```

Expected references to `data.riders` on lines ~84, ~94, ~111.

- [ ] **Step 2: Add the import**

Add alongside other `@/components/overview/` imports:

```tsx
import { useFleetSimulation } from "@/components/overview/FleetSimulationContext";
```

Ensure `useMemo` is in the react import.

- [ ] **Step 3: Derive `effectiveRiders`**

Inside `RidersPanel`, near other hooks:

```tsx
const { virtualFleet } = useFleetSimulation();
const effectiveRiders = useMemo(() => {
  if (!virtualFleet) return data.riders;
  return [...data.riders, ...virtualFleet.riders];
}, [data.riders, virtualFleet]);
```

- [ ] **Step 4: Swap `data.riders` references**

Find `applyRiderFilters` call:
```tsx
applyRiderFilters({
  riders: data.riders,
  ...
})
```

Change to:
```tsx
applyRiderFilters({
  riders: effectiveRiders,
  ...
})
```

Replace `data.riders` in its deps array with `effectiveRiders`.

Find the count prop:
```tsx
count={{ visible: visibleRiders.length, total: data.riders.length }}
```

Change to:
```tsx
count={{ visible: visibleRiders.length, total: effectiveRiders.length }}
```

- [ ] **Step 5: Static checks** — both exit 0.

- [ ] **Step 6: Commit**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain
git add development/front-admin-web/components/management/RidersPanel.tsx
git commit -m "RidersPanel: show virtual riders when demo is running

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Extract KPI tiles into a client component with live overlay

**Files:**
- Create: `development/front-admin-web/components/overview/OverviewKpiTiles.tsx`
- Modify: `development/front-admin-web/app/page.tsx`

The current KPI JSX lives inside the server `page.tsx`. Extract it into a client component that takes the server-computed base counts as props and reads `virtualFleet` + `simulated` from context to overlay live virtual contributions.

- [ ] **Step 1: Create the new client component**

```tsx
"use client";

import { useMemo } from "react";

import { useFleetSimulation } from "@/components/overview/FleetSimulationContext";

/**
 * 페이지 상단의 두 KPI 카드 (차량 현황 / 라이더 현황). 서버에서 SSR 된
 * baseline 값을 props 로 받고, 그 위에 fleet 데모의 가상 fleet + 시뮬레이션
 * 상태를 매 1초 tick 마다 overlay 한다. fleet OFF 면 props 값 그대로.
 *
 * 시동 차량은 virtual-bike-* prefix 가 붙은 simulated entry 중 ignitionStatus
 * 가 ON 인 것만 카운트해 base 에 더한다 — base 의 실제 차량 카운트와
 * 중복되지 않도록 (실제 차량은 SSR 시점의 정적 dummy 값을 그대로 신뢰).
 */
export interface OverviewKpiTilesProps {
  totalBikes: number;
  ignitionOnCount: number;
  insuredVehicleCount: number;
  totalRiders: number;
  subscriptionRiderCount: number;
  rentalRiderCount: number;
}

const VIRTUAL_BIKE_PREFIX = "virtual-bike-";
const VIRTUAL_FLEET_COUNT = 20;

function formatCount(value: number): string {
  return new Intl.NumberFormat("ko-KR").format(value);
}

export function OverviewKpiTiles({
  totalBikes,
  ignitionOnCount,
  insuredVehicleCount,
  totalRiders,
  subscriptionRiderCount,
  rentalRiderCount
}: OverviewKpiTilesProps) {
  const { virtualFleet, simulated } = useFleetSimulation();

  const virtualIgnitionOn = useMemo(() => {
    let n = 0;
    for (const state of simulated.values()) {
      if (state.ignitionStatus === "ON" && state.bikeId.startsWith(VIRTUAL_BIKE_PREFIX)) {
        n++;
      }
    }
    return n;
  }, [simulated]);

  const totalBikesEffective = totalBikes + (virtualFleet ? VIRTUAL_FLEET_COUNT : 0);
  const totalRidersEffective = totalRiders + (virtualFleet ? VIRTUAL_FLEET_COUNT : 0);
  const ignitionOnEffective = ignitionOnCount + virtualIgnitionOn;

  return (
    <div className="overview-kpi-groups">
      <article className="kpi-group">
        <h3 className="kpi-group-heading">차량 현황</h3>
        <div className="kpi-group-metrics">
          <div>
            <p className="metric-label">전체 차량</p>
            <p className="metric-value">{formatCount(totalBikesEffective)}</p>
          </div>
          <div>
            <p className="metric-label">시동 차량</p>
            <p className="metric-value">{formatCount(ignitionOnEffective)}</p>
          </div>
          <div>
            <p className="metric-label">보험 차량</p>
            <p className="metric-value">{formatCount(insuredVehicleCount)}</p>
          </div>
        </div>
      </article>

      <article className="kpi-group">
        <h3 className="kpi-group-heading">라이더 현황</h3>
        <div className="kpi-group-metrics">
          <div>
            <p className="metric-label">전체 라이더</p>
            <p className="metric-value">{formatCount(totalRidersEffective)}</p>
          </div>
          <div>
            <p className="metric-label">구독 인원</p>
            <p className="metric-value">{formatCount(subscriptionRiderCount)}</p>
          </div>
          <div>
            <p className="metric-label">렌탈 인원</p>
            <p className="metric-value">{formatCount(rentalRiderCount)}</p>
          </div>
        </div>
      </article>
    </div>
  );
}
```

- [ ] **Step 2: Replace the inline KPI JSX in `app/page.tsx`**

In `page.tsx`, add the import near other `@/components/overview/` imports:

```tsx
import { OverviewKpiTiles } from "@/components/overview/OverviewKpiTiles";
```

Find the existing inline KPI block (~lines 287-323 from spec read):

```tsx
<div className="overview-kpi-groups">
  <article className="kpi-group">
    <h3 className="kpi-group-heading">차량 현황</h3>
    ...
  </article>
  <article className="kpi-group">
    <h3 className="kpi-group-heading">라이더 현황</h3>
    ...
  </article>
</div>
```

Replace the entire block with:

```tsx
<OverviewKpiTiles
  totalBikes={summary.totalBikes}
  ignitionOnCount={ignitionOnCount}
  insuredVehicleCount={insuredVehicleCount}
  totalRiders={totalRiders}
  subscriptionRiderCount={subscriptionRiderCount}
  rentalRiderCount={rentalRiderCount}
/>
```

If `page.tsx` has a local `formatCount` helper that is no longer referenced after this swap, leave it in place — other parts of the page may still use it. Only remove if grep confirms zero references.

Verify the new component is rendered INSIDE `<OverviewClientShell>` (otherwise `useFleetSimulation` returns the noop fallback and counts never reflect the fleet). The existing KPI block was already inside `OverviewClientShell` per the file structure read.

- [ ] **Step 3: Static checks**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web
npm run typecheck
npm run lint
```

Both exit 0.

- [ ] **Step 4: Commit**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain
git add development/front-admin-web/components/overview/OverviewKpiTiles.tsx development/front-admin-web/app/page.tsx
git commit -m "Extract OverviewKpiTiles to a client component with live virtual overlay

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Merge rider lookups for search in `OverviewMapBanner`

**Files:**
- Modify: `development/front-admin-web/components/overview/OverviewMapBanner.tsx`

The banner already pulls `virtualFleet` (PR-A). Add two merged Maps and feed them to `OverviewMapSearch` so virtual riders + virtual `bikeActiveRiderById` participate in search matching.

- [ ] **Step 1: Verify current destructure + search usage**

```bash
grep -n "useFleetSimulation\|bikeActiveRiderById\|riderInfoById\|OverviewMapSearch" C:/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web/components/overview/OverviewMapBanner.tsx
```

Expected: `useFleetSimulation` already destructures `virtualFleet` (from PR-A). `bikeActiveRiderById` + `riderInfoById` come from `props`. `<OverviewMapSearch>` JSX passes them as props.

- [ ] **Step 2: Build the two merged Maps**

Insert near the existing `mergedRawPins` `useMemo` (above the search JSX, alongside other derivations):

```tsx
const mergedBikeActiveRiderById = useMemo(() => {
  if (!virtualFleet) return bikeActiveRiderById ?? new Map<string, string>();
  const m = new Map<string, string>(bikeActiveRiderById ?? []);
  for (const [k, v] of virtualFleet.bikeActiveRiderById) m.set(k, v);
  return m;
}, [bikeActiveRiderById, virtualFleet]);

const mergedRiderInfoById = useMemo(() => {
  if (!virtualFleet) return riderInfoById ?? new Map<string, { name: string; phone: string }>();
  const m = new Map(riderInfoById ?? []);
  for (const [k, v] of virtualFleet.riderInfoById) m.set(k, v);
  return m;
}, [riderInfoById, virtualFleet]);
```

- [ ] **Step 3: Pass merged Maps to `OverviewMapSearch`**

Find:
```tsx
<OverviewMapSearch
  bikePins={overlaidBikePins}
  stationPins={stationPins}
  bikeActiveRiderById={bikeActiveRiderById}
  riderInfoById={riderInfoById}
  onSelect={handleSearchSelect}
/>
```

Change `bikeActiveRiderById` and `riderInfoById` to the merged versions:
```tsx
<OverviewMapSearch
  bikePins={overlaidBikePins}
  stationPins={stationPins}
  bikeActiveRiderById={mergedBikeActiveRiderById}
  riderInfoById={mergedRiderInfoById}
  onSelect={handleSearchSelect}
/>
```

`VehicleDetailDialog` (rendered later in this banner via the search-target effect) continues to read its row from the page's separate `vehicleById` lookup — virtual vehicles aren't there, so clicking a virtual marker opens a dialog whose vehicle is `undefined` and the existing fallback path keeps the dialog from displaying broken data. That fallback is sufficient for this PR (full virtual detail panel is OOS).

- [ ] **Step 4: Static checks** — both exit 0.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain
git add development/front-admin-web/components/overview/OverviewMapBanner.tsx
git commit -m "OverviewMapBanner: merge virtual rider lookups into search

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Same merge for `FullscreenMapHost`

**Files:**
- Modify: `development/front-admin-web/components/overview/FullscreenMapHost.tsx`

- [ ] **Step 1: Confirm current shape inside `FullscreenMapOverlay`**

```bash
grep -n "useFleetSimulation\|bikeActiveRiderById\|riderInfoById\|OverviewMapSearch" C:/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web/components/overview/FullscreenMapHost.tsx
```

`virtualFleet` should already be in the destructure (PR-A). `bikeActiveRiderById` + `riderInfoById` are also already destructured (props passed from page).

- [ ] **Step 2: Build merged Maps**

Insert alongside `mergedRawPins`:

```tsx
const mergedBikeActiveRiderById = useMemo(() => {
  if (!virtualFleet) return bikeActiveRiderById ?? new Map<string, string>();
  const m = new Map<string, string>(bikeActiveRiderById ?? []);
  for (const [k, v] of virtualFleet.bikeActiveRiderById) m.set(k, v);
  return m;
}, [bikeActiveRiderById, virtualFleet]);

const mergedRiderInfoById = useMemo(() => {
  if (!virtualFleet) return riderInfoById ?? new Map<string, { name: string; phone: string }>();
  const m = new Map(riderInfoById ?? []);
  for (const [k, v] of virtualFleet.riderInfoById) m.set(k, v);
  return m;
}, [riderInfoById, virtualFleet]);
```

- [ ] **Step 3: Pass merged Maps to `OverviewMapSearch` in the header**

Find the JSX:
```tsx
<OverviewMapSearch
  bikePins={overlaidBikePins}
  stationPins={stationPins}
  bikeActiveRiderById={bikeActiveRiderById}
  riderInfoById={riderInfoById}
  onSelect={handleSearchSelect}
/>
```

Change to:
```tsx
<OverviewMapSearch
  bikePins={overlaidBikePins}
  stationPins={stationPins}
  bikeActiveRiderById={mergedBikeActiveRiderById}
  riderInfoById={mergedRiderInfoById}
  onSelect={handleSearchSelect}
/>
```

- [ ] **Step 4: Static checks** — both exit 0.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain
git add development/front-admin-web/components/overview/FullscreenMapHost.tsx
git commit -m "FullscreenMapHost: merge virtual rider lookups into search

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Full static-check sweep + optional build

- [ ] **Step 1: typecheck**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web
npm run typecheck
```

Expected exit 0.

- [ ] **Step 2: lint**

```bash
npm run lint
```

Expected exit 0.

- [ ] **Step 3: Optional `next build`**

```bash
npm run build
```

Catches Next.js / SSR issues lint doesn't. Skip if you trust prior checks.

---

## Task 8: Manual smoke

The user runs their own dev server. **Do not** spawn a competing one.

- [ ] **Step 1: Fleet OFF baseline**

Open `/`. KPI shows real counts. Vehicle table: 2 rows. Rider table: 1 row. Search the inline `차량 번호 / BSS / 라이더 검색` for `99서` — no matches.

- [ ] **Step 2: 데모 시작**

Click `[데모 시작]`. Verify:
- KPI 전체 차량 jumps to original + 20 (e.g. 22)
- KPI 전체 라이더 jumps to original + 20 (e.g. 21)
- KPI 시동 차량 grows 0 → some positive number over the first 30s as virtual bikes transition to EN_ROUTE
- Vehicle table 화면 reflects 22 rows when scrolled — plates `99서0001` ~ `99서0020` visible alongside real plates
- Rider table reflects 21 rows — gating names like `김민수`, `이지영` 등 from the family/given pool

- [ ] **Step 3: Search hit**

Type `99서0005` in the inline search → result item visible in dropdown → click → map opens + pans + `VehicleDetailDialog` opens (with mostly-empty fields, as expected).

Type `김민` (a virtual rider given-name prefix) → at least one rider result shows in dropdown → click → map opens + pans to that virtual rider's matched bike.

- [ ] **Step 4: KPI live update**

Watch `시동 차량` for ~30s. Number should bump up and down as virtual bikes shift between EN_ROUTE (ON) and ARRIVED/IDLE (OFF).

- [ ] **Step 5: 데모 정지**

Click toggle. Verify:
- KPI returns to original
- Vehicle table shrinks back to 2 rows
- Rider table shrinks back to 1 row
- Search `99서` again returns no matches

- [ ] **Step 6: Fullscreen mode toggle**

Open `[⛶ 전체화면]`. Click `[데모 시작]` from the fullscreen header. Search should match virtual plates and rider names from the fullscreen header search too (shared context).

---

## Task 9: PR

- [ ] **Step 1: Push branch**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain
git push -u origin cc-225-virtual-fleet-tables-kpi-search
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --base dev --head cc-225-virtual-fleet-tables-kpi-search \
  --title "Light up tables / KPI / search with virtual fleet (PR-B)" \
  --body "$(cat <<'EOF'
## Summary
- PR-A 의 가상 fleet 스냅샷을 차량/라이더 표, KPI 카드, 검색에 통합 — 데모 시작이 한 화면 통째로 살아나도록
- 차량 표: 2 → 22 행 (실제 2 + 가상 \`99서0001~0020\`), 기존 필터 헬퍼는 그대로 작동
- 라이더 표: 1 → 21 행 (실제 1 + 가상 20 명)
- KPI: 새 \`OverviewKpiTiles\` 클라이언트 컴포넌트로 추출 — 매 tick 시뮬레이션 진행에 따라 시동 차량 카운트 갱신
- 검색: 인페이지 + 전체화면 양쪽에서 \`bikeActiveRiderById\` / \`riderInfoById\` 가 가상까지 매칭
- 보험 차량 / 구독·렌탈 카운트는 가상이 0 기여라 그대로 (의도된 동작)

## Spec & Plan
- 디자인: \`docs/superpowers/specs/2026-05-25-virtual-fleet-tables-kpi-search-design.md\`
- 플랜: \`docs/superpowers/plans/2026-05-25-virtual-fleet-tables-kpi-search.md\`

## Test plan
- [x] \`npm run typecheck\`
- [x] \`npm run lint\`
- [ ] 데모 시작 → KPI 차량 +20 / 라이더 +20 즉시 반영
- [ ] 시동 차량 카운트가 시간이 지나며 변동 (가상 차량 EN_ROUTE 진입/이탈)
- [ ] 차량 표에 \`99서\` plate 노출, 기존 필터 (구분/시동/연결) 가 가상 row 에도 정상 작동
- [ ] 라이더 표에 가상 라이더 20명 노출
- [ ] 검색 \`99서0005\` / \`김민\` 매칭, 클릭 시 지도 pan
- [ ] 데모 정지 → 모든 화면 원상 복구
- [ ] 전체화면 토글 / 검색도 동일 작동

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL printed.

---

## Self-Review

**Spec coverage** — `docs/superpowers/specs/2026-05-25-virtual-fleet-tables-kpi-search-design.md`:

- "Panel 단의 표 데이터 merge" → Tasks 2 (VehiclesPanel) + 3 (RidersPanel).
- "KPI 카드 — 새 클라이언트 컴포넌트로 분리" → Task 4 (`OverviewKpiTiles` + page.tsx swap).
- "검색 (OverviewMapSearch) — banner / fullscreen 에서 merge" → Tasks 5 + 6.
- "User-visible behavior" → Task 8 smoke checklist mirrors every bullet.
- "Out-of-scope follow-ups" → not implemented; consistent with spec.

**Placeholder scan** — no "TODO", "TBD", "implement later", "similar to Task N" references. Each code block is concrete.

**Type consistency:**
- `effectiveVehicles: FrontendVehicle[]` (Task 2) and `effectiveRiders: FrontendRider[]` (Task 3) — the merge spread relies on `VirtualFleet.vehicles: FrontendVehicle[]` / `.riders: FrontendRider[]` already produced by PR-A.
- `mergedBikeActiveRiderById: Map<string, string>` and `mergedRiderInfoById: Map<string, { name; phone }>` — types match `OverviewMapSearch`'s optional props.
- `OverviewKpiTilesProps` (Task 4) takes 6 numeric fields, all already computed in `page.tsx`.
- `VIRTUAL_BIKE_PREFIX = "virtual-bike-"` matches the prefix in `lib/services/virtual-fleet.ts:1` (PR-A) which writes `virtual-bike-${pad2(i)}`.

**Scope** — single PR, 1 new file + 5 modified files, no backend changes.
