# Monitoring-style Search Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a search bar (vehicles + BSS + riders) to the root page's existing `OverviewMapBanner` so an operator can jump straight to a target on the live map without scrolling the table.

**Architecture:** New `OverviewMapSearch` client component modeled after the dormant `MonitoringSearch.tsx`, embedded in `OverviewMapBanner`'s toggle row. It does client-side substring matching over data the root page already passes down (`bikePins`, `stationPins`, `bikeActiveRiderById`, `riderInfoById`), supports a `(bike | station | rider) → target` result shape, and wires into the existing `VehicleFilterContext.setSelectedBikeId` channel + a new `targetLocationOverride` state for BSS-only hits. Selecting a result auto-opens the map.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript. No new runtime deps. No backend changes. No test runner exists in this project (`npm test` is absent) — verification uses `npm run typecheck` + `npm run lint` + a manual smoke checklist at the end.

**Reference doc:** `docs/superpowers/specs/2026-05-23-monitoring-search-integration-design.md`.

---

## File Structure

| Path | Purpose | Action |
| ---- | ------- | ------ |
| `components/overview/OverviewMapSearch.tsx` | New search input + grouped result dropdown. Stateless w.r.t. data: parent passes props. | **Create** |
| `components/overview/OverviewMapBanner.tsx` | Embed search in the toggle row, manage `open`, `selectedBikeId`, and a new `targetLocationOverride`. | **Modify** |
| `app/globals.css` | Add `.overview-map-search-*` styles for the inline toggle-row placement (existing `.monitoring-search*` styles assume floating-over-fullscreen-map and aren't reused). | **Modify** |

No tests directory — the project has no jest/vitest/playwright config. Verification is done by `npm run typecheck`, `npm run lint`, and the manual smoke checklist at the end of this plan.

---

## Task 1: Branch + read current state

**Files:** none (setup only)

- [ ] **Step 1: Create the working branch from up-to-date `dev`**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain
git checkout dev
git pull origin dev
git checkout -b cc-213-monitoring-search-integration
```

- [ ] **Step 2: Confirm the spec + plan are in `dev`**

```bash
ls docs/superpowers/specs/2026-05-23-monitoring-search-integration-design.md
ls docs/superpowers/plans/2026-05-23-monitoring-search-integration.md
```

Expected: both files exist. If a previous PR merged them they're already in `dev`. If not, cherry-pick from the spec branch and continue.

---

## Task 2: Build `OverviewMapSearch` (matcher + dropdown UI)

**Files:**
- Create: `development/front-admin-web/components/overview/OverviewMapSearch.tsx`

- [ ] **Step 1: Create the file with the full component**

This is the only place the matching logic and the dropdown live. Parent passes data + an `onSelect` callback; the component owns input state and the focused-only dropdown visibility.

```tsx
"use client";

import { useMemo, useState } from "react";

import type {
  FrontendDashboardBikePin,
  FrontendDashboardStationPin
} from "@/lib/services/service-ops-api";

/**
 * 차량 / BSS / 라이더 통합 검색 인풋. 옛 `/monitoring` 의 `MonitoringSearch` 를
 * 모델로 하되 결과 종류를 셋으로 늘리고, 인라인(토글 행 안) 배치로 바뀐 새
 * placement 에 맞춰 새 CSS 클래스(`overview-map-search-*`) 를 쓴다.
 *
 * 라이더 항목은 지도 위에 마커가 없으므로, 라이더가 현재 타고 있는 bike 의
 * 좌표를 사용해 같은 "지도 팬 + 차량 상세 패널 열기" 흐름으로 연결한다.
 */

export type OverviewMapSearchMatch =
  | { kind: "bike"; bikeId: string; latitude: number; longitude: number; label: string; sublabel?: string }
  | { kind: "station"; latitude: number; longitude: number; label: string; sublabel?: string }
  | { kind: "rider"; bikeId: string; latitude: number; longitude: number; label: string; sublabel?: string };

export interface OverviewMapSearchProps {
  bikePins: ReadonlyArray<FrontendDashboardBikePin>;
  stationPins: ReadonlyArray<FrontendDashboardStationPin>;
  /** bike → rider 인덱스. 라이더 검색 후보를 "할당된 라이더" 로 좁히고
   *  결과 클릭 시 그 라이더가 타는 bike 의 좌표로 점프하는 데 쓴다. */
  bikeActiveRiderById?: Map<string, string>;
  /** rider id → { name, phone } */
  riderInfoById?: Map<string, { name: string; phone: string }>;
  onSelect: (match: OverviewMapSearchMatch) => void;
}

const MAX_RESULTS = 8;

export function OverviewMapSearch({
  bikePins,
  stationPins,
  bikeActiveRiderById,
  riderInfoById,
  onSelect
}: OverviewMapSearchProps) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  // rider → bike 역방향 인덱스. 라이더 매칭이 잡힌 결과를 한 번에 좌표로
  // 매핑하기 위해 매 키스트로크가 아니라 deps 변경 시에만 다시 만든다.
  const bikeIdByRiderId = useMemo(() => {
    const map = new Map<string, string>();
    if (!bikeActiveRiderById) return map;
    for (const [bikeId, riderId] of bikeActiveRiderById) {
      map.set(riderId, bikeId);
    }
    return map;
  }, [bikeActiveRiderById]);

  // bikeId → pin 빠른 lookup. 라이더 매칭 결과에서 좌표를 채울 때 사용.
  const bikePinById = useMemo(() => {
    const map = new Map<string, FrontendDashboardBikePin>();
    for (const pin of bikePins) map.set(pin.bikeId, pin);
    return map;
  }, [bikePins]);

  const matches = useMemo<OverviewMapSearchMatch[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const bikeMatches: OverviewMapSearchMatch[] = bikePins
      .filter((pin) => pin.plateNumber && pin.plateNumber.toLowerCase().includes(q))
      .map((pin) => ({
        kind: "bike" as const,
        bikeId: pin.bikeId,
        latitude: pin.latitude,
        longitude: pin.longitude,
        label: pin.plateNumber,
        sublabel: pin.modelName || undefined
      }));

    const riderMatches: OverviewMapSearchMatch[] = [];
    if (riderInfoById) {
      for (const [riderId, info] of riderInfoById) {
        const bikeId = bikeIdByRiderId.get(riderId);
        if (!bikeId) continue; // 할당된 차량이 없으면 화면에 표시할 의미가 없다
        const pin = bikePinById.get(bikeId);
        if (!pin) continue; // 차량이 핀에 없으면 (예: 폴링 누락) 스킵
        const name = info.name?.toLowerCase() ?? "";
        const phone = info.phone?.toLowerCase() ?? "";
        if (!name.includes(q) && !phone.includes(q)) continue;
        riderMatches.push({
          kind: "rider",
          bikeId,
          latitude: pin.latitude,
          longitude: pin.longitude,
          label: info.name,
          sublabel: `${info.phone} · ${pin.plateNumber}`
        });
      }
    }

    const stationMatches: OverviewMapSearchMatch[] = stationPins
      .filter((pin) => {
        const name = pin.name?.toLowerCase() ?? "";
        const address = pin.address?.toLowerCase() ?? "";
        return name.includes(q) || address.includes(q);
      })
      .map((pin) => ({
        kind: "station" as const,
        latitude: pin.latitude,
        longitude: pin.longitude,
        label: pin.name,
        sublabel: pin.address || undefined
      }));

    // 운영자의 가장 흔한 task (특정 차량 찾기) 가 위에 노출되도록 bike → rider
    // → station 순서로 채워서 8개에서 절단. 스펙의 "고정 순서" 결정 그대로.
    return [...bikeMatches, ...riderMatches, ...stationMatches].slice(0, MAX_RESULTS);
  }, [query, bikePins, stationPins, riderInfoById, bikeIdByRiderId, bikePinById]);

  const handleSelect = (match: OverviewMapSearchMatch) => {
    onSelect(match);
    setQuery("");
    setFocused(false);
  };

  const showDropdown = focused && matches.length > 0;

  return (
    <div className="overview-map-search" role="search">
      <input
        className="overview-map-search-input"
        type="search"
        placeholder="차량 번호 / BSS / 라이더 검색"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        aria-label="지도 검색"
      />
      {showDropdown ? (
        <ul className="overview-map-search-dropdown" role="listbox">
          {matches.map((match) => {
            const key =
              match.kind === "station"
                ? `station-${match.label}-${match.latitude}-${match.longitude}`
                : `${match.kind}-${match.bikeId}`;
            return (
              <li
                key={key}
                className="overview-map-search-item"
                role="option"
                aria-selected="false"
                // onMouseDown 은 input 의 onBlur 보다 먼저 실행되므로 클릭이
                // 안전하게 도달. onClick 이면 blur → dropdown 사라짐 → miss.
                onMouseDown={(event) => {
                  event.preventDefault();
                  handleSelect(match);
                }}
              >
                <span className={`overview-map-search-item-chip overview-map-search-item-chip--${match.kind}`}>
                  {match.kind === "bike" ? "차량" : match.kind === "station" ? "BSS" : "라이더"}
                </span>
                <span className="overview-map-search-item-label">{match.label}</span>
                {match.sublabel ? (
                  <span className="overview-map-search-item-sub">{match.sublabel}</span>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Static checks pass**

Run from the front-admin-web workspace:

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web
npm run typecheck
npm run lint
```

Expected: both exit 0. The component isn't imported anywhere yet, but tsc will still type-check it. If lint complains about an unused import (`onSelect` isn't called yet etc.), recheck the file.

- [ ] **Step 3: Commit**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain
git add development/front-admin-web/components/overview/OverviewMapSearch.tsx
git commit -m "Add OverviewMapSearch — vehicle + BSS + rider matcher with grouped dropdown"
```

---

## Task 3: Wire `OverviewMapSearch` into `OverviewMapBanner`

**Files:**
- Modify: `development/front-admin-web/components/overview/OverviewMapBanner.tsx`

The banner already owns:
- `open` state (toggle ON/OFF),
- `selectedBikeId` via `useVehicleFilter()` context,
- `targetLocation` derived from `selectedBikeId` for the bike-follow effect.

This task adds a `targetLocationOverride` state that the search sets independently, plus a single select handler that auto-opens the map and routes by `match.kind`.

- [ ] **Step 1: Read the current file to confirm shape**

```bash
cat development/front-admin-web/components/overview/OverviewMapBanner.tsx | head -160
```

Expected: matches the structure in the spec — `open` state, `useVehicleFilter()`, `targetLocation` `useMemo` keyed off `selectedBikeId` + `bikePinById`, returns `<section>` with toggle row + canvas.

- [ ] **Step 2: Import the new search component**

At the top, alongside existing imports:

```tsx
import { OverviewMapSearch, type OverviewMapSearchMatch } from "@/components/overview/OverviewMapSearch";
```

- [ ] **Step 3: Add the override state and select handler**

Inside the `OverviewMapBanner` function, after `const { filteredBikeIds, selectedBikeId, setSelectedBikeId } = useVehicleFilter();` and before the existing `effectiveBikePins` `useMemo`, insert:

```tsx
  // 검색 결과 클릭이 박는 즉시 팬 좌표. selectedBikeId 기반 자동 팬과 별도
  // 채널 — BSS 결과는 selectedBikeId 를 안 건드리고 이 override 만 갱신한다.
  // 매 set 마다 새 객체를 만들어 MapShell 의 targetLocation effect 가 재발화.
  const [searchOverride, setSearchOverride] = useState<{ lat: number; lng: number } | null>(null);

  const handleSearchSelect = useCallback(
    (match: OverviewMapSearchMatch) => {
      // 결과가 클릭되면 무조건 지도부터 켠다 — closed 상태에서 검색만 해도
      // 사용자가 지도 토글을 따로 누를 필요 없이 즉시 위치 확인 가능.
      setOpen(true);
      setSearchOverride({ lat: match.latitude, lng: match.longitude });
      if (match.kind === "bike" || match.kind === "rider") {
        setSelectedBikeId(match.bikeId);
      }
      // station 종류는 selectedBikeId 를 건드리지 않는다 — BSS 상세 패널을
      // 두지 않기로 한 스펙 결정. 지도 팬만으로 충분.
    },
    [setSelectedBikeId]
  );
```

You'll also need to add `useState` and `useCallback` to the existing `react` import at the top of the file if they aren't already there:

```tsx
import { useCallback, useEffect, useMemo, useState } from "react";
```

(Adjust the existing import line to include any of those not yet present.)

- [ ] **Step 4: Merge `searchOverride` into the existing `targetLocation` derivation**

Locate the existing `targetLocation` `useMemo`:

```tsx
  const targetLocation = useMemo(() => {
    if (!selectedBikeId) return null;
    const pin = bikePinById.get(selectedBikeId);
    if (!pin) return null;
    return { lat: pin.latitude, lng: pin.longitude };
  }, [selectedBikeId, bikePinById]);
```

Replace it with the version below, which prefers the search override on the click and falls back to the bike-follow derivation. Each branch produces a fresh object so the `MapShell` `targetLocation` effect re-pans even when the same bike is picked twice.

```tsx
  const targetLocation = useMemo(() => {
    if (searchOverride) {
      return { lat: searchOverride.lat, lng: searchOverride.lng };
    }
    if (!selectedBikeId) return null;
    const pin = bikePinById.get(selectedBikeId);
    if (!pin) return null;
    return { lat: pin.latitude, lng: pin.longitude };
  }, [searchOverride, selectedBikeId, bikePinById]);
```

The override stays set even after the click — that's fine, the bike-follow effect already lives in the parent canvas the way it did before. To make a stale override not "stick" forever and start fighting the follow effect, clear it the next time `selectedBikeId` changes _from outside the search path_. The simplest and least invasive way: clear the override whenever `selectedBikeId` changes. Add this effect under the existing `useEffect`:

```tsx
  // 검색 override 는 그 클릭 한 번에만 의미가 있다. 다음에 selectedBikeId
  // 가 다른 차량으로 바뀌면 (예: 표 행 클릭, 다른 검색 결과) follow 흐름에
  // 다시 양보하도록 override 를 비운다.
  useEffect(() => {
    setSearchOverride(null);
  }, [selectedBikeId]);
```

Note: this means a `station` hit's pan position will outlast until `selectedBikeId` changes or the operator clicks elsewhere, which is correct — they want the BSS view to persist until they act again.

- [ ] **Step 5: Render `OverviewMapSearch` in the toggle row**

Find the existing toggle row:

```tsx
      <div className="overview-map-toggle-row">
        <label className="overview-map-toggle">
          <input
            type="checkbox"
            checked={open}
            onChange={(event) => setOpen(event.target.checked)}
          />
          <span>지도 보기</span>
        </label>
        <span className="overview-map-toggle-hint">
          {totalLabel} · {stationPins.length}개 BSS
        </span>
      </div>
```

Insert the search between the toggle label and the hint:

```tsx
      <div className="overview-map-toggle-row">
        <label className="overview-map-toggle">
          <input
            type="checkbox"
            checked={open}
            onChange={(event) => setOpen(event.target.checked)}
          />
          <span>지도 보기</span>
        </label>
        <OverviewMapSearch
          bikePins={bikePins}
          stationPins={stationPins}
          bikeActiveRiderById={bikeActiveRiderById}
          riderInfoById={riderInfoById}
          onSelect={handleSearchSelect}
        />
        <span className="overview-map-toggle-hint">
          {totalLabel} · {stationPins.length}개 BSS
        </span>
      </div>
```

- [ ] **Step 6: Static checks pass**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web
npm run typecheck
npm run lint
```

Expected: exit 0. The `handleSearchSelect` callback is now wired, so an unused-warning won't trigger.

- [ ] **Step 7: Commit**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain
git add development/front-admin-web/components/overview/OverviewMapBanner.tsx
git commit -m "Embed OverviewMapSearch in the map banner toggle row with auto-open + pan"
```

---

## Task 4: CSS for inline search placement

**Files:**
- Modify: `development/front-admin-web/app/globals.css`

The existing `.monitoring-search*` styles assume `position: absolute; top: 16px; left: 96px;` — that's for the old `/monitoring` full-screen layout, not the inline toggle-row placement. Add a parallel `overview-map-search` family with `position: relative` for the dropdown anchor.

- [ ] **Step 1: Find the existing `.overview-map-toggle-row` rule**

```bash
grep -n "overview-map-toggle-row\|overview-map-toggle " development/front-admin-web/app/globals.css | head -5
```

You should see a flex container with `align-items: center` and a `gap`. Confirm before adding.

- [ ] **Step 2: Append the search styles**

Add at the end of the file (or right after the existing `.overview-map-*` block):

```css
/* 지도 토글 행 안에 들어가는 검색 인풋 + 결과 드롭다운. 옛 `.monitoring-search`
   는 풀스크린 지도 위 floating 용이라 absolute 좌표가 박혀 있어 재사용 불가.
   여기서는 toggle row 의 flex item 으로 자라고, 드롭다운은 input 기준 absolute
   로 떨어진다. dark/light 토큰은 기존 패널 스타일과 동일하게 따라간다. */
.overview-map-search {
  position: relative;
  flex: 1 1 240px;
  max-width: 360px;
  min-width: 0;
}
.overview-map-search-input {
  width: 100%;
  height: 32px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid var(--rm-line-subtle);
  background: var(--rm-bg-panel-soft);
  color: var(--rm-text-primary);
  font-size: 13px;
  font-family: var(--font-sans);
}
.overview-map-search-input:focus {
  outline: 2px solid var(--rm-accent);
  outline-offset: 0;
  border-color: transparent;
}
.overview-map-search-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 30;
  list-style: none;
  margin: 0;
  padding: 4px;
  border-radius: 10px;
  border: 1px solid var(--rm-line-subtle);
  background: color-mix(in srgb, var(--rm-bg-panel-soft) 96%, transparent);
  box-shadow: var(--shadow-panel);
  max-height: 360px;
  overflow-y: auto;
}
.overview-map-search-item {
  display: grid;
  grid-template-columns: 52px 1fr auto;
  gap: 8px;
  align-items: baseline;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
}
.overview-map-search-item:hover {
  background: var(--rm-bg-section);
}
.overview-map-search-item-chip {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: .05em;
  text-transform: uppercase;
  color: var(--rm-text-secondary);
}
.overview-map-search-item-chip--bike { color: var(--rm-accent); }
.overview-map-search-item-chip--station { color: var(--rm-battery-mid); }
.overview-map-search-item-chip--rider { color: var(--rm-text-primary); }
.overview-map-search-item-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--rm-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.overview-map-search-item-sub {
  font-size: 11px;
  color: var(--rm-text-secondary);
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
}
```

- [ ] **Step 3: Static check the CSS compiles (typecheck doesn't reach CSS, but lint does check unused selectors via Next's CSS pipeline at build time — defer the full check to Task 5)**

No-op step here; just confirm with `git diff app/globals.css` that you added the block once.

- [ ] **Step 4: Commit**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain
git add development/front-admin-web/app/globals.css
git commit -m "Style the inline overview map search input + dropdown"
```

---

## Task 5: Full static-check sweep

**Files:** none (verification only)

- [ ] **Step 1: Run typecheck**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web
npm run typecheck
```

Expected: exit 0. If a `useState` / `useEffect` import is missing in `OverviewMapBanner.tsx`, this is where you'll see it.

- [ ] **Step 2: Run lint**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web
npm run lint
```

Expected: exit 0. Any unused-import / hooks-deps warnings need fixing before moving on.

- [ ] **Step 3: Optional build verify**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web
npm run build
```

Expected: exit 0. Not strictly required, but catches Next.js CSS issues earlier than the manual smoke. Skip if you trust typecheck/lint.

---

## Task 6: Manual smoke against the running dev server

The repo's CLAUDE.md memory says the user runs their own Next dev server. **Do not** start a competing one — instead, probe the user's localhost for the page and verify behavior.

**Files:** none (verification only)

- [ ] **Step 1: Verify the toggle row layout doesn't break at narrow widths**

Open `/` in the browser. The toggle row now contains three flex items: toggle / search / hint. Confirm at a 1280-wide window the search input grows to fill the middle, and the hint sits on the right. At ≤ 720 wide, confirm nothing overflows the section.

- [ ] **Step 2: Bike search → auto-open + pan + detail dialog**

With the map toggle OFF, focus the search and type a known plate substring (e.g. `1234`). The dropdown shows matching bikes labeled with 차량 chip. Click one. Expected:
- the map toggle flips ON immediately,
- the map pans to the bike,
- `VehicleDetailDialog` opens inside the canvas with that bike's data,
- the search input clears and the dropdown closes.

- [ ] **Step 3: Rider search → resolves to bike**

Type part of a rider name with an assigned bike (e.g. partial Korean name). Expected:
- dropdown shows a 라이더 chip row with the rider's name as label and `phone · plate` as sublabel,
- click → map opens, pans to the bike that rider is on, `VehicleDetailDialog` shows that bike + the rider's name/phone in the existing fields,
- riders without an assigned bike are absent from the result list.

- [ ] **Step 4: BSS search → pan only**

Type a partial BSS name or address (e.g. `강남`). Expected:
- dropdown row labeled BSS,
- click → map opens, pans to the BSS,
- **no `VehicleDetailDialog` opens** (a previously open dialog stays open; if the dialog was closed it stays closed),
- if a different bike was selected before, its `VehicleDetailDialog` stays open — the BSS click doesn't dismiss it.

- [ ] **Step 5: Same-result re-click still pans**

Click the same search result twice in a row. Each click should re-pan the map (proven by previously panning the map manually and then re-clicking — the click should snap it back).

- [ ] **Step 6: Outside click closes dropdown without committing**

Type a query, then click outside the input. Dropdown closes, query stays in the input (or clears — verify which is expected by the implementation; current code keeps the typed query until the next focus).

- [ ] **Step 7: Empty inputs degrade gracefully**

Open a vehicle that has no rider assigned and no model name. Confirm the rider category just hides from the dropdown rather than emitting a broken row.

---

## Task 7: PR

**Files:** none (delivery)

- [ ] **Step 1: Push the branch**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain
git push -u origin cc-213-monitoring-search-integration
```

- [ ] **Step 2: Open the PR**

```bash
gh pr create --base dev --head cc-213-monitoring-search-integration \
  --title "Add monitoring-style search (vehicle + BSS + rider) to the root map banner" \
  --body "$(cat <<'EOF'
## Summary
- 루트 페이지 `/` 의 `OverviewMapBanner` 토글 행에 통합 검색 인풋을 추가 — 차량번호 / BSS 이름·주소 / 라이더 이름·연락처 substring 매칭
- 결과 클릭 시 지도 자동 ON + 좌표 pan + (차량/라이더는) 기존 `VehicleDetailDialog` 자동 노출
- 라이더 결과는 `bikeActiveRiderById` 역인덱스로 그 라이더가 타고 있는 bike 의 좌표/패널로 연결 — 라이더 자체는 지도에 마커가 없음
- 백엔드 추가 호출 없음, 100% 클라이언트 매칭 (`bikePins`, `stationPins`, `bikeActiveRiderById`, `riderInfoById` 모두 root 페이지가 이미 props 로 내려보냄)

## Spec
- 디자인: `docs/superpowers/specs/2026-05-23-monitoring-search-integration-design.md`
- 플랜: `docs/superpowers/plans/2026-05-23-monitoring-search-integration.md`

## Test plan
- [x] `npm run typecheck`
- [x] `npm run lint`
- [ ] 차량 검색 → 지도 자동 열기 + 차량 pin 으로 pan + `VehicleDetailDialog` 자동 노출
- [ ] 라이더 검색 → 그 라이더가 타고 있는 차량 좌표로 pan + 차량 상세 노출, 라이더 이름/연락처가 패널에 보임
- [ ] BSS 검색 → 지도 자동 열기 + pan 만, 상세 패널 없음
- [ ] 같은 결과 두 번 클릭해도 매번 다시 pan
- [ ] outside click 으로 dropdown 닫힘
- [ ] 좁은 폭(≤ 720) 에서 토글 행 레이아웃 안 깨짐

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL printed. Share it with the user for review.

---

## Self-Review

**Spec coverage** — checked each spec section:
- "Placement" → Task 3 Step 5 inserts the search between toggle and hint.
- "New component OverviewMapSearch" → Task 2 builds it with all three kinds.
- "Wiring inside OverviewMapBanner" → Task 3 Steps 3–5 cover the override state, select handler, and the `targetLocation` merge.
- "Data sources (no new fetches)" → respected; only props already passed to the banner are used.
- "User-visible behavior" → Task 6 Steps 2–6 smoke-test each bullet.
- "Error handling & edge cases" → covered: rider without assigned bike filtered out (Task 2 Step 1 logic), pin-not-found falls through (no entry pushed), BSS click doesn't clobber selected bike (`station` branch doesn't touch `selectedBikeId`), `searchOverride` cleared on next `selectedBikeId` change so follow effect resumes (Task 3 Step 4 `useEffect`).
- "Testing — manual smoke" → Task 6 enumerates each bullet from the spec.
- "Out-of-scope follow-ups" → not implemented; consistent with spec.

**Placeholder scan** — no "TODO", "TBD", "implement later", or "similar to" references. Every code block is complete code that can be pasted directly.

**Type consistency** — `OverviewMapSearchMatch` discriminated union in Task 2 matches the `match.kind === "bike" | "station" | "rider"` switches in Task 3. `searchOverride` shape `{ lat: number; lng: number } | null` matches the `targetLocation` shape `{ lat: number; lng: number } | null` consumed by `MapShell`.

**Scope** — single PR, three files modified/created, no backend or shared library changes.
