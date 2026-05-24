# Fullscreen Map Mode — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fullscreen map overlay to `/` with all 14 management filters (vehicle / rider / BSS) on a left collapsible aside, opened from a `[⛶ 전체화면]` button next to the existing 지도 보기 toggle.

**Architecture:** Filter state stays mode-local — table panels keep their own `useState`, fullscreen overlay owns its own. The DRY refactor is contained to pure helpers (`applyVehicleFilters/RidersFilter/StationFilters`) and presentational filter-UI components shared by both modes. The overlay sits at `position: fixed; inset: 0; z-index: 100`; entry/exit via a context flag.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript. No new runtime deps. No backend changes. No test runner exists — verification is `npm run typecheck` + `npm run lint` + manual smoke checklist.

**Reference doc:** `docs/superpowers/specs/2026-05-24-fullscreen-map-mode-design.md`.

---

## File Structure

| Path | Purpose | Action |
| ---- | ------- | ------ |
| `components/overview/filter-compute.ts` | Types + three pure helpers — `applyVehicleFilters`, `applyRiderFilters`, `applyStationFilters` | **Create** |
| `components/overview/VehicleFilterControls.tsx` | Presentational filter UI — 6 controls, `layout="horizontal"\|"vertical"` | **Create** |
| `components/overview/RiderFilterControls.tsx` | 6 rider filter controls, both layouts | **Create** |
| `components/overview/StationFilterControls.tsx` | 2 station filter controls, both layouts | **Create** |
| `components/overview/FullscreenMapHost.tsx` | Overlay container — owns filter state, mounts MapShell + filters + detail dialog | **Create** |
| `components/overview/VehicleFilterContext.tsx` | Add `fullscreenMapOpen` + setter | **Modify** |
| `components/overview/OverviewMapBanner.tsx` | Add `[⛶ 전체화면]` button in toggle row | **Modify** |
| `components/management/VehiclesPanel.tsx` | Replace inline filter UI + compute with extracted modules (identical behavior) | **Modify** |
| `components/management/RidersPanel.tsx` | Same DRY refactor | **Modify** |
| `components/management/StationsPanel.tsx` | Same DRY refactor | **Modify** |
| `app/page.tsx` | Mount `<FullscreenMapHost />` next to other client shells | **Modify** |
| `app/globals.css` | Fullscreen overlay styles | **Modify** |

No tests directory — verification = typecheck + lint + manual smoke at the end of the plan.

---

## Task 1: Branch + sanity check

**Files:** none (setup)

- [ ] **Step 1: Confirm branch state**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain
git status
git log --oneline -3
```

Expected: branch `cc-214-fullscreen-map-mode`, most recent commit is the spec update `fa06f55` (and earlier `f1b9db7` for spec creation). Working tree clean.

If not on the branch:
```bash
git checkout cc-214-fullscreen-map-mode
```

- [ ] **Step 2: Confirm spec is committed**

```bash
ls docs/superpowers/specs/2026-05-24-fullscreen-map-mode-design.md
ls docs/superpowers/plans/2026-05-24-fullscreen-map-mode.md
```

Both must exist.

---

## Task 2: Extract `filter-compute.ts` (types + 3 pure helpers)

**Files:**
- Create: `development/front-admin-web/components/overview/filter-compute.ts`

Three pure helpers that take raw data + filter state and return the matching set. Mirror the existing inline logic from each panel byte-for-byte so the panel refactor in later tasks doesn't change behavior.

- [ ] **Step 1: Create the file with all types and helpers**

Read the existing logic before writing — these helpers MUST produce identical output to the inline code in:
- `development/front-admin-web/components/management/VehiclesPanel.tsx:139-188` (vehicles)
- `development/front-admin-web/components/management/RidersPanel.tsx:93-147` (riders)
- `development/front-admin-web/components/management/StationsPanel.tsx:44-61` (stations)

Write to the new file:

```ts
import type {
  FrontendDashboardBikePin,
  FrontendStation,
  FrontendVehicle,
  ServiceOpsBikeOperationStatus,
  ServiceOpsRider,
  ServiceOpsRiderEducationType
} from "@/lib/services/service-ops-api";
import type { RiderActiveContractSummary } from "@/lib/services/rider-data";
import type { VehicleMaintenanceSummary } from "@/components/management/vehicle-maintenance-derive";

/**
 * 차량 / 라이더 / BSS 세 패널 + 풀스크린 지도 오버레이가 공유하는 필터
 * 정의 + pure 컴퓨테이션 헬퍼. 패널들이 자기 useState 로 들고 있던 로직을
 * 그대로 옮긴 거라 동일 입력 → 동일 출력 (회귀 방지).
 */

export type VehicleFilterState = {
  query: string;
  engineType: "ALL" | "ELECTRIC" | "ICE";
  operationStatus: "ALL" | "READY" | "IN_SERVICE";
  connection: "ALL" | "ONLINE" | "ANY_OFFLINE";
  ignition: "ALL" | "ON" | "OFF";
  maintenance: "ALL" | "DUE_SOON" | "OVERDUE" | "ANY";
};

export const DEFAULT_VEHICLE_FILTERS: VehicleFilterState = {
  query: "",
  engineType: "ALL",
  operationStatus: "ALL",
  connection: "ALL",
  ignition: "ALL",
  maintenance: "ALL"
};

export type RiderFilterState = {
  query: string;
  education: "ALL" | "ONLINE" | "OFFLINE" | "NONE";
  assignment: "ALL" | "ASSIGNED" | "UNASSIGNED";
  contractCategory: "ALL" | "SUBSCRIPTION" | "RENTAL" | "CUSTOM";
  insurance: "ALL" | "HAS" | "NONE";
  ignition: "ALL" | "ON" | "OFF" | "UNASSIGNED";
};

export const DEFAULT_RIDER_FILTERS: RiderFilterState = {
  query: "",
  education: "ALL",
  assignment: "ALL",
  contractCategory: "ALL",
  insurance: "ALL",
  ignition: "ALL"
};

export type StationFilterState = {
  query: string;
  stock: "ALL" | "OK" | "LOW";
};

export const DEFAULT_STATION_FILTERS: StationFilterState = {
  query: "",
  stock: "ALL"
};

/**
 * BSS 재고 부족 임계값 — 가용 / 최대 ≤ 30% 면 부족으로 분류. 옛
 * `StationsPanel` 의 LOW_STOCK_RATIO 상수와 동일.
 */
export const LOW_STOCK_RATIO = 0.3;

function statusToOperation(status: FrontendVehicle["status"]): ServiceOpsBikeOperationStatus {
  return status === "운행" ? "IN_SERVICE" : "READY";
}

function maxBatteryCount(station: FrontendStation): number {
  return station.maxBatteryCapacity ?? 0;
}

function availableBatteryCount(station: FrontendStation): number {
  return station.availableBatteryCount ?? 0;
}

/**
 * 차량 필터 적용. 옛 `VehiclesPanel.tsx:139-188` 와 동일 로직.
 */
export function applyVehicleFilters(input: {
  vehicles: ReadonlyArray<FrontendVehicle>;
  filters: VehicleFilterState;
  bikePinById: Map<string, FrontendDashboardBikePin>;
  deviceUidByBikeId?: Map<string, string>;
  maintenanceSummaryByBike?: Map<string, VehicleMaintenanceSummary>;
}): FrontendVehicle[] {
  const { vehicles, filters, bikePinById, deviceUidByBikeId, maintenanceSummaryByBike } = input;
  const q = filters.query.trim().toLowerCase();
  return vehicles.filter((vehicle) => {
    const vehicleKey = vehicle.id ?? vehicle.slug;
    if (q) {
      const plateMatch = vehicle.plateNumber.toLowerCase().includes(q);
      const modelMatch = (vehicle.model ?? "").toLowerCase().includes(q);
      const imei = deviceUidByBikeId?.get(vehicleKey) ?? "";
      const imeiMatch = imei.toLowerCase().includes(q);
      if (!plateMatch && !modelMatch && !imeiMatch) return false;
    }
    if (filters.engineType !== "ALL") {
      const et = vehicle.engineType ?? "ELECTRIC";
      if (et !== filters.engineType) return false;
    }
    if (filters.operationStatus !== "ALL") {
      const op = vehicle.operationStatus ?? statusToOperation(vehicle.status);
      if (op !== filters.operationStatus) return false;
    }
    if (filters.connection !== "ALL") {
      const pin = bikePinById.get(vehicleKey);
      const status = pin?.connectionStatus;
      if (filters.connection === "ONLINE") {
        if (status !== "ONLINE") return false;
      } else {
        if (status === "ONLINE") return false;
      }
    }
    if (filters.ignition !== "ALL") {
      const pin = bikePinById.get(vehicleKey);
      const status = pin?.ignitionStatus;
      if (filters.ignition === "ON" && status !== "ON") return false;
      if (filters.ignition === "OFF" && status === "ON") return false;
    }
    if (filters.maintenance !== "ALL") {
      const summary = maintenanceSummaryByBike?.get(vehicleKey);
      if (!summary) return false;
      if (filters.maintenance === "OVERDUE" && !summary.hasOverdue) return false;
      if (filters.maintenance === "DUE_SOON" && !summary.hasDueSoon) return false;
      if (filters.maintenance === "ANY" && !summary.hasOverdue && !summary.hasDueSoon) return false;
    }
    return true;
  });
}

/**
 * 라이더 필터 적용. 옛 `RidersPanel.tsx:93-147` 와 동일 로직.
 */
export function applyRiderFilters(input: {
  riders: ReadonlyArray<ServiceOpsRider>;
  filters: RiderFilterState;
  educationTypeByRiderId?: Map<string, ServiceOpsRiderEducationType>;
  riderActiveBikeId?: Map<string, string>;
  riderActiveBikePlate?: Map<string, string>;
  riderActiveContractById?: Map<string, RiderActiveContractSummary>;
  insuredRiderIds?: ReadonlySet<string>;
  ignitionStatusByBikeId?: Map<string, string>;
}): ServiceOpsRider[] {
  const {
    riders,
    filters,
    educationTypeByRiderId,
    riderActiveBikeId,
    riderActiveBikePlate,
    riderActiveContractById,
    insuredRiderIds,
    ignitionStatusByBikeId
  } = input;
  const q = filters.query.trim().toLowerCase();
  return riders.filter((rider) => {
    const riderKey = rider.id ?? rider.slug;
    if (q) {
      const nameMatch = rider.name.toLowerCase().includes(q);
      const phoneMatch = rider.phone.toLowerCase().includes(q);
      const plate = riderActiveBikePlate?.get(riderKey) ?? "";
      const plateMatch = plate.toLowerCase().includes(q);
      if (!nameMatch && !phoneMatch && !plateMatch) return false;
    }
    if (filters.education !== "ALL") {
      const eduType = educationTypeByRiderId?.get(riderKey) ?? null;
      if (filters.education === "NONE" && eduType !== null) return false;
      if ((filters.education === "ONLINE" || filters.education === "OFFLINE") && eduType !== filters.education) return false;
    }
    if (filters.assignment !== "ALL") {
      const hasBike = Boolean(riderActiveBikeId?.get(riderKey));
      if (filters.assignment === "ASSIGNED" && !hasBike) return false;
      if (filters.assignment === "UNASSIGNED" && hasBike) return false;
    }
    if (filters.contractCategory !== "ALL") {
      const category = riderActiveContractById?.get(riderKey)?.category ?? null;
      if (category !== filters.contractCategory) return false;
    }
    if (filters.insurance !== "ALL") {
      const has = insuredRiderIds?.has(riderKey) ?? false;
      if (filters.insurance === "HAS" && !has) return false;
      if (filters.insurance === "NONE" && has) return false;
    }
    if (filters.ignition !== "ALL") {
      const activeBikeId = riderActiveBikeId?.get(riderKey) ?? null;
      if (filters.ignition === "UNASSIGNED") {
        if (activeBikeId) return false;
      } else {
        if (!activeBikeId) return false;
        const status = ignitionStatusByBikeId?.get(activeBikeId);
        if (filters.ignition === "ON" && status !== "ON") return false;
        if (filters.ignition === "OFF" && status === "ON") return false;
      }
    }
    return true;
  });
}

/**
 * BSS 필터 적용. 옛 `StationsPanel.tsx:44-61` 와 동일 로직.
 */
export function applyStationFilters(input: {
  stations: ReadonlyArray<FrontendStation>;
  filters: StationFilterState;
}): FrontendStation[] {
  const { stations, filters } = input;
  const q = filters.query.trim().toLowerCase();
  return stations.filter((station) => {
    if (q) {
      if (!station.address.toLowerCase().includes(q)) return false;
    }
    if (filters.stock !== "ALL") {
      const max = maxBatteryCount(station);
      const available = availableBatteryCount(station);
      const low = max === 0 || available / max <= LOW_STOCK_RATIO;
      if (filters.stock === "LOW" && !low) return false;
      if (filters.stock === "OK" && low) return false;
    }
    return true;
  });
}
```

- [ ] **Step 2: Run static checks**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web
npm run typecheck
npm run lint
```

Both must exit 0. If `RiderActiveContractSummary` import fails, check the actual export name in `lib/services/rider-data.ts` and adjust the import. If `FrontendStation` doesn't have `availableBatteryCount` / `maxBatteryCapacity` directly, inspect `lib/services/station-data.ts` to confirm field names and adjust the helper accordingly.

- [ ] **Step 3: Commit**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain
git add development/front-admin-web/components/overview/filter-compute.ts
git commit -m "Extract filter state types + pure compute helpers

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Extract `VehicleFilterControls.tsx` + refactor `VehiclesPanel`

**Files:**
- Create: `development/front-admin-web/components/overview/VehicleFilterControls.tsx`
- Modify: `development/front-admin-web/components/management/VehiclesPanel.tsx`

- [ ] **Step 1: Create the controls component**

```tsx
"use client";

import type { VehicleFilterState } from "@/components/overview/filter-compute";

/**
 * 차량 필터 6 컨트롤의 presentational 컴포넌트. 표(VehiclesPanel) 의
 * 가로 행과 풀스크린 지도 좌측 aside 의 세로 stack 두 layout 을 모두 지원.
 *
 * `layout="horizontal"` 은 옛 `.vehicles-filter-row` 클래스로 떨어지고
 * (현재 표의 모습 그대로), `"vertical"` 은 새 `.filter-stack` 클래스로
 * 세로 정렬된 입력들이 된다.
 */
export interface VehicleFilterControlsProps {
  filters: VehicleFilterState;
  onChange: (next: VehicleFilterState) => void;
  layout: "horizontal" | "vertical";
  count?: { visible: number; total: number };
}

export function VehicleFilterControls({ filters, onChange, layout, count }: VehicleFilterControlsProps) {
  const rowClass = layout === "horizontal" ? "vehicles-filter-row" : "filter-stack";
  return (
    <div className={rowClass}>
      <div className="vehicles-filter-search-wrap">
        <input
          className="vehicles-filter-search"
          type="search"
          placeholder="차량번호, 모델명, IMEI 검색"
          value={filters.query}
          onChange={(event) => onChange({ ...filters, query: event.target.value })}
        />
        <span className="vehicles-filter-search-icon" aria-hidden="true">🔍</span>
      </div>
      <select
        className="vehicles-filter-select"
        value={filters.engineType}
        onChange={(event) =>
          onChange({ ...filters, engineType: event.target.value as VehicleFilterState["engineType"] })
        }
      >
        <option value="ALL">구분: 전체</option>
        <option value="ELECTRIC">전기</option>
        <option value="ICE">내연</option>
      </select>
      <select
        className="vehicles-filter-select"
        value={filters.operationStatus}
        onChange={(event) =>
          onChange({ ...filters, operationStatus: event.target.value as VehicleFilterState["operationStatus"] })
        }
      >
        <option value="ALL">운영 상태: 전체</option>
        <option value="IN_SERVICE">운행</option>
        <option value="READY">대기</option>
      </select>
      <select
        className="vehicles-filter-select"
        value={filters.connection}
        onChange={(event) =>
          onChange({ ...filters, connection: event.target.value as VehicleFilterState["connection"] })
        }
      >
        <option value="ALL">연결 상태: 전체</option>
        <option value="ONLINE">온라인</option>
        <option value="ANY_OFFLINE">오프라인/신호끊김</option>
      </select>
      <select
        className="vehicles-filter-select"
        value={filters.ignition}
        onChange={(event) =>
          onChange({ ...filters, ignition: event.target.value as VehicleFilterState["ignition"] })
        }
      >
        <option value="ALL">시동: 전체</option>
        <option value="ON">ON</option>
        <option value="OFF">OFF</option>
      </select>
      <select
        className="vehicles-filter-select"
        value={filters.maintenance}
        onChange={(event) =>
          onChange({ ...filters, maintenance: event.target.value as VehicleFilterState["maintenance"] })
        }
      >
        <option value="ALL">정비 상태: 전체</option>
        <option value="ANY">임박 + 지연</option>
        <option value="DUE_SOON">임박만</option>
        <option value="OVERDUE">지연만</option>
      </select>
      {count ? (
        <span className="vehicles-filter-count">
          {count.visible} / {count.total}
        </span>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Refactor `VehiclesPanel` to use the extracted module**

In `development/front-admin-web/components/management/VehiclesPanel.tsx`:

(a) Add the new imports near the top with other component imports:

```ts
import {
  applyVehicleFilters,
  DEFAULT_VEHICLE_FILTERS,
  type VehicleFilterState
} from "@/components/overview/filter-compute";
import { VehicleFilterControls } from "@/components/overview/VehicleFilterControls";
```

(b) DELETE the inline `type FilterState = {...}` declaration (around line 57-67) and the `const DEFAULT_FILTERS: FilterState = {...}` (around line 69-76). They're replaced by the imports above.

(c) Update the `useState` line:

```ts
const [filters, setFilters] = useState<VehicleFilterState>(DEFAULT_VEHICLE_FILTERS);
```

(d) Replace the `visibleVehicles` useMemo body (around line 139-188) with a call to the helper:

```tsx
const visibleVehicles = useMemo(
  () =>
    applyVehicleFilters({
      vehicles: data.vehicles,
      filters,
      bikePinById,
      deviceUidByBikeId,
      maintenanceSummaryByBike
    }),
  [data.vehicles, filters, bikePinById, deviceUidByBikeId, maintenanceSummaryByBike]
);
```

(e) Replace the inline filter row JSX (around line 218-289) with:

```tsx
<VehicleFilterControls
  filters={filters}
  onChange={setFilters}
  layout="horizontal"
  count={{ visible: visibleVehicles.length, total: data.vehicles.length }}
/>
```

The local `statusToOperation` helper in `VehiclesPanel` (if any) can be removed — it now lives in `filter-compute.ts`.

- [ ] **Step 3: Static checks**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web
npm run typecheck
npm run lint
```

Both must exit 0. If `useState` or `useMemo` becomes unused after the trim, ESLint will say so — drop those imports.

- [ ] **Step 4: Commit**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain
git add development/front-admin-web/components/overview/VehicleFilterControls.tsx development/front-admin-web/components/management/VehiclesPanel.tsx
git commit -m "Extract VehicleFilterControls + use the shared compute helper

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Extract `RiderFilterControls.tsx` + refactor `RidersPanel`

**Files:**
- Create: `development/front-admin-web/components/overview/RiderFilterControls.tsx`
- Modify: `development/front-admin-web/components/management/RidersPanel.tsx`

- [ ] **Step 1: Create the controls component**

```tsx
"use client";

import type { RiderFilterState } from "@/components/overview/filter-compute";

export interface RiderFilterControlsProps {
  filters: RiderFilterState;
  onChange: (next: RiderFilterState) => void;
  layout: "horizontal" | "vertical";
  count?: { visible: number; total: number };
}

export function RiderFilterControls({ filters, onChange, layout, count }: RiderFilterControlsProps) {
  const rowClass = layout === "horizontal" ? "vehicles-filter-row" : "filter-stack";
  return (
    <div className={rowClass}>
      <div className="vehicles-filter-search-wrap">
        <input
          className="vehicles-filter-search"
          type="search"
          placeholder="이름, 연락처, 차량번호 검색"
          value={filters.query}
          onChange={(event) => onChange({ ...filters, query: event.target.value })}
        />
        <span className="vehicles-filter-search-icon" aria-hidden="true">🔍</span>
      </div>
      <select
        className="vehicles-filter-select"
        value={filters.education}
        onChange={(event) =>
          onChange({ ...filters, education: event.target.value as RiderFilterState["education"] })
        }
      >
        <option value="ALL">교육: 전체</option>
        <option value="ONLINE">온라인</option>
        <option value="OFFLINE">오프라인</option>
        <option value="NONE">미수료</option>
      </select>
      <select
        className="vehicles-filter-select"
        value={filters.assignment}
        onChange={(event) =>
          onChange({ ...filters, assignment: event.target.value as RiderFilterState["assignment"] })
        }
      >
        <option value="ALL">차량 배정: 전체</option>
        <option value="ASSIGNED">배정됨</option>
        <option value="UNASSIGNED">미배정</option>
      </select>
      <select
        className="vehicles-filter-select"
        value={filters.contractCategory}
        onChange={(event) =>
          onChange({ ...filters, contractCategory: event.target.value as RiderFilterState["contractCategory"] })
        }
      >
        <option value="ALL">구독/렌탈: 전체</option>
        <option value="SUBSCRIPTION">구독</option>
        <option value="RENTAL">렌탈</option>
        <option value="CUSTOM">커스텀</option>
      </select>
      <select
        className="vehicles-filter-select"
        value={filters.insurance}
        onChange={(event) =>
          onChange({ ...filters, insurance: event.target.value as RiderFilterState["insurance"] })
        }
      >
        <option value="ALL">보험: 전체</option>
        <option value="HAS">가입</option>
        <option value="NONE">미가입</option>
      </select>
      <select
        className="vehicles-filter-select"
        value={filters.ignition}
        onChange={(event) =>
          onChange({ ...filters, ignition: event.target.value as RiderFilterState["ignition"] })
        }
      >
        <option value="ALL">시동: 전체</option>
        <option value="ON">ON</option>
        <option value="OFF">OFF</option>
        <option value="UNASSIGNED">미배정</option>
      </select>
      {count ? (
        <span className="vehicles-filter-count">
          {count.visible} / {count.total}
        </span>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Refactor `RidersPanel`**

(a) Add imports:

```ts
import {
  applyRiderFilters,
  DEFAULT_RIDER_FILTERS,
  type RiderFilterState
} from "@/components/overview/filter-compute";
import { RiderFilterControls } from "@/components/overview/RiderFilterControls";
```

(b) DELETE the inline `type FilterState = {...}` and `const DEFAULT_FILTERS = {...}` near the top of the file.

(c) Update the `useState`:

```ts
const [filters, setFilters] = useState<RiderFilterState>(DEFAULT_RIDER_FILTERS);
```

(d) Replace the `visibleRiders` useMemo body with:

```tsx
const visibleRiders = useMemo(
  () =>
    applyRiderFilters({
      riders: data.riders,
      filters,
      educationTypeByRiderId,
      riderActiveBikeId,
      riderActiveBikePlate,
      riderActiveContractById,
      insuredRiderIds,
      ignitionStatusByBikeId
    }),
  [
    data.riders,
    filters,
    educationTypeByRiderId,
    riderActiveBikeId,
    riderActiveBikePlate,
    riderActiveContractById,
    insuredRiderIds,
    ignitionStatusByBikeId
  ]
);
```

(e) Replace the inline filter row JSX with:

```tsx
<RiderFilterControls
  filters={filters}
  onChange={setFilters}
  layout="horizontal"
  count={{ visible: visibleRiders.length, total: data.riders.length }}
/>
```

- [ ] **Step 3: Static checks** — same as Task 3 Step 3, both must exit 0.

- [ ] **Step 4: Commit**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain
git add development/front-admin-web/components/overview/RiderFilterControls.tsx development/front-admin-web/components/management/RidersPanel.tsx
git commit -m "Extract RiderFilterControls + use the shared compute helper

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Extract `StationFilterControls.tsx` + refactor `StationsPanel`

**Files:**
- Create: `development/front-admin-web/components/overview/StationFilterControls.tsx`
- Modify: `development/front-admin-web/components/management/StationsPanel.tsx`

- [ ] **Step 1: Create the controls component**

```tsx
"use client";

import { LOW_STOCK_RATIO, type StationFilterState } from "@/components/overview/filter-compute";

export interface StationFilterControlsProps {
  filters: StationFilterState;
  onChange: (next: StationFilterState) => void;
  layout: "horizontal" | "vertical";
  count?: { visible: number; total: number };
}

export function StationFilterControls({ filters, onChange, layout, count }: StationFilterControlsProps) {
  const rowClass = layout === "horizontal" ? "vehicles-filter-row" : "filter-stack";
  return (
    <div className={rowClass}>
      <div className="vehicles-filter-search-wrap">
        <input
          className="vehicles-filter-search"
          type="search"
          placeholder="주소 검색"
          value={filters.query}
          onChange={(event) => onChange({ ...filters, query: event.target.value })}
        />
        <span className="vehicles-filter-search-icon" aria-hidden="true">🔍</span>
      </div>
      <select
        className="vehicles-filter-select"
        value={filters.stock}
        onChange={(event) =>
          onChange({ ...filters, stock: event.target.value as StationFilterState["stock"] })
        }
      >
        <option value="ALL">잔여 상태: 전체</option>
        <option value="OK">정상</option>
        <option value="LOW">재고 부족 (≤ {Math.round(LOW_STOCK_RATIO * 100)}%)</option>
      </select>
      {count ? (
        <span className="vehicles-filter-count">
          {count.visible} / {count.total}
        </span>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Refactor `StationsPanel`**

(a) Add imports:

```ts
import {
  applyStationFilters,
  DEFAULT_STATION_FILTERS,
  type StationFilterState
} from "@/components/overview/filter-compute";
import { StationFilterControls } from "@/components/overview/StationFilterControls";
```

(b) DELETE the inline `type FilterState = {...}`, `const DEFAULT_FILTERS = {...}`, AND `const LOW_STOCK_RATIO = 0.3;` from the file (the constant now lives in `filter-compute.ts` and is re-exported via `StationFilterControls`).

(c) Update the `useState`:

```ts
const [filters, setFilters] = useState<StationFilterState>(DEFAULT_STATION_FILTERS);
```

(d) Replace the `visibleStations` useMemo body with:

```tsx
const visibleStations = useMemo(
  () => applyStationFilters({ stations: data.stations, filters }),
  [data.stations, filters]
);
```

(e) Replace the inline filter row JSX with:

```tsx
<StationFilterControls
  filters={filters}
  onChange={setFilters}
  layout="horizontal"
  count={{ visible: visibleStations.length, total: data.stations.length }}
/>
```

(f) If `StationsPanel` had a local helper using `LOW_STOCK_RATIO` (e.g. inline percent label), reference the imported constant instead.

- [ ] **Step 3: Static checks** — same.

- [ ] **Step 4: Commit**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain
git add development/front-admin-web/components/overview/StationFilterControls.tsx development/front-admin-web/components/management/StationsPanel.tsx
git commit -m "Extract StationFilterControls + use the shared compute helper

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Add `fullscreenMapOpen` to `VehicleFilterContext`

**Files:**
- Modify: `development/front-admin-web/components/overview/VehicleFilterContext.tsx`

- [ ] **Step 1: Apply the change**

Read the file first to confirm current shape, then edit.

Add to the `FilterContextValue` type:

```ts
type FilterContextValue = {
  filteredBikeIds: ReadonlySet<string> | null;
  setFilteredBikeIds: (ids: ReadonlySet<string> | null) => void;
  selectedBikeId: string | null;
  setSelectedBikeId: (id: string | null) => void;
  fullscreenMapOpen: boolean;
  setFullscreenMapOpen: (open: boolean) => void;
};
```

In the provider, add a new state slice and include it in the `value`:

```tsx
const [fullscreenMapOpen, setFullscreenRaw] = useState(false);
const setFullscreenMapOpen = useCallback((open: boolean) => {
  setFullscreenRaw(open);
}, []);

const value = useMemo<FilterContextValue>(
  () => ({
    filteredBikeIds,
    setFilteredBikeIds,
    selectedBikeId,
    setSelectedBikeId,
    fullscreenMapOpen,
    setFullscreenMapOpen
  }),
  [filteredBikeIds, setFilteredBikeIds, selectedBikeId, setSelectedBikeId, fullscreenMapOpen, setFullscreenMapOpen]
);
```

Also update the no-context fallback in `useVehicleFilter()`:

```ts
if (!ctx) {
  return {
    filteredBikeIds: null,
    setFilteredBikeIds: () => {},
    selectedBikeId: null,
    setSelectedBikeId: () => {},
    fullscreenMapOpen: false,
    setFullscreenMapOpen: () => {}
  };
}
```

- [ ] **Step 2: Static checks**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web
npm run typecheck
npm run lint
```

Both must exit 0.

- [ ] **Step 3: Commit**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain
git add development/front-admin-web/components/overview/VehicleFilterContext.tsx
git commit -m "Add fullscreenMapOpen channel to VehicleFilterContext

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Add `[⛶ 전체화면]` button to `OverviewMapBanner`

**Files:**
- Modify: `development/front-admin-web/components/overview/OverviewMapBanner.tsx`

- [ ] **Step 1: Add the button to the toggle row**

In the destructure from `useVehicleFilter()`, add `setFullscreenMapOpen`:

```tsx
const { filteredBikeIds, selectedBikeId, setSelectedBikeId, setFullscreenMapOpen } = useVehicleFilter();
```

In the JSX, modify the toggle row to add the button right after the `<OverviewMapSearch ... />`:

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
  <button
    type="button"
    className="overview-map-fullscreen-button"
    onClick={() => setFullscreenMapOpen(true)}
    title="전체화면 지도 보기"
  >
    ⛶ 전체화면
  </button>
  <span className="overview-map-toggle-hint">
    {totalLabel} · {stationPins.length}개 BSS
  </span>
</div>
```

- [ ] **Step 2: Static checks** — same.

- [ ] **Step 3: Commit**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain
git add development/front-admin-web/components/overview/OverviewMapBanner.tsx
git commit -m "Add 전체화면 button to the map banner toggle row

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Build `FullscreenMapHost.tsx`

**Files:**
- Create: `development/front-admin-web/components/overview/FullscreenMapHost.tsx`

The overlay container. Reads `fullscreenMapOpen` from context, mounts the full-viewport overlay with left filter aside + main map canvas + close button. Filter state and compute live entirely inside this component.

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";

import { MapShell } from "@/components/dashboard/MapShell";
import { VehicleDetailDialog, type VehicleDetailRow } from "@/components/management/VehicleDetailDialog";
import { useVehicleFilter } from "@/components/overview/VehicleFilterContext";
import {
  applyRiderFilters,
  applyStationFilters,
  applyVehicleFilters,
  DEFAULT_RIDER_FILTERS,
  DEFAULT_STATION_FILTERS,
  DEFAULT_VEHICLE_FILTERS,
  type RiderFilterState,
  type StationFilterState,
  type VehicleFilterState
} from "@/components/overview/filter-compute";
import { RiderFilterControls } from "@/components/overview/RiderFilterControls";
import { StationFilterControls } from "@/components/overview/StationFilterControls";
import { VehicleFilterControls } from "@/components/overview/VehicleFilterControls";
import { OverviewMapSearch, type OverviewMapSearchMatch } from "@/components/overview/OverviewMapSearch";
import type {
  FrontendDashboardBikePin,
  FrontendDashboardStationPin,
  FrontendStation,
  FrontendVehicle,
  ServiceOpsRider,
  ServiceOpsRiderEducationType
} from "@/lib/services/service-ops-api";
import type { RiderActiveContractSummary } from "@/lib/services/rider-data";
import type { VehicleMaintenanceSummary } from "@/components/management/vehicle-maintenance-derive";

/**
 * 전체화면 지도 모드. `OverviewMapBanner` 의 [⛶ 전체화면] 버튼이
 * `setFullscreenMapOpen(true)` 를 호출하면 이 컴포넌트가 viewport 전체를
 * 덮는 fixed-position 오버레이를 마운트한다.
 *
 * 필터 state 는 이 컴포넌트 내부 useState 3 슬라이스 — 표 패널들과 공유하지
 * 않고, 닫으면 사라진다 (재진입 시 defaults).
 */
export interface FullscreenMapHostProps {
  bikePins: ReadonlyArray<FrontendDashboardBikePin>;
  stationPins: ReadonlyArray<FrontendDashboardStationPin>;
  vehicles: ReadonlyArray<FrontendVehicle>;
  riders: ReadonlyArray<ServiceOpsRider>;
  stations: ReadonlyArray<FrontendStation>;
  bikeActiveRiderById?: Map<string, string>;
  riderInfoById?: Map<string, { name: string; phone: string }>;
  deviceUidByBikeId?: Map<string, string>;
  maintenanceSummaryByBike?: Map<string, VehicleMaintenanceSummary>;
  educationTypeByRiderId?: Map<string, ServiceOpsRiderEducationType>;
  riderActiveBikeId?: Map<string, string>;
  riderActiveBikePlate?: Map<string, string>;
  riderActiveContractById?: Map<string, RiderActiveContractSummary>;
  insuredRiderIds?: ReadonlySet<string>;
  ignitionStatusByBikeId?: Map<string, string>;
}

export function FullscreenMapHost(props: FullscreenMapHostProps) {
  const { fullscreenMapOpen, setFullscreenMapOpen, selectedBikeId, setSelectedBikeId } = useVehicleFilter();

  // ESC 으로 닫기. open 상태일 때만 listener 부착.
  useEffect(() => {
    if (!fullscreenMapOpen) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullscreenMapOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [fullscreenMapOpen, setFullscreenMapOpen]);

  if (!fullscreenMapOpen) return null;

  return <FullscreenMapOverlay {...props} onClose={() => setFullscreenMapOpen(false)} selectedBikeId={selectedBikeId} setSelectedBikeId={setSelectedBikeId} />;
}

function FullscreenMapOverlay({
  bikePins,
  stationPins,
  vehicles,
  riders,
  stations,
  bikeActiveRiderById,
  riderInfoById,
  deviceUidByBikeId,
  maintenanceSummaryByBike,
  educationTypeByRiderId,
  riderActiveBikeId,
  riderActiveBikePlate,
  riderActiveContractById,
  insuredRiderIds,
  ignitionStatusByBikeId,
  onClose,
  selectedBikeId,
  setSelectedBikeId
}: FullscreenMapHostProps & {
  onClose: () => void;
  selectedBikeId: string | null;
  setSelectedBikeId: (id: string | null) => void;
}) {
  const [vehicleFilters, setVehicleFilters] = useState<VehicleFilterState>(DEFAULT_VEHICLE_FILTERS);
  const [riderFilters, setRiderFilters] = useState<RiderFilterState>(DEFAULT_RIDER_FILTERS);
  const [stationFilters, setStationFilters] = useState<StationFilterState>(DEFAULT_STATION_FILTERS);
  const [searchOverride, setSearchOverride] = useState<{ lat: number; lng: number } | null>(null);

  const bikePinById = useMemo(() => {
    const map = new Map<string, FrontendDashboardBikePin>();
    for (const pin of bikePins) map.set(pin.bikeId, pin);
    return map;
  }, [bikePins]);

  const vehicleById = useMemo(() => {
    const map = new Map<string, FrontendVehicle>();
    for (const vehicle of vehicles) {
      const key = vehicle.id ?? vehicle.slug;
      if (key) map.set(key, vehicle);
    }
    return map;
  }, [vehicles]);

  // 차량 필터 통과 = 표시될 후보. 라이더 필터가 ALL 이면 통과 후보 전체가 마커.
  // 그 외엔 라이더 필터를 통과한 라이더들의 배정 차량과의 교집합.
  const visibleVehicles = useMemo(
    () =>
      applyVehicleFilters({
        vehicles,
        filters: vehicleFilters,
        bikePinById,
        deviceUidByBikeId,
        maintenanceSummaryByBike
      }),
    [vehicles, vehicleFilters, bikePinById, deviceUidByBikeId, maintenanceSummaryByBike]
  );

  const visibleRiders = useMemo(
    () =>
      applyRiderFilters({
        riders,
        filters: riderFilters,
        educationTypeByRiderId,
        riderActiveBikeId,
        riderActiveBikePlate,
        riderActiveContractById,
        insuredRiderIds,
        ignitionStatusByBikeId
      }),
    [
      riders,
      riderFilters,
      educationTypeByRiderId,
      riderActiveBikeId,
      riderActiveBikePlate,
      riderActiveContractById,
      insuredRiderIds,
      ignitionStatusByBikeId
    ]
  );

  const visibleStations = useMemo(
    () => applyStationFilters({ stations, filters: stationFilters }),
    [stations, stationFilters]
  );

  // 라이더 필터가 ALL 들로만 잡혀 있는지 빠르게 검사 — 그러면 라이더 매핑
  // 거치지 않고 차량 후보 그대로 통과시킨다 (의도된 비차단 동작).
  const riderFilterIsDefault = riderFilters === DEFAULT_RIDER_FILTERS
    || (riderFilters.query.trim() === ""
      && riderFilters.education === "ALL"
      && riderFilters.assignment === "ALL"
      && riderFilters.contractCategory === "ALL"
      && riderFilters.insurance === "ALL"
      && riderFilters.ignition === "ALL");

  const visibleBikePins = useMemo(() => {
    const allowedBikeIds = new Set<string>();
    if (riderFilterIsDefault) {
      for (const vehicle of visibleVehicles) {
        const key = vehicle.id ?? vehicle.slug;
        if (key) allowedBikeIds.add(key);
      }
    } else {
      // 라이더 필터가 작용 중 — 그 라이더들의 배정 차량 set 와 교집합.
      const ridersWithBikes = new Set<string>();
      for (const rider of visibleRiders) {
        const riderKey = rider.id ?? rider.slug;
        const bikeId = riderActiveBikeId?.get(riderKey);
        if (bikeId) ridersWithBikes.add(bikeId);
      }
      for (const vehicle of visibleVehicles) {
        const key = vehicle.id ?? vehicle.slug;
        if (key && ridersWithBikes.has(key)) allowedBikeIds.add(key);
      }
    }
    return bikePins.filter((pin) => allowedBikeIds.has(pin.bikeId));
  }, [visibleVehicles, visibleRiders, riderFilterIsDefault, riderActiveBikeId, bikePins]);

  const visibleStationPins = useMemo(() => {
    const allowed = new Set<string>();
    for (const station of visibleStations) {
      if (station.id) allowed.add(station.id);
    }
    return stationPins.filter((pin) => allowed.has(pin.stationId));
  }, [visibleStations, stationPins]);

  const targetLocation = useMemo(() => {
    if (searchOverride) {
      return { lat: searchOverride.lat, lng: searchOverride.lng };
    }
    if (!selectedBikeId) return null;
    const pin = bikePinById.get(selectedBikeId);
    if (!pin) return null;
    return { lat: pin.latitude, lng: pin.longitude };
  }, [searchOverride, selectedBikeId, bikePinById]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!searchOverride) return;
    const handle = window.requestAnimationFrame(() => setSearchOverride(null));
    return () => window.cancelAnimationFrame(handle);
  }, [selectedBikeId, searchOverride]);

  const handleSearchSelect = (match: OverviewMapSearchMatch) => {
    setSearchOverride({ lat: match.latitude, lng: match.longitude });
    if (match.kind === "bike" || match.kind === "rider") {
      setSelectedBikeId(match.bikeId);
    }
  };

  const detailRow: VehicleDetailRow | null = useMemo(() => {
    if (!selectedBikeId) return null;
    const vehicle = vehicleById.get(selectedBikeId);
    if (!vehicle) return null;
    const riderId = bikeActiveRiderById?.get(selectedBikeId) ?? null;
    const riderInfo = riderId ? riderInfoById?.get(riderId) ?? null : null;
    return {
      vehicle,
      riderName: riderInfo?.name ?? null,
      riderPhone: riderInfo?.phone ?? null
    };
  }, [selectedBikeId, vehicleById, bikeActiveRiderById, riderInfoById]);

  return (
    <div className="fullscreen-map-overlay" role="dialog" aria-modal="true" aria-label="전체화면 지도">
      <header className="fullscreen-map-header">
        <button
          type="button"
          className="fullscreen-map-close"
          onClick={onClose}
          title="닫기 (ESC)"
          aria-label="전체화면 닫기"
        >
          ✕ 닫기
        </button>
        <OverviewMapSearch
          bikePins={bikePins}
          stationPins={stationPins}
          bikeActiveRiderById={bikeActiveRiderById}
          riderInfoById={riderInfoById}
          onSelect={handleSearchSelect}
        />
        <span className="fullscreen-map-counts">
          {visibleBikePins.length}대 차량 · {visibleStationPins.length}개 BSS
        </span>
      </header>
      <aside className="fullscreen-map-filters">
        <FilterAccordion title="차량">
          <VehicleFilterControls
            filters={vehicleFilters}
            onChange={setVehicleFilters}
            layout="vertical"
            count={{ visible: visibleVehicles.length, total: vehicles.length }}
          />
        </FilterAccordion>
        <FilterAccordion title="라이더">
          <RiderFilterControls
            filters={riderFilters}
            onChange={setRiderFilters}
            layout="vertical"
            count={{ visible: visibleRiders.length, total: riders.length }}
          />
        </FilterAccordion>
        <FilterAccordion title="BSS">
          <StationFilterControls
            filters={stationFilters}
            onChange={setStationFilters}
            layout="vertical"
            count={{ visible: visibleStations.length, total: stations.length }}
          />
        </FilterAccordion>
      </aside>
      <main className="fullscreen-map-canvas">
        <MapShell
          bikePins={[...visibleBikePins]}
          stationPins={[...visibleStationPins]}
          targetLocation={targetLocation}
          onBikeSelect={setSelectedBikeId}
        />
        <VehicleDetailDialog
          key={detailRow ? (detailRow.vehicle.id ?? detailRow.vehicle.slug) : "none"}
          row={detailRow}
          onClose={() => setSelectedBikeId(null)}
        />
      </main>
    </div>
  );
}

function FilterAccordion({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <section className={open ? "filter-accordion filter-accordion--open" : "filter-accordion"}>
      <button
        type="button"
        className="filter-accordion-header"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>{title}</span>
        <span aria-hidden="true">{open ? "▾" : "▸"}</span>
      </button>
      {open ? <div className="filter-accordion-body">{children}</div> : null}
    </section>
  );
}
```

- [ ] **Step 2: Static checks**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web
npm run typecheck
npm run lint
```

Both must exit 0. If `RiderActiveContractSummary` or `ServiceOpsRider` imports don't resolve, check the actual export names in their source files (`rider-data.ts` / `service-ops-api.ts`) and adjust. The component isn't yet imported anywhere — that's Task 9.

- [ ] **Step 3: Commit**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain
git add development/front-admin-web/components/overview/FullscreenMapHost.tsx
git commit -m "Add FullscreenMapHost — viewport overlay with three filter sections

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Mount `FullscreenMapHost` in `app/page.tsx`

**Files:**
- Modify: `development/front-admin-web/app/page.tsx`

`OverviewClientShell` wraps the client subtree with `VehicleFilterProvider`. The fullscreen host needs to be inside that provider so it can read `fullscreenMapOpen`. The simplest placement: render it after `OverviewMapBanner` (or anywhere inside `OverviewClientShell`).

- [ ] **Step 1: Add the import + render**

In `page.tsx`, add:

```tsx
import { FullscreenMapHost } from "@/components/overview/FullscreenMapHost";
```

Inside the JSX, immediately after the `<OverviewMapBanner ... />` element (and inside the same `OverviewClientShell`), insert:

```tsx
<FullscreenMapHost
  bikePins={mapState.data.bikePins}
  stationPins={mapState.data.stationPins}
  vehicles={vehicleData.vehicles}
  riders={riderData.riders}
  stations={stationData.stations}
  bikeActiveRiderById={bikeActiveRiderByBikeId}
  riderInfoById={riderInfoByRiderId}
  deviceUidByBikeId={deviceMap}
  maintenanceSummaryByBike={maintenanceSummaryByBike}
  educationTypeByRiderId={educationTypeByRiderId}
  riderActiveBikeId={riderActiveBikeIdByRiderId}
  riderActiveBikePlate={riderActiveBikePlateByRiderId}
  riderActiveContractById={riderActiveContractByRiderId}
  insuredRiderIds={insuredRiderIds}
  ignitionStatusByBikeId={ignitionStatusByBikeId}
/>
```

The exact prop names (`bikeActiveRiderByBikeId`, `riderInfoByRiderId`, etc.) must match what `page.tsx` actually computes — read the file to confirm and adjust as needed. If a prop isn't currently computed on the page, derive it from the existing data inline (e.g., `bikeActiveRiderById` can be built from contracts data the same way `VehiclesPanel` receives it; check the existing prop wiring to `OverviewMapBanner` and `VehiclesPanel` for the exact source names).

- [ ] **Step 2: Static checks**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web
npm run typecheck
npm run lint
```

Both must exit 0. TS will catch any mismatch between the props you pass and what `FullscreenMapHostProps` expects — fix by name.

- [ ] **Step 3: Commit**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain
git add development/front-admin-web/app/page.tsx
git commit -m "Mount FullscreenMapHost on the root page

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: CSS for the fullscreen overlay + button

**Files:**
- Modify: `development/front-admin-web/app/globals.css`

- [ ] **Step 1: Append the styles**

Read the file first to find a sensible insertion point (near the existing `.overview-map-*` block). Append:

```css
/* 전체화면 지도 모드. viewport 전체를 덮는 fixed overlay. 좌측 collapsible
   aside (필터 3 섹션 accordion) + 상단 header (닫기/검색/카운트) + 메인
   캔버스 (MapShell + VehicleDetailDialog). 닫으면 unmount 되어 state 가
   사라진다. */
.overview-map-fullscreen-button {
  height: 32px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid var(--rm-line-subtle);
  background: var(--rm-bg-panel-soft);
  color: var(--rm-text-primary);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
}
.overview-map-fullscreen-button:hover {
  background: var(--rm-bg-section);
}

.fullscreen-map-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: var(--rm-bg-page);
  color: var(--rm-text-primary);
  display: grid;
  grid-template-columns: 320px 1fr;
  grid-template-rows: 56px 1fr;
  grid-template-areas:
    "header header"
    "filters canvas";
}
.fullscreen-map-header {
  grid-area: header;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  border-bottom: 1px solid var(--rm-line-subtle);
  background: var(--rm-bg-panel-soft);
}
.fullscreen-map-close {
  height: 32px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid var(--rm-line-subtle);
  background: var(--rm-bg-page);
  color: var(--rm-text-primary);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
}
.fullscreen-map-close:hover {
  background: var(--rm-bg-section);
}
.fullscreen-map-counts {
  margin-left: auto;
  font-size: 12px;
  color: var(--rm-text-secondary);
  font-variant-numeric: tabular-nums;
}
.fullscreen-map-filters {
  grid-area: filters;
  border-right: 1px solid var(--rm-line-subtle);
  background: var(--rm-bg-panel-soft);
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.fullscreen-map-canvas {
  grid-area: canvas;
  position: relative;
}

/* 필터 accordion — 헤더 클릭으로 본문 펼침/접힘. 풀스크린 좌측 aside 안에서만
   쓰지만 다른 곳 재사용 가능하도록 클래스로 분리. */
.filter-accordion {
  border: 1px solid var(--rm-line-subtle);
  border-radius: 8px;
  overflow: hidden;
}
.filter-accordion-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: var(--rm-text-primary);
  font-size: 13px;
  font-weight: 700;
  text-align: left;
  cursor: pointer;
  font-family: inherit;
}
.filter-accordion-header:hover {
  background: var(--rm-bg-section);
}
.filter-accordion-body {
  padding: 8px 12px 12px;
  border-top: 1px solid var(--rm-line-subtle);
}

/* 필터 컨트롤의 세로 stack — 인라인 행(`vehicles-filter-row`) 의 vertical
   대안. 풀스크린 좌측 aside 안에서 사용. */
.filter-stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.filter-stack .vehicles-filter-search-wrap,
.filter-stack .vehicles-filter-select {
  width: 100%;
}
.filter-stack .vehicles-filter-count {
  font-size: 11px;
  color: var(--rm-text-secondary);
}
```

If any of the CSS variables aren't defined in `:root`, fall back to a sensible default by inlining a hex/rgb literal — but they should all exist (the inline filter row already uses them).

- [ ] **Step 2: Static checks**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web
npm run typecheck
npm run lint
```

Both must exit 0. ESLint doesn't lint CSS but the bundler will fail on syntactically broken styles at build time — defer that check to the next task.

- [ ] **Step 3: Commit**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain
git add development/front-admin-web/app/globals.css
git commit -m "Style the fullscreen map overlay + filter accordion + vertical stack

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Full static-check sweep + optional build

- [ ] **Step 1: typecheck**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 2: lint**

```bash
npm run lint
```

Expected: exit 0.

- [ ] **Step 3: Optional `next build`**

```bash
npm run build
```

Catches CSS errors and Next.js-specific issues that typecheck and lint don't. Skip if you trust the previous steps and the manual smoke will exercise the same paths.

---

## Task 12: Manual smoke against the user's dev server

The user runs their own dev server. **Do not** spawn a competing one.

- [ ] **Step 1: Regression — existing table behavior unchanged**

In a browser on `/`:
- 차량 탭: filter row still shows 6 controls + count. Type a plate, ignition ON, etc. Filtered set behaves identically to before the refactor.
- 라이더 탭: same — 6 controls + count work.
- BSS 탭: 2 controls + count work.

- [ ] **Step 2: 전체화면 entry**

In the toggle row at the top of `/`, click `[⛶ 전체화면]`. Expected:
- Viewport flips to map-only. Sidebar / header are covered.
- Left aside shows three accordion sections (차량 / 라이더 / BSS) — all open by default.
- Map renders all bikes + stations (defaults).
- Top header has 닫기 button, search input, count line on the right.

- [ ] **Step 3: Filter interaction**

In fullscreen:
- Type a plate in 차량 검색 → markers narrow.
- Change 차량.engineType → markers update.
- Type a rider name in 라이더 검색 → bike markers narrow to that rider's bike.
- Combined: 차량.engineType = ELECTRIC + 라이더.education = ONLINE → only electric bikes whose riders have online education are shown.
- Type a BSS address → station markers narrow.
- Accordion section headers collapse/expand each section.

- [ ] **Step 4: Map interaction inside fullscreen**

- Click a bike marker → `VehicleDetailDialog` opens at top-right of the canvas (existing component).
- Use the search input in the header → result click pans the map + opens the detail dialog where appropriate.

- [ ] **Step 5: Exit**

- Press ESC → overlay closes, page is back to its original state. Table filters in 차량/라이더/BSS tabs are unchanged.
- Re-open fullscreen → filters start at defaults (new mount).
- `[✕ 닫기]` button in the overlay header also closes.

- [ ] **Step 6: z-index sanity**

- Open `VehicleDetailDialog` first (via table click), then open fullscreen. Confirm the dialog re-renders inside the overlay correctly.

---

## Task 13: PR

- [ ] **Step 1: Push the branch**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain
git push -u origin cc-214-fullscreen-map-mode
```

- [ ] **Step 2: Open the PR**

```bash
gh pr create --base dev --head cc-214-fullscreen-map-mode \
  --title "Add fullscreen map mode with vehicle + rider + BSS filters" \
  --body "$(cat <<'EOF'
## Summary
- 루트 `/` 의 `OverviewMapBanner` 토글 행에 `[⛶ 전체화면]` 버튼 추가 — 클릭 시 viewport 전체를 덮는 fullscreen 지도 오버레이 노출
- 좌측 collapsible 사이드 패널에 차량(6) + 라이더(6) + BSS(2) 총 14개 필터를 accordion 으로 묶어 마커 narrowing 가능
- DRY refactor — `applyVehicleFilters`/`applyRiderFilters`/`applyStationFilters` pure helpers + `VehicleFilterControls`/`RiderFilterControls`/`StationFilterControls` presentational components 가 표 패널과 풀스크린 양쪽에서 동일하게 사용
- 표 패널 동작은 100% 동일 — 그저 inline 코드가 추출된 모듈을 호출하는 형태로 바뀜
- ESC 또는 `[✕ 닫기]` 로 종료. 닫으면 overlay 가 unmount 되어 필터 state 사라짐 (재진입 시 defaults). 표 패널의 필터는 영향 없음
- `selectedBikeId` (디테일 패널) 만 context 로 공유 — 모드 전환 시 selection 유지

## Spec & Plan
- 디자인: `docs/superpowers/specs/2026-05-24-fullscreen-map-mode-design.md`
- 플랜: `docs/superpowers/plans/2026-05-24-fullscreen-map-mode.md`

## Test plan
- [x] `npm run typecheck`
- [x] `npm run lint`
- [ ] 회귀: 차량/라이더/BSS 탭의 기존 필터 동작 동일 확인
- [ ] 전체화면 진입/종료 (ESC, 닫기 버튼, 재진입 defaults)
- [ ] 14개 필터 각각 마커 narrowing 확인
- [ ] 차량 + 라이더 combined 필터 (예: electric + online education)
- [ ] 마커 클릭 → `VehicleDetailDialog` 내부 표시
- [ ] 검색 결과 클릭 → pan + 적절히 detail dialog 열림

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL printed.

---

## Self-Review

**Spec coverage:**
- 전체화면 trigger (button next to 지도 보기) → Task 7
- Fullscreen overlay (position fixed, ESC, 닫기 button) → Task 8 + Task 10 CSS
- 14 filters, 3 sections in left collapsible aside → Task 8 (`FilterAccordion`) + Task 10 CSS
- Filter compute extraction → Task 2 (`filter-compute.ts`)
- Filter UI extraction with horizontal/vertical layouts → Tasks 3-5
- Panel refactors (behavior unchanged) → Tasks 3-5
- `fullscreenMapOpen` channel + selectedBikeId stays shared → Task 6
- Filter state NOT shared between modes → Task 8 owns state internally; panels keep their own
- Search reuse inside fullscreen → Task 8 imports `OverviewMapSearch`
- Marker visibility computed locally in overlay → Task 8 `visibleBikePins` / `visibleStationPins` useMemos
- z-index / sidebar hidden → Task 10 (`position: fixed; inset: 0; z-index: 100`)
- ESC closes → Task 8 (`FullscreenMapHost` effect)
- Smoke checklist mirrors spec's testing section → Task 12

**Placeholder scan:** no "TODO" / "TBD" / "implement later" / "Similar to Task N" references. Each code block is concrete.

**Type consistency:** `VehicleFilterState` / `RiderFilterState` / `StationFilterState` defined in Task 2 and referenced consistently in Tasks 3-5 and Task 8. `OverviewMapSearchMatch` shape consumed by Task 8's `handleSearchSelect` matches the union exported from the component that's already in the codebase. `VehicleDetailRow` re-used as-is.

**Scope:** single PR, ~5 new files + ~7 modifications, no backend changes. Larger than #282 but coherent.
