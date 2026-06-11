# Group A — Map Full View + Tips Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 지도를 항상-on full-viewport 레이아웃으로 개편하고, 하단 패널 탭을 차량/충전소/팁으로 정리하며, 팁(위치 기반 알림) 기능을 full-stack으로 신규 구현한다.

**Architecture:** `FullscreenMapHost` 를 항상 렌더링되는 메인 레이아웃으로 승격하고, 기존 페이지 하단 탭 패널을 지도 내부 하단 패널(`BottomMapPanel`)로 이전한다. 백엔드에 `tips` 테이블 + REST API 를 추가하고 Dashboard API 에 `TipPin[]` 을 포함시켜 지도 마커로 노출한다.

**Tech Stack:** Spring Boot (Java 21), Flyway, JPA `Repository<T,UUID>`, Next.js App Router, NCP Maps SDK, TypeScript

---

## 파일 구조 (생성/수정 목록)

### 삭제
- `development/front-admin-web/app/test-matching/page.tsx`
- `development/front-admin-web/app/test-matching/actions.ts`
- `development/front-admin-web/app/test-matching/test-matching.css`
- `development/front-admin-web/app/api/test-matching/export/[type]/route.ts`
- `development/front-admin-web/app/overview/page.tsx`
- `development/front-admin-web/app/monitoring/page.tsx`
- `development/front-admin-web/app/monitoring/actions.ts`
- `development/front-admin-web/components/test-matching/MatchingSection.tsx`
- `development/front-admin-web/components/test-matching/RiderSection.tsx`
- `development/front-admin-web/components/test-matching/VehicleSection.tsx`
- `development/front-admin-web/components/overview/OverviewMapBanner.tsx`
- `development/front-admin-web/components/overview/OverviewKpiTiles.tsx`

### 신규 생성 — 프론트엔드
- `development/front-admin-web/components/overview/BottomMapPanel.tsx` — 하단 탭 패널 (차량/충전소/팁)
- `development/front-admin-web/components/overview/TipsPanel.tsx` — 팁 CRUD 테이블
- `development/front-admin-web/components/overview/CreateTipDialog.tsx` — 팁 생성 다이얼로그 (미니맵)
- `development/front-admin-web/components/overview/EditTipDialog.tsx` — 팁 편집 다이얼로그 (미니맵)
- `development/front-admin-web/app/tips/actions.ts` — 팁 서버 액션

### 신규 생성 — 백엔드
- `development/service-ops-api/src/main/resources/db/migration/V32__create_tips_table.sql`
- `development/service-ops-api/src/main/java/com/thundercrew/opsapi/tip/TipPackage.java`
- `development/service-ops-api/src/main/java/com/thundercrew/opsapi/tip/domain/Tip.java`
- `development/service-ops-api/src/main/java/com/thundercrew/opsapi/tip/repository/TipRepository.java`
- `development/service-ops-api/src/main/java/com/thundercrew/opsapi/tip/dto/TipReadResponse.java`
- `development/service-ops-api/src/main/java/com/thundercrew/opsapi/tip/dto/TipCreateRequest.java`
- `development/service-ops-api/src/main/java/com/thundercrew/opsapi/tip/dto/TipUpdateRequest.java`
- `development/service-ops-api/src/main/java/com/thundercrew/opsapi/tip/service/TipReadService.java`
- `development/service-ops-api/src/main/java/com/thundercrew/opsapi/tip/service/TipCommandService.java`
- `development/service-ops-api/src/main/java/com/thundercrew/opsapi/tip/controller/TipController.java`
- `development/service-ops-api/src/test/java/com/thundercrew/opsapi/TipApiContractTests.java`

### 수정 — 프론트엔드
- `development/front-admin-web/components/overview/VehicleFilterContext.tsx` — `fullscreenMapOpen` 제거
- `development/front-admin-web/components/overview/FullscreenMapHost.tsx` — 항상-on, BottomMapPanel 포함
- `development/front-admin-web/components/dashboard/MapShell.tsx` — `tipPins` + `onTipSelect` 추가
- `development/front-admin-web/lib/services/service-ops-api.ts` — Tips 타입 + 메서드 추가
- `development/front-admin-web/lib/services/dashboard-map-state-data.ts` — `tips` 필드 추가
- `development/front-admin-web/app/page.tsx` — 단순화 (FullscreenMapHost 직접 렌더링)
- `development/front-admin-web/app/globals.css` — 하단 패널 CSS, 팁 마커 CSS

### 수정 — 백엔드
- `development/service-ops-api/src/main/java/com/thundercrew/opsapi/dashboard/dto/DashboardMapStateResponse.java` — `TipPin` 레코드 + `tips` 필드 추가
- `development/service-ops-api/src/main/java/com/thundercrew/opsapi/dashboard/service/DashboardMapStateService.java` — `TipRepository` 주입 + tips 조회

---

## Task 1: 페이지 정리 (삭제)

**Files:**
- Delete: `development/front-admin-web/app/test-matching/` (page.tsx, actions.ts, test-matching.css)
- Delete: `development/front-admin-web/app/api/test-matching/export/[type]/route.ts`
- Delete: `development/front-admin-web/app/overview/page.tsx`
- Delete: `development/front-admin-web/app/monitoring/page.tsx`
- Delete: `development/front-admin-web/app/monitoring/actions.ts`
- Delete: `development/front-admin-web/components/test-matching/` (MatchingSection.tsx, RiderSection.tsx, VehicleSection.tsx)
- Delete: `development/front-admin-web/components/overview/OverviewMapBanner.tsx`
- Delete: `development/front-admin-web/components/overview/OverviewKpiTiles.tsx`
- Modify: `development/front-admin-web/app/page.tsx`

- [ ] **Step 1: 파일 삭제**

```bash
cd development/front-admin-web
# test-matching 페이지 + 컴포넌트
rm app/test-matching/page.tsx app/test-matching/actions.ts app/test-matching/test-matching.css
rm app/api/test-matching/export/[type]/route.ts
rmdir app/api/test-matching/export/[type] app/api/test-matching/export app/api/test-matching 2>/dev/null || true
rmdir app/test-matching

# 레거시 리다이렉트 페이지
rm app/overview/page.tsx
rmdir app/overview
rm app/monitoring/page.tsx app/monitoring/actions.ts
rmdir app/monitoring

# 컴포넌트
rm components/test-matching/MatchingSection.tsx components/test-matching/RiderSection.tsx components/test-matching/VehicleSection.tsx
rmdir components/test-matching
rm components/overview/OverviewMapBanner.tsx
rm components/overview/OverviewKpiTiles.tsx
```

- [ ] **Step 2: page.tsx 에서 삭제된 컴포넌트 import 제거**

`development/front-admin-web/app/page.tsx` 에서 다음을 제거:

```diff
- import { MaintenancePanel } from "@/components/management/MaintenancePanel";
- import { RidersPanel, type InsuranceOption } from "@/components/management/RidersPanel";
+ import type { InsuranceOption } from "@/components/management/RidersPanel";
- import { CreateRiderDialog } from "@/components/management/CreateRiderDialog";
- import { CreateMaintenanceItemDialog } from "@/components/management/CreateMaintenanceItemDialog";
- import { OverviewKpiTiles } from "@/components/overview/OverviewKpiTiles";
- import { OverviewMapBanner } from "@/components/overview/OverviewMapBanner";
```

- [ ] **Step 3: TABS + TabKey에서 riders/maintenance 제거, BSS → 충전소**

`app/page.tsx` 의 TabKey, TABS, isValidTabKey 를 다음으로 교체:

```typescript
type TabKey = "vehicles" | "stations";

const TABS: ReadonlyArray<TabConfig> = [
  { key: "vehicles", label: "차량" },
  { key: "stations", label: "충전소" }
];
```

- [ ] **Step 4: page.tsx KPI 계산 제거**

다음 변수 계산 블록을 제거:
```typescript
// 제거할 블록들:
const totalRiders = riderData.riders.length;          // ← 삭제
const ignitionOnCount = 0;                            // ← 삭제
let insuredVehicleCount = 0; /* ... */                // ← 삭제
let subscriptionRiderCount = 0; /* ... */             // ← 삭제
let rentalRiderCount = 0; /* ... */                   // ← 삭제
```

- [ ] **Step 5: page.tsx JSX에서 OverviewKpiTiles, OverviewMapBanner 제거**

JSX 에서 다음 두 줄을 삭제:
```diff
-      <OverviewKpiTiles
-        totalBikes={summary.totalBikes}
-        ignitionOnCount={ignitionOnCount}
-        insuredVehicleCount={insuredVehicleCount}
-        totalRiders={totalRiders}
-        subscriptionRiderCount={subscriptionRiderCount}
-        rentalRiderCount={rentalRiderCount}
-      />
-      <OverviewMapBanner ... />
```

- [ ] **Step 6: activeContent에서 riders/maintenance 브랜치 제거**

`activeContent` 변수에서 `activeTab === "riders"` 브랜치와 `activeTab === "maintenance"` 브랜치를 제거. `vehicles` 와 `stations` 만 남김.

`loadOtherTabContent` 함수의 타입도 `Extract<TabKey, "stations">` 으로 단순화됨 (이미 그렇게 되어있음 — 확인만).

- [ ] **Step 7: tab action row에서 CreateRiderDialog, CreateMaintenanceItemDialog 제거**

```diff
-         {activeTab === "riders" ? <CreateRiderDialog /> : null}
          {activeTab === "vehicles" ? <CreateVehicleDialog /> : null}
          {activeTab === "stations" ? <CreateStationDialog /> : null}
-         {activeTab === "maintenance" ? <CreateMaintenanceItemDialog parentOptions={maintenanceData.items} /> : null}
```

- [ ] **Step 8: 타입체크**

```bash
cd development/front-admin-web
npx tsc --noEmit
```

Expected: 0 errors (혹은 FullscreenMapHost 쪽 import 오류 — Task 2 에서 수정)

- [ ] **Step 9: 커밋**

```bash
cd development/front-admin-web
git add -A
git commit -m "feat: remove test-matching, OverviewMapBanner, OverviewKpiTiles, riders/maintenance tabs"
```

---

## Task 2: 레이아웃 리팩터 (FullscreenMapHost 항상-on + BottomMapPanel)

**Files:**
- Modify: `development/front-admin-web/components/overview/VehicleFilterContext.tsx`
- Create: `development/front-admin-web/components/overview/BottomMapPanel.tsx`
- Modify: `development/front-admin-web/components/overview/FullscreenMapHost.tsx`
- Modify: `development/front-admin-web/app/page.tsx`
- Modify: `development/front-admin-web/app/globals.css`

- [ ] **Step 1: VehicleFilterContext에서 fullscreenMapOpen 제거**

`VehicleFilterContext.tsx` 를 다음으로 교체:

```tsx
"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type FilterContextValue = {
  filteredBikeIds: ReadonlySet<string> | null;
  setFilteredBikeIds: (ids: ReadonlySet<string> | null) => void;
  selectedBikeId: string | null;
  setSelectedBikeId: (id: string | null) => void;
};

const VehicleFilterContext = createContext<FilterContextValue | null>(null);

export function VehicleFilterProvider({ children }: { children: ReactNode }) {
  const [filteredBikeIds, setFilteredRaw] = useState<ReadonlySet<string> | null>(null);
  const [selectedBikeId, setSelectedRaw] = useState<string | null>(null);
  const setFilteredBikeIds = useCallback((ids: ReadonlySet<string> | null) => {
    setFilteredRaw(ids);
  }, []);
  const setSelectedBikeId = useCallback((id: string | null) => {
    setSelectedRaw(id);
  }, []);
  const value = useMemo<FilterContextValue>(
    () => ({ filteredBikeIds, setFilteredBikeIds, selectedBikeId, setSelectedBikeId }),
    [filteredBikeIds, setFilteredBikeIds, selectedBikeId, setSelectedBikeId]
  );
  return <VehicleFilterContext.Provider value={value}>{children}</VehicleFilterContext.Provider>;
}

export function useVehicleFilter(): FilterContextValue {
  const ctx = useContext(VehicleFilterContext);
  if (!ctx) {
    return {
      filteredBikeIds: null,
      setFilteredBikeIds: () => {},
      selectedBikeId: null,
      setSelectedBikeId: () => {}
    };
  }
  return ctx;
}
```

- [ ] **Step 2: BottomMapPanel 신규 생성**

`development/front-admin-web/components/overview/BottomMapPanel.tsx` 를 새로 만든다:

```tsx
"use client";

import { useState } from "react";
import { VehiclesPanel } from "@/components/management/VehiclesPanel";
import { StationsPanel } from "@/components/management/StationsPanel";
import { ContractMatchingForm, type ContractMatchingOption } from "@/components/management/ContractMatchingForm";
import type { InsuranceOption } from "@/components/management/RidersPanel";
import type {
  FrontendDashboardBikePin,
  FrontendVehicle,
  ServiceOpsInsuranceItem,
  ServiceOpsRiderEducationType,
  ServiceOpsRiderInsurance
} from "@/lib/services/service-ops-api";
import type { StationListResult } from "@/lib/services/station-data";
import type { RiderActiveContractSummary } from "@/lib/services/rider-matching-snapshot-data";
import type { VehicleMaintenanceSummary } from "@/components/management/vehicle-maintenance-derive";

type BottomTab = "vehicles" | "stations" | "tips";

export interface BottomMapPanelProps {
  // vehicles tab
  vehicles: ReadonlyArray<FrontendVehicle>;
  bikeActiveRiderById: Map<string, string>;
  riderInfoById: Map<string, { name: string; phone: string }>;
  bikePins: ReadonlyArray<FrontendDashboardBikePin>;
  deviceUidByBikeId: Map<string, string>;
  educationTypeByRiderId: Map<string, ServiceOpsRiderEducationType>;
  riderActiveContractById: Map<string, RiderActiveContractSummary>;
  riderActiveInsuranceByRiderId: Map<string, ServiceOpsRiderInsurance>;
  insuranceOptions: ReadonlyArray<InsuranceOption>;
  ignitionBlockedByBikeId: Map<string, boolean>;
  maintenanceSummaryByBike: Map<string, VehicleMaintenanceSummary>;
  statusParam: string | null;
  vehicleNotice?: string;
  // contract matching form
  riderOptions: ContractMatchingOption[];
  vehicleOptions: ContractMatchingOption[];
  templateOptions: ContractMatchingOption[];
  // stations tab
  stationData: StationListResult;
  // tips tab — placeholder for Task 8
  tipContent?: React.ReactNode;
}

export function BottomMapPanel(props: BottomMapPanelProps) {
  const [activeTab, setActiveTab] = useState<BottomTab>("vehicles");
  const [panelOpen, setPanelOpen] = useState(false);

  const handleTabClick = (tab: BottomTab) => {
    if (activeTab === tab && panelOpen) {
      setPanelOpen(false);
    } else {
      setActiveTab(tab);
      setPanelOpen(true);
    }
  };

  return (
    <div className={`bottom-map-panel${panelOpen ? " bottom-map-panel--open" : ""}`}>
      <div className="bottom-map-panel-tabbar">
        {(["vehicles", "stations", "tips"] as BottomTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            className={`bottom-map-panel-tab${activeTab === tab && panelOpen ? " is-active" : ""}`}
            onClick={() => handleTabClick(tab)}
          >
            {tab === "vehicles" ? "차량" : tab === "stations" ? "충전소" : "팁"}
          </button>
        ))}
        {panelOpen && (
          <button
            type="button"
            className="bottom-map-panel-collapse"
            onClick={() => setPanelOpen(false)}
            aria-label="패널 닫기"
          >
            ▼
          </button>
        )}
      </div>
      {panelOpen && (
        <div className="bottom-map-panel-content">
          {activeTab === "vehicles" && (
            <>
              {props.vehicleNotice && (
                <p className="notice" role="status">{props.vehicleNotice}</p>
              )}
              <VehiclesPanel
                data={{ vehicles: [...props.vehicles], notice: props.vehicleNotice }}
                bikeActiveRiderById={props.bikeActiveRiderById}
                riderInfoById={props.riderInfoById}
                bikePins={props.bikePins}
                deviceUidByBikeId={props.deviceUidByBikeId}
                educationTypeByRiderId={props.educationTypeByRiderId}
                riderActiveContractById={props.riderActiveContractById}
                riderActiveInsuranceByRiderId={props.riderActiveInsuranceByRiderId}
                insuranceOptions={props.insuranceOptions}
                ignitionBlockedByBikeId={props.ignitionBlockedByBikeId}
                maintenanceSummaryByBike={props.maintenanceSummaryByBike}
                statusParam={props.statusParam}
              />
              <ContractMatchingForm
                riderOptions={props.riderOptions}
                vehicleOptions={props.vehicleOptions}
                templateOptions={props.templateOptions}
                statusParam={props.statusParam}
              />
            </>
          )}
          {activeTab === "stations" && (
            <StationsPanel data={props.stationData} />
          )}
          {activeTab === "tips" && (
            props.tipContent ?? (
              <div className="bottom-map-panel-placeholder">팁 기능 준비 중</div>
            )
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: globals.css에 BottomMapPanel CSS 추가**

`development/front-admin-web/app/globals.css` 에 추가 (파일 끝에):

```css
/* ─── BottomMapPanel ─────────────────────────────────────────── */
.bottom-map-panel {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
}

.bottom-map-panel-tabbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: var(--color-background-secondary);
  border-top: 0.5px solid var(--color-border-secondary);
}

.bottom-map-panel-tab {
  padding: 4px 14px;
  border-radius: var(--border-radius-md);
  font-size: 13px;
  font-weight: 500;
  background: transparent;
  color: var(--color-text-secondary);
  border: 0.5px solid var(--color-border-tertiary);
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}

.bottom-map-panel-tab.is-active,
.bottom-map-panel-tab:hover {
  background: var(--color-accent-subtle);
  color: var(--color-text-primary);
  border-color: var(--color-accent);
}

.bottom-map-panel-collapse {
  margin-left: auto;
  background: transparent;
  border: none;
  color: var(--color-text-tertiary);
  cursor: pointer;
  font-size: 12px;
  padding: 4px 8px;
}

.bottom-map-panel--open .bottom-map-panel-content {
  height: 30vh;
  overflow-y: auto;
  background: var(--color-background-primary);
  border-top: 0.5px solid var(--color-border-secondary);
}

.bottom-map-panel-placeholder {
  padding: 24px;
  color: var(--color-text-tertiary);
  font-size: 14px;
  text-align: center;
}
```

- [ ] **Step 4: FullscreenMapHost를 항상-on으로 리팩터**

`development/front-admin-web/components/overview/FullscreenMapHost.tsx` 전체를 다음으로 교체:

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";

import { MapShell } from "@/components/dashboard/MapShell";
import { VehicleDetailDialog, type VehicleDetailRow } from "@/components/management/VehicleDetailDialog";
import { BottomMapPanel, type BottomMapPanelProps } from "@/components/overview/BottomMapPanel";
import { ContractMatchingForm, type ContractMatchingOption } from "@/components/management/ContractMatchingForm";
import { useFleetSimulation } from "@/components/overview/FleetSimulationContext";
import { useSimulatedBikePins } from "@/components/overview/use-simulated-bike-pins";
import { useTrailWaypoints } from "@/components/overview/use-trail-waypoints";
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
import { ServiceTypeFilterTabs, type ServiceTypeFilter } from "@/components/overview/ServiceTypeFilterTabs";
import { OverviewMapSearch, type OverviewMapSearchMatch } from "@/components/overview/OverviewMapSearch";
import { NotificationBell } from "@/components/layout/NotificationBell";
import type { InsuranceOption } from "@/components/management/RidersPanel";
import type {
  FrontendDashboardBikePin,
  FrontendDashboardStationPin,
  FrontendRider,
  FrontendTipPin,
  FrontendVehicle,
  ServiceOpsInsuranceItem,
  ServiceOpsRiderEducationType,
  ServiceOpsRiderInsurance
} from "@/lib/services/service-ops-api";
import type { RiderActiveContractSummary } from "@/lib/services/rider-matching-snapshot-data";
import type { StationListResult } from "@/lib/services/station-data";
import type { BatteryStation } from "@/types/domain";
import type { VehicleMaintenanceSummary } from "@/components/management/vehicle-maintenance-derive";

const FULLSCREEN_FIT_BOUNDS_PADDING = { top: 180, right: 48, bottom: 48, left: 48 };

export interface FullscreenMapHostProps {
  // map pins
  bikePins: ReadonlyArray<FrontendDashboardBikePin>;
  stationPins: ReadonlyArray<FrontendDashboardStationPin>;
  tipPins: ReadonlyArray<FrontendTipPin>;
  // for filter computation
  vehicles: ReadonlyArray<FrontendVehicle>;
  riders: ReadonlyArray<FrontendRider>;
  stations: ReadonlyArray<BatteryStation>;
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
  riderAllInsurancesByRiderId?: Map<string, ServiceOpsRiderInsurance[]>;
  insuranceItemById?: Map<string, ServiceOpsInsuranceItem>;
  insuranceOptions?: ReadonlyArray<InsuranceOption>;
  ignitionBlockedByBikeId?: Map<string, boolean>;
  // bottom panel
  stationData: StationListResult;
  riderActiveInsuranceByRiderId?: Map<string, ServiceOpsRiderInsurance>;
  riderOptions: ContractMatchingOption[];
  vehicleOptions: ContractMatchingOption[];
  templateOptions: ContractMatchingOption[];
  statusParam: string | null;
  vehicleNotice?: string;
  // tip panel content — replaced in Task 8
  tipContent?: React.ReactNode;
}

export function FullscreenMapHost(props: FullscreenMapHostProps) {
  const { selectedBikeId, setSelectedBikeId } = useVehicleFilter();
  const [vehicleFilters, setVehicleFilters] = useState<VehicleFilterState>(DEFAULT_VEHICLE_FILTERS);
  const [riderFilters, setRiderFilters] = useState<RiderFilterState>(DEFAULT_RIDER_FILTERS);
  const [stationFilters, setStationFilters] = useState<StationFilterState>(DEFAULT_STATION_FILTERS);
  const [serviceTypeFilter, setServiceTypeFilter] = useState<ServiceTypeFilter>("ALL");
  const [searchOverride, setSearchOverride] = useState<{ lat: number; lng: number } | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const { seedBikePins } = useFleetSimulation();
  const overlaidBikePins = useSimulatedBikePins(props.bikePins);
  const trailWaypoints = useTrailWaypoints(selectedBikeId);

  useEffect(() => {
    seedBikePins(props.bikePins);
  }, [props.bikePins, seedBikePins]);

  const bikePinById = useMemo(() => {
    const map = new Map<string, FrontendDashboardBikePin>();
    for (const pin of overlaidBikePins) map.set(pin.bikeId, pin);
    return map;
  }, [overlaidBikePins]);

  const vehicleById = useMemo(() => {
    const map = new Map<string, FrontendVehicle>();
    for (const vehicle of props.vehicles) {
      const key = vehicle.id ?? vehicle.slug;
      if (key) map.set(key, vehicle);
    }
    return map;
  }, [props.vehicles]);

  const serviceTypeFilteredVehicles = useMemo(
    () =>
      serviceTypeFilter === "ALL"
        ? props.vehicles
        : props.vehicles.filter((v) => (v.serviceType ?? "DELIVERY") === serviceTypeFilter),
    [props.vehicles, serviceTypeFilter]
  );

  const visibleVehicles = useMemo(
    () =>
      applyVehicleFilters({
        vehicles: serviceTypeFilteredVehicles,
        filters: vehicleFilters,
        bikePinById,
        deviceUidByBikeId: props.deviceUidByBikeId,
        maintenanceSummaryByBike: props.maintenanceSummaryByBike
      }),
    [serviceTypeFilteredVehicles, vehicleFilters, bikePinById, props.deviceUidByBikeId, props.maintenanceSummaryByBike]
  );

  const visibleRiders = useMemo(
    () =>
      applyRiderFilters({
        riders: props.riders,
        filters: riderFilters,
        educationTypeByRiderId: props.educationTypeByRiderId,
        riderActiveBikeId: props.riderActiveBikeId,
        riderActiveBikePlate: props.riderActiveBikePlate,
        riderActiveContractById: props.riderActiveContractById,
        insuredRiderIds: props.insuredRiderIds,
        ignitionStatusByBikeId: props.ignitionStatusByBikeId
      }),
    [props.riders, riderFilters, props.educationTypeByRiderId, props.riderActiveBikeId,
     props.riderActiveBikePlate, props.riderActiveContractById, props.insuredRiderIds, props.ignitionStatusByBikeId]
  );

  const visibleStations = useMemo(
    () => applyStationFilters({ stations: props.stations, filters: stationFilters }),
    [props.stations, stationFilters]
  );

  const riderFilterIsDefault =
    riderFilters.query.trim() === "" &&
    riderFilters.education === "ALL" &&
    riderFilters.assignment === "ALL" &&
    riderFilters.contractCategory === "ALL" &&
    riderFilters.insurance === "ALL" &&
    riderFilters.ignition === "ALL";

  const visibleBikePins = useMemo(() => {
    const allowedBikeIds = new Set<string>();
    if (riderFilterIsDefault) {
      for (const vehicle of visibleVehicles) {
        const key = vehicle.id ?? vehicle.slug;
        if (key) allowedBikeIds.add(key);
      }
    } else {
      const ridersWithBikes = new Set<string>();
      for (const rider of visibleRiders) {
        const riderKey = rider.id ?? rider.slug;
        const bikeId = props.riderActiveBikeId?.get(riderKey);
        if (bikeId) ridersWithBikes.add(bikeId);
      }
      for (const vehicle of visibleVehicles) {
        const key = vehicle.id ?? vehicle.slug;
        if (key && ridersWithBikes.has(key)) allowedBikeIds.add(key);
      }
    }
    return overlaidBikePins.filter((pin) => allowedBikeIds.has(pin.bikeId));
  }, [visibleVehicles, visibleRiders, riderFilterIsDefault, props.riderActiveBikeId, overlaidBikePins]);

  const visibleStationPins = useMemo(() => {
    const allowed = new Set<string>();
    for (const station of visibleStations) {
      if (station.id) allowed.add(station.id);
    }
    return props.stationPins.filter((pin) => allowed.has(pin.stationId));
  }, [visibleStations, props.stationPins]);

  const targetLocation = useMemo(() => {
    if (searchOverride) return { lat: searchOverride.lat, lng: searchOverride.lng };
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
    const riderId = props.bikeActiveRiderById?.get(selectedBikeId) ?? null;
    const riderInfo = riderId ? props.riderInfoById?.get(riderId) ?? null : null;
    const riderInsurances = riderId ? (props.riderAllInsurancesByRiderId?.get(riderId) ?? []) : [];
    const primaryIns = riderInsurances.find((ins) => {
      const item = props.insuranceItemById?.get(ins.insuranceItemId);
      return !item?.category || item.category === "PRIMARY";
    }) ?? (props.insuranceItemById ? null : riderInsurances[0] ?? null);
    const addonInsurances = props.insuranceItemById
      ? riderInsurances.filter((ins) => props.insuranceItemById!.get(ins.insuranceItemId)?.category === "ADDON")
      : [];
    return {
      vehicle,
      riderName: riderInfo?.name ?? null,
      riderPhone: riderInfo?.phone ?? null,
      riderId,
      currentPrimaryInsuranceId: primaryIns?.id ?? null,
      currentPrimaryInsuranceItemId: primaryIns?.insuranceItemId ?? null,
      addonInsurances: addonInsurances.map((ins) => ({ id: ins.id, itemId: ins.insuranceItemId }))
    };
  }, [selectedBikeId, vehicleById, props.bikeActiveRiderById, props.riderInfoById,
      props.riderAllInsurancesByRiderId, props.insuranceItemById]);

  return (
    <div className="fullscreen-map-overlay" role="main" aria-label="운영 지도">
      <header className="fullscreen-map-header">
        <button
          type="button"
          className={filtersOpen ? "fullscreen-map-filter-reopen fullscreen-map-filter-reopen--active" : "fullscreen-map-filter-reopen"}
          onClick={() => setFiltersOpen((v) => !v)}
          aria-pressed={filtersOpen}
        >
          필터
        </button>
        <OverviewMapSearch
          bikePins={overlaidBikePins}
          stationPins={props.stationPins}
          bikeActiveRiderById={props.bikeActiveRiderById ?? new Map()}
          riderInfoById={props.riderInfoById ?? new Map()}
          onSelect={handleSearchSelect}
        />
        <ServiceTypeFilterTabs value={serviceTypeFilter} onChange={setServiceTypeFilter} />
        <span className="fullscreen-map-counts">
          {visibleBikePins.length}대 차량 · {visibleStationPins.length}개 충전소
        </span>
        <NotificationBell />
      </header>
      {filtersOpen && (
        <div className="fullscreen-map-filter-bar">
          <VehicleFilterControls filters={vehicleFilters} onChange={setVehicleFilters} layout="horizontal" hideSearch />
          <RiderFilterControls filters={riderFilters} onChange={setRiderFilters} layout="horizontal" hideSearch />
          <StationFilterControls filters={stationFilters} onChange={setStationFilters} layout="horizontal" hideSearch />
          <button type="button" className="fullscreen-map-filter-bar-close" onClick={() => setFiltersOpen(false)}>✕</button>
        </div>
      )}
      <main className="fullscreen-map-canvas">
        <MapShell
          bikePins={[...visibleBikePins]}
          stationPins={[...visibleStationPins]}
          tipPins={[...props.tipPins]}
          targetLocation={targetLocation}
          onBikeSelect={setSelectedBikeId}
          fitBoundsPadding={FULLSCREEN_FIT_BOUNDS_PADDING}
          trailWaypoints={trailWaypoints}
        />
        <VehicleDetailDialog
          key={detailRow ? (detailRow.vehicle.id ?? detailRow.vehicle.slug) : "none"}
          row={detailRow}
          insuranceOptions={props.insuranceOptions ?? []}
          onClose={() => setSelectedBikeId(null)}
        />
        <BottomMapPanel
          vehicles={props.vehicles}
          bikeActiveRiderById={props.bikeActiveRiderById ?? new Map()}
          riderInfoById={props.riderInfoById ?? new Map()}
          bikePins={props.bikePins}
          deviceUidByBikeId={props.deviceUidByBikeId ?? new Map()}
          educationTypeByRiderId={props.educationTypeByRiderId ?? new Map()}
          riderActiveContractById={props.riderActiveContractById ?? new Map()}
          riderActiveInsuranceByRiderId={props.riderActiveInsuranceByRiderId ?? new Map()}
          insuranceOptions={props.insuranceOptions ?? []}
          ignitionBlockedByBikeId={props.ignitionBlockedByBikeId ?? new Map()}
          maintenanceSummaryByBike={props.maintenanceSummaryByBike ?? new Map()}
          statusParam={props.statusParam}
          vehicleNotice={props.vehicleNotice}
          stationData={props.stationData}
          riderOptions={props.riderOptions}
          vehicleOptions={props.vehicleOptions}
          templateOptions={props.templateOptions}
          tipContent={props.tipContent}
        />
      </main>
    </div>
  );
}
```

- [ ] **Step 5: MapShell에 tipPins prop 추가 (placeholder, 실제 마커는 Task 8)**

`development/front-admin-web/components/dashboard/MapShell.tsx` 의 `MapShellProps` interface 에 추가:

```typescript
import type { FrontendTipPin } from "@/lib/services/service-ops-api";

// MapShellProps에 추가:
tipPins?: FrontendTipPin[];
onTipSelect?: (id: string) => void;
```

`MapShell` 함수 파라미터에 `tipPins = [], onTipSelect` 추가 (지금은 사용 안 함 — Task 8에서 마커 로직 추가).

- [ ] **Step 6: service-ops-api.ts에 FrontendTipPin 타입 추가**

`development/front-admin-web/lib/services/service-ops-api.ts` 에서 `FrontendDashboardMapState` 인터페이스를 찾아 다음 타입과 필드를 추가:

```typescript
export interface FrontendTipPin {
  id: string;
  address: string;
  content: string;
  latitude: number;
  longitude: number;
}

// FrontendDashboardMapState에 추가:
export interface FrontendDashboardMapState {
  generatedAt: string;
  summary: { /* ... 기존 */ };
  bikePins: FrontendDashboardBikePin[];
  stationPins: FrontendDashboardStationPin[];
  tips: FrontendTipPin[];   // ← 추가
}
```

`getDashboardMapState()` 메서드에서 응답을 파싱할 때 `tips` 필드를 정규화:

```typescript
tips: (raw.tips ?? []).map((t: any) => ({
  id: t.id,
  address: t.address,
  content: t.content,
  latitude: Number(t.latitude),
  longitude: Number(t.longitude)
}))
```

- [ ] **Step 7: dashboard-map-state-data.ts의 emptyMapState에 tips 추가**

`development/front-admin-web/lib/services/dashboard-map-state-data.ts`:

```typescript
function emptyMapState(): FrontendDashboardMapState {
  return {
    generatedAt: new Date().toISOString(),
    summary: { ...EMPTY_SUMMARY },
    bikePins: [],
    stationPins: [],
    tips: []    // ← 추가
  };
}
```

- [ ] **Step 8: page.tsx 를 단순화 (FullscreenMapHost에 모든 props 전달)**

`development/front-admin-web/app/page.tsx` 의 JSX 를 다음으로 교체 (기존 TABS/탭 nav/activeContent 로직 전체 제거):

```tsx
// 제거 — TABS, TabKey, isValidTabKey, activeContent, loadOtherTabContent 전체
// 제거 — tab nav JSX (<h2 className="overview-section-heading">, overview-tabs-row, ...)
// 제거 — ContractMatchingForm (BottomMapPanel 내부로 이동)
// 제거 — import CreateStationDialog, CreateVehicleDialog (BottomMapPanel 또는 StationsPanel이 자체 처리)

// 단순화된 return:
return (
  <div className="page-container page-container--fullscreen">
    {mapState.notice ? (
      <p className="notice" role="status">{mapState.notice}</p>
    ) : null}
    <OverviewClientShell
      imeiMinusOneBikeIds={imeiMinusOneBikeIds}
      bikeRiderPairs={bikeRiderPairs}
    >
      <FullscreenMapHost
        bikePins={mapState.data.bikePins}
        stationPins={mapState.data.stationPins}
        tipPins={mapState.data.tips}
        vehicles={vehicleData.vehicles}
        riders={riderData.riders}
        stations={stationData.stations}
        bikeActiveRiderById={matching.bikeActiveRiderById}
        riderInfoById={riderInfoById}
        deviceUidByBikeId={deviceMap.deviceUidByBikeId}
        maintenanceSummaryByBike={maintenanceSummaryByBike}
        educationTypeByRiderId={matching.educationTypeByRiderId}
        riderActiveBikeId={riderActiveBikeId}
        riderActiveBikePlate={riderActiveBikePlate}
        riderActiveContractById={matching.riderActiveContractById}
        insuredRiderIds={matching.insuredRiderIds}
        ignitionStatusByBikeId={ignitionStatusByBikeId}
        riderAllInsurancesByRiderId={riderAllInsurancesByRiderId}
        insuranceItemById={insuranceItemById}
        insuranceOptions={insuranceOptions}
        ignitionBlockedByBikeId={ignitionBlockedByBikeId}
        stationData={stationData}
        riderActiveInsuranceByRiderId={riderActiveInsuranceByRiderId}
        riderOptions={riderOptions}
        vehicleOptions={vehicleOptions}
        templateOptions={templateOptions}
        statusParam={statusParam ?? null}
        vehicleNotice={vehicleData.notice}
      />
    </OverviewClientShell>
  </div>
);
```

`globals.css` 에 다음 추가:
```css
.page-container--fullscreen {
  padding: 0;
  overflow: hidden;
  height: 100vh;
}
```

Note: `loadStationList()` 는 이미 `stationData` 로 로드되어 있으므로 `loadOtherTabContent` 삭제.

- [ ] **Step 9: 타입체크 + 빌드**

```bash
cd development/front-admin-web
npx tsc --noEmit
```

Expected: 0 errors

```bash
npm run build
```

Expected: build 성공

- [ ] **Step 10: 커밋**

```bash
git add -A
git commit -m "feat: fullscreen map always-on layout with BottomMapPanel"
```

---

## Task 3: 백엔드 V32 마이그레이션 + Tip 도메인 (엔티티, 레포지토리, DTO)

**Files:**
- Create: `development/service-ops-api/src/main/resources/db/migration/V32__create_tips_table.sql`
- Create: `development/service-ops-api/src/main/java/com/thundercrew/opsapi/tip/TipPackage.java`
- Create: `development/service-ops-api/src/main/java/com/thundercrew/opsapi/tip/domain/Tip.java`
- Create: `development/service-ops-api/src/main/java/com/thundercrew/opsapi/tip/repository/TipRepository.java`
- Create: `development/service-ops-api/src/main/java/com/thundercrew/opsapi/tip/dto/TipReadResponse.java`
- Create: `development/service-ops-api/src/main/java/com/thundercrew/opsapi/tip/dto/TipCreateRequest.java`
- Create: `development/service-ops-api/src/main/java/com/thundercrew/opsapi/tip/dto/TipUpdateRequest.java`

- [ ] **Step 1: V32 마이그레이션 파일 작성**

`development/service-ops-api/src/main/resources/db/migration/V32__create_tips_table.sql`:

```sql
create table tips (
    id         uuid             primary key default gen_random_uuid(),
    idx        bigserial        unique not null,
    address    text             not null,
    content    text             not null,
    latitude   double precision not null,
    longitude  double precision not null,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    created_at timestamp with time zone not null default now(),
    updated_at timestamp with time zone not null default now()
);
```

- [ ] **Step 2: TipPackage.java 생성**

```java
package com.thundercrew.opsapi.tip;

public final class TipPackage {
    private TipPackage() {}
}
```

- [ ] **Step 3: Tip 엔티티 생성**

`development/service-ops-api/src/main/java/com/thundercrew/opsapi/tip/domain/Tip.java`:

```java
package com.thundercrew.opsapi.tip.domain;

import com.thundercrew.opsapi.common.domain.DisplaySequencedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "tips")
public class Tip extends DisplaySequencedEntity {

    @Column(nullable = false, columnDefinition = "text")
    private String address;

    @Column(nullable = false, columnDefinition = "text")
    private String content;

    @Column(nullable = false)
    private double latitude;

    @Column(nullable = false)
    private double longitude;

    public static Tip create(String address, String content, double latitude, double longitude) {
        Tip tip = new Tip();
        tip.address = address;
        tip.content = content;
        tip.latitude = latitude;
        tip.longitude = longitude;
        return tip;
    }

    public void update(String address, String content, double latitude, double longitude) {
        this.address = address;
        this.content = content;
        this.latitude = latitude;
        this.longitude = longitude;
    }

    public String getAddress() { return address; }
    public String getContent() { return content; }
    public double getLatitude() { return latitude; }
    public double getLongitude() { return longitude; }
}
```

- [ ] **Step 4: TipRepository 생성**

```java
package com.thundercrew.opsapi.tip.repository;

import com.thundercrew.opsapi.tip.domain.Tip;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.Repository;

public interface TipRepository extends Repository<Tip, UUID> {
    Page<Tip> findByDeletedAtIsNull(Pageable pageable);
    Optional<Tip> findByIdAndDeletedAtIsNull(UUID id);
    Tip save(Tip tip);
    List<Tip> findAllByDeletedAtIsNull();
}
```

- [ ] **Step 5: TipReadResponse DTO 생성**

```java
package com.thundercrew.opsapi.tip.dto;

import com.thundercrew.opsapi.tip.domain.Tip;
import java.time.Instant;
import java.util.UUID;

public record TipReadResponse(
        UUID id,
        Long idx,
        String address,
        String content,
        double latitude,
        double longitude,
        Instant createdAt,
        Instant updatedAt
) {
    public static TipReadResponse from(Tip tip) {
        return new TipReadResponse(
                tip.getId(),
                tip.getIdx(),
                tip.getAddress(),
                tip.getContent(),
                tip.getLatitude(),
                tip.getLongitude(),
                tip.getCreatedAt(),
                tip.getUpdatedAt()
        );
    }
}
```

- [ ] **Step 6: TipCreateRequest DTO 생성**

```java
package com.thundercrew.opsapi.tip.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;

public record TipCreateRequest(
        @NotBlank String address,
        @NotBlank String content,
        @DecimalMin("-90.0") @DecimalMax("90.0") double latitude,
        @DecimalMin("-180.0") @DecimalMax("180.0") double longitude
) {}
```

- [ ] **Step 7: TipUpdateRequest DTO 생성**

```java
package com.thundercrew.opsapi.tip.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;

public record TipUpdateRequest(
        @NotBlank String address,
        @NotBlank String content,
        @DecimalMin("-90.0") @DecimalMax("90.0") double latitude,
        @DecimalMin("-180.0") @DecimalMax("180.0") double longitude
) {}
```

- [ ] **Step 8: 백엔드 빌드 확인**

```bash
cd development/service-ops-api
./gradlew compileJava
```

Expected: BUILD SUCCESSFUL

- [ ] **Step 9: 커밋**

```bash
git add -A
git commit -m "feat: V32 tips table migration + Tip entity/repository/DTOs"
```

---

## Task 4: 백엔드 Tip 서비스 + 컨트롤러 + Dashboard TipPin 확장

**Files:**
- Create: `development/service-ops-api/src/main/java/com/thundercrew/opsapi/tip/service/TipReadService.java`
- Create: `development/service-ops-api/src/main/java/com/thundercrew/opsapi/tip/service/TipCommandService.java`
- Create: `development/service-ops-api/src/main/java/com/thundercrew/opsapi/tip/controller/TipController.java`
- Modify: `development/service-ops-api/src/main/java/com/thundercrew/opsapi/dashboard/dto/DashboardMapStateResponse.java`
- Modify: `development/service-ops-api/src/main/java/com/thundercrew/opsapi/dashboard/service/DashboardMapStateService.java`

- [ ] **Step 1: TipReadService 생성**

```java
package com.thundercrew.opsapi.tip.service;

import com.thundercrew.opsapi.common.api.PageResponse;
import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import com.thundercrew.opsapi.tip.domain.Tip;
import com.thundercrew.opsapi.tip.dto.TipReadResponse;
import com.thundercrew.opsapi.tip.repository.TipRepository;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class TipReadService {

    private final TipRepository tipRepository;

    public TipReadService(TipRepository tipRepository) {
        this.tipRepository = tipRepository;
    }

    public PageResponse<TipReadResponse> listTips(Pageable pageable) {
        Page<TipReadResponse> page = tipRepository.findByDeletedAtIsNull(pageable)
                .map(TipReadResponse::from);
        return PageResponse.of(page);
    }

    public TipReadResponse getTip(UUID id) {
        Tip tip = tipRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("팁을 찾을 수 없습니다."));
        return TipReadResponse.from(tip);
    }
}
```

- [ ] **Step 2: TipCommandService 생성**

```java
package com.thundercrew.opsapi.tip.service;

import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import com.thundercrew.opsapi.tip.domain.Tip;
import com.thundercrew.opsapi.tip.dto.TipCreateRequest;
import com.thundercrew.opsapi.tip.dto.TipReadResponse;
import com.thundercrew.opsapi.tip.dto.TipUpdateRequest;
import com.thundercrew.opsapi.tip.repository.TipRepository;
import java.time.Instant;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class TipCommandService {

    private final TipRepository tipRepository;

    public TipCommandService(TipRepository tipRepository) {
        this.tipRepository = tipRepository;
    }

    public TipReadResponse createTip(TipCreateRequest request) {
        Tip tip = Tip.create(request.address(), request.content(), request.latitude(), request.longitude());
        return TipReadResponse.from(tipRepository.save(tip));
    }

    public TipReadResponse updateTip(UUID id, TipUpdateRequest request) {
        Tip tip = tipRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("팁을 찾을 수 없습니다."));
        tip.update(request.address(), request.content(), request.latitude(), request.longitude());
        return TipReadResponse.from(tipRepository.save(tip));
    }

    public void deleteTip(UUID id) {
        Tip tip = tipRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("팁을 찾을 수 없습니다."));
        tip.markDeleted(null, Instant.now());
        tipRepository.save(tip);
    }
}
```

- [ ] **Step 3: TipController 생성**

```java
package com.thundercrew.opsapi.tip.controller;

import com.thundercrew.opsapi.common.api.PageResponse;
import com.thundercrew.opsapi.tip.dto.TipCreateRequest;
import com.thundercrew.opsapi.tip.dto.TipReadResponse;
import com.thundercrew.opsapi.tip.dto.TipUpdateRequest;
import com.thundercrew.opsapi.tip.service.TipCommandService;
import com.thundercrew.opsapi.tip.service.TipReadService;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/tips")
public class TipController {

    private final TipReadService tipReadService;
    private final TipCommandService tipCommandService;

    public TipController(TipReadService tipReadService, TipCommandService tipCommandService) {
        this.tipReadService = tipReadService;
        this.tipCommandService = tipCommandService;
    }

    @GetMapping
    PageResponse<TipReadResponse> list(@PageableDefault(sort = "idx") Pageable pageable) {
        return tipReadService.listTips(pageable);
    }

    @GetMapping("/{id}")
    TipReadResponse get(@PathVariable UUID id) {
        return tipReadService.getTip(id);
    }

    @PostMapping
    ResponseEntity<TipReadResponse> create(@Valid @RequestBody TipCreateRequest request) {
        TipReadResponse response = tipCommandService.createTip(request);
        return ResponseEntity.created(URI.create("/api/v1/tips/" + response.id())).body(response);
    }

    @PutMapping("/{id}")
    TipReadResponse update(@PathVariable UUID id, @Valid @RequestBody TipUpdateRequest request) {
        return tipCommandService.updateTip(id, request);
    }

    @DeleteMapping("/{id}")
    ResponseEntity<Void> delete(@PathVariable UUID id) {
        tipCommandService.deleteTip(id);
        return ResponseEntity.noContent().build();
    }
}
```

- [ ] **Step 4: DashboardMapStateResponse에 TipPin 추가**

`development/service-ops-api/src/main/java/com/thundercrew/opsapi/dashboard/dto/DashboardMapStateResponse.java` 수정:

```java
// 레코드 최상위 필드에 tips 추가:
public record DashboardMapStateResponse(
        Instant generatedAt,
        DashboardSummary summary,
        List<BikePin> bikePins,
        List<StationPin> stationPins,
        List<TipPin> tips             // ← 추가
) {
    // ... 기존 nested records 유지 ...

    // TipPin nested record 추가:
    public record TipPin(
            UUID id,
            String address,
            String content,
            double latitude,
            double longitude
    ) {}
}
```

- [ ] **Step 5: DashboardMapStateService에 TipRepository 주입 + tips 조회**

`DashboardMapStateService.java` 수정:

```java
// import 추가:
import com.thundercrew.opsapi.tip.domain.Tip;
import com.thundercrew.opsapi.tip.repository.TipRepository;
import com.thundercrew.opsapi.dashboard.dto.DashboardMapStateResponse.TipPin;

// 생성자에 TipRepository 추가:
private final TipRepository tipRepository;

public DashboardMapStateService(
        DashboardMapQueryRepository dashboardMapQueryRepository,
        TipRepository tipRepository,
        Clock clock) {
    this.dashboardMapQueryRepository = dashboardMapQueryRepository;
    this.tipRepository = tipRepository;
    this.clock = clock;
}

// getMapState() 에서 tips 조회 후 응답에 포함:
public DashboardMapStateResponse getMapState() {
    // ... 기존 코드 ...
    List<TipPin> tips = tipRepository.findAllByDeletedAtIsNull().stream()
            .map(tip -> new TipPin(tip.getId(), tip.getAddress(), tip.getContent(),
                                   tip.getLatitude(), tip.getLongitude()))
            .toList();
    return new DashboardMapStateResponse(generatedAt, summary, bikePins, stationPins, tips);
}
```

- [ ] **Step 6: 백엔드 빌드**

```bash
cd development/service-ops-api
./gradlew compileJava
```

Expected: BUILD SUCCESSFUL

- [ ] **Step 7: 커밋**

```bash
git add -A
git commit -m "feat: TipReadService, TipCommandService, TipController, Dashboard TipPin"
```

---

## Task 5: 백엔드 계약 테스트

**Files:**
- Create: `development/service-ops-api/src/test/java/com/thundercrew/opsapi/TipApiContractTests.java`

- [ ] **Step 1: 실패하는 테스트 작성**

```java
package com.thundercrew.opsapi;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class TipApiContractTests extends PostgresContainerSupport {

    private static final UUID ADMIN_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final Pattern TOKEN_PATTERN =
            Pattern.compile("\"accessToken\"\\s*:\\s*\"([^\"]+)\"");

    @Autowired MockMvc mockMvc;
    @Autowired JdbcTemplate jdbcTemplate;
    @Autowired PasswordEncoder passwordEncoder;

    private String accessToken;

    @DynamicPropertySource
    static void postgresProperties(DynamicPropertyRegistry registry) {
        registerPostgresProperties(registry);
    }

    @BeforeEach
    void setUp() throws Exception {
        jdbcTemplate.update("delete from tips");
        jdbcTemplate.update("delete from admin_users");
        jdbcTemplate.update("""
                insert into admin_users (id, login_id, email, password_hash, display_name, enabled)
                values (?, 'ops-admin', 'ops@example.test', ?, 'Ops Admin', true)
                """, ADMIN_ID, passwordEncoder.encode("correct-password"));
        accessToken = loginAndExtractToken();
    }

    @Test
    void post_createsTip() throws Exception {
        mockMvc.perform(post("/api/v1/tips")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "address": "서울 강남구 역삼동 123",
                                  "content": "공사 중 우회 필요",
                                  "latitude": 37.4987,
                                  "longitude": 127.0276
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.address").value("서울 강남구 역삼동 123"))
                .andExpect(jsonPath("$.content").value("공사 중 우회 필요"))
                .andExpect(jsonPath("$.latitude").value(37.4987))
                .andExpect(jsonPath("$.longitude").value(127.0276))
                .andExpect(jsonPath("$.id").isString())
                .andExpect(jsonPath("$.idx").isNumber());
    }

    @Test
    void get_returnsCreatedTip() throws Exception {
        String createBody = """
                {"address":"서울 종로구 세종대로 1","content":"도로 파손 주의",
                 "latitude":37.5762,"longitude":126.9769}
                """;
        MvcResult created = mockMvc.perform(post("/api/v1/tips")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody))
                .andExpect(status().isCreated())
                .andReturn();

        String id = extractId(created.getResponse().getContentAsString());

        mockMvc.perform(get("/api/v1/tips/{id}", id)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.address").value("서울 종로구 세종대로 1"));
    }

    @Test
    void put_updatesTip() throws Exception {
        MvcResult created = mockMvc.perform(post("/api/v1/tips")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"address":"서울 마포구 1","content":"원래 내용",
                                 "latitude":37.555,"longitude":126.920}
                                """))
                .andExpect(status().isCreated())
                .andReturn();

        String id = extractId(created.getResponse().getContentAsString());

        mockMvc.perform(put("/api/v1/tips/{id}", id)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"address":"서울 마포구 수정됨","content":"수정된 내용",
                                 "latitude":37.555,"longitude":126.920}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.address").value("서울 마포구 수정됨"))
                .andExpect(jsonPath("$.content").value("수정된 내용"));
    }

    @Test
    void delete_softDeletesTip() throws Exception {
        MvcResult created = mockMvc.perform(post("/api/v1/tips")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"address":"삭제 대상","content":"삭제할 내용",
                                 "latitude":37.5,"longitude":126.9}
                                """))
                .andExpect(status().isCreated())
                .andReturn();

        String id = extractId(created.getResponse().getContentAsString());

        mockMvc.perform(delete("/api/v1/tips/{id}", id)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isNoContent());

        // GET 후 404
        mockMvc.perform(get("/api/v1/tips/{id}", id)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isNotFound());
    }

    @Test
    void post_rejectsBlankAddress() throws Exception {
        mockMvc.perform(post("/api/v1/tips")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"address":"","content":"내용","latitude":37.5,"longitude":126.9}
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    void list_returnsPaginatedTips() throws Exception {
        for (int i = 0; i < 3; i++) {
            mockMvc.perform(post("/api/v1/tips")
                            .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(String.format("""
                                    {"address":"주소 %d","content":"내용 %d","latitude":37.5,"longitude":126.9}
                                    """, i, i)))
                    .andExpect(status().isCreated());
        }

        mockMvc.perform(get("/api/v1/tips")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isArray())
                .andExpect(jsonPath("$.page.totalItems").value(3));
    }

    @Test
    void dashboardMapState_includesTips() throws Exception {
        mockMvc.perform(post("/api/v1/tips")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"address":"대시보드 팁","content":"내용","latitude":37.5,"longitude":126.9}
                                """))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/v1/dashboard/map-state")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tips").isArray())
                .andExpect(jsonPath("$.tips[0].address").value("대시보드 팁"));
    }

    private String loginAndExtractToken() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"loginId\":\"ops-admin\",\"password\":\"correct-password\"}"))
                .andReturn();
        Matcher m = TOKEN_PATTERN.matcher(result.getResponse().getContentAsString());
        if (!m.find()) throw new IllegalStateException("No access token in login response");
        return m.group(1);
    }

    private String extractId(String json) {
        Matcher m = Pattern.compile("\"id\"\\s*:\\s*\"([^\"]+)\"").matcher(json);
        if (!m.find()) throw new IllegalStateException("No id in response: " + json);
        return m.group(1);
    }
}
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd development/service-ops-api
./gradlew test --tests "com.thundercrew.opsapi.TipApiContractTests" 2>&1 | tail -20
```

Expected: 테스트 컴파일은 되지만 일부 실패 (아직 DB 스키마가 없으면 `SchemaValidationException`)

- [ ] **Step 3: 전체 테스트 실행**

```bash
./gradlew test 2>&1 | tail -30
```

Expected: 전체 통과 (기존 테스트 포함)

- [ ] **Step 4: 커밋**

```bash
git add -A
git commit -m "test: TipApiContractTests — CRUD + dashboard integration"
```

---

## Task 6: 프론트엔드 Tips API 클라이언트 + 서버 액션

**Files:**
- Modify: `development/front-admin-web/lib/services/service-ops-api.ts`
- Create: `development/front-admin-web/app/tips/actions.ts`

- [ ] **Step 1: service-ops-api.ts에 ServiceOpsTip 타입 + CRUD 메서드 추가**

`lib/services/service-ops-api.ts` 에서 타입 정의 섹션에 추가:

```typescript
export interface ServiceOpsTip {
  id: string;
  idx: number;
  address: string;
  content: string;
  latitude: number;
  longitude: number;
  createdAt: string;
  updatedAt: string;
}

export interface TipUpsertPayload {
  address: string;
  content: string;
  latitude: number;
  longitude: number;
}
```

API 클라이언트 클래스에 메서드 추가 (기존 `listVehicles` 패턴 참고):

```typescript
async listTips(params?: { page?: number; size?: number }): Promise<ServiceOpsPage<ServiceOpsTip>> {
  const url = new URL(`${this.baseUrl}/api/v1/tips`);
  if (params?.page !== undefined) url.searchParams.set("page", String(params.page));
  if (params?.size !== undefined) url.searchParams.set("size", String(params.size));
  const res = await this.fetch(url.toString());
  if (!res.ok) throw await this.toError(res);
  return res.json();
}

async getTip(id: string): Promise<ServiceOpsTip> {
  const res = await this.fetch(`${this.baseUrl}/api/v1/tips/${id}`);
  if (!res.ok) throw await this.toError(res);
  return res.json();
}

async createTip(data: TipUpsertPayload): Promise<ServiceOpsTip> {
  const res = await this.fetch(`${this.baseUrl}/api/v1/tips`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw await this.toError(res);
  return res.json();
}

async updateTip(id: string, data: TipUpsertPayload): Promise<ServiceOpsTip> {
  const res = await this.fetch(`${this.baseUrl}/api/v1/tips/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw await this.toError(res);
  return res.json();
}

async deleteTip(id: string): Promise<void> {
  const res = await this.fetch(`${this.baseUrl}/api/v1/tips/${id}`, { method: "DELETE" });
  if (!res.ok) throw await this.toError(res);
}
```

- [ ] **Step 2: app/tips/actions.ts 생성**

```typescript
"use server";

import {
  createAuthenticatedServiceOpsApiClient,
} from "@/lib/services/service-ops-session";
import type { ServiceOpsTip, TipUpsertPayload } from "@/lib/services/service-ops-api";

export async function listTipsAction(): Promise<ServiceOpsTip[]> {
  const client = await createAuthenticatedServiceOpsApiClient();
  if (!client) return [];
  try {
    const page = await client.listTips({ page: 0, size: 200 });
    return page.items;
  } catch {
    return [];
  }
}

export async function createTipAction(data: TipUpsertPayload): Promise<ServiceOpsTip> {
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) throw new Error("로그인이 필요합니다.");
  return client.createTip(data);
}

export async function updateTipAction(id: string, data: TipUpsertPayload): Promise<ServiceOpsTip> {
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) throw new Error("로그인이 필요합니다.");
  return client.updateTip(id, data);
}

export async function deleteTipAction(id: string): Promise<void> {
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) throw new Error("로그인이 필요합니다.");
  await client.deleteTip(id);
}
```

- [ ] **Step 3: 타입체크**

```bash
cd development/front-admin-web
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 4: 커밋**

```bash
git add -A
git commit -m "feat: Tips API client types + server actions"
```

---

## Task 7: TipsPanel + CreateTipDialog + EditTipDialog

**Files:**
- Create: `development/front-admin-web/components/overview/TipsPanel.tsx`
- Create: `development/front-admin-web/components/overview/CreateTipDialog.tsx`
- Create: `development/front-admin-web/components/overview/EditTipDialog.tsx`
- Modify: `development/front-admin-web/app/globals.css`

- [ ] **Step 1: TipsPanel 생성**

`development/front-admin-web/components/overview/TipsPanel.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { CreateTipDialog } from "./CreateTipDialog";
import { EditTipDialog } from "./EditTipDialog";
import { listTipsAction, deleteTipAction } from "@/app/tips/actions";
import type { ServiceOpsTip } from "@/lib/services/service-ops-api";

interface TipsPanelProps {
  selectedTipId: string | null;
  onTipSelect: (id: string | null) => void;
}

export function TipsPanel({ selectedTipId, onTipSelect }: TipsPanelProps) {
  const [tips, setTips] = useState<ServiceOpsTip[]>([]);
  const [editTarget, setEditTarget] = useState<ServiceOpsTip | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const reload = useCallback(() => {
    startTransition(async () => {
      const data = await listTipsAction();
      setTips(data);
    });
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const handleDelete = async (tip: ServiceOpsTip) => {
    if (!confirm(`"${tip.address}" 팁을 삭제하시겠습니까?`)) return;
    await deleteTipAction(tip.id);
    reload();
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit" });

  return (
    <div className="tips-panel">
      <div className="tips-panel-header">
        <span className="tips-panel-title">팁 목록 ({tips.length})</span>
        <button type="button" className="btn btn--sm btn--primary" onClick={() => setCreateOpen(true)}>
          + 팁 추가
        </button>
      </div>
      {isPending ? (
        <div className="tips-panel-loading">로딩 중…</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>주소</th>
              <th>내용</th>
              <th>등록일</th>
              <th>액션</th>
            </tr>
          </thead>
          <tbody>
            {tips.map((tip) => (
              <tr
                key={tip.id}
                className={tip.id === selectedTipId ? "is-selected" : ""}
                onClick={() => onTipSelect(tip.id === selectedTipId ? null : tip.id)}
                style={{ cursor: "pointer" }}
              >
                <td>{tip.address}</td>
                <td className="tips-panel-content-cell">{tip.content}</td>
                <td>{formatDate(tip.createdAt)}</td>
                <td className="tips-panel-actions" onClick={(e) => e.stopPropagation()}>
                  <button type="button" className="btn btn--xs btn--ghost" onClick={() => setEditTarget(tip)}>
                    편집
                  </button>
                  <button type="button" className="btn btn--xs btn--danger-ghost" onClick={() => handleDelete(tip)}>
                    삭제
                  </button>
                </td>
              </tr>
            ))}
            {tips.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: "center", color: "var(--color-text-tertiary)", padding: "24px" }}>
                  등록된 팁이 없습니다
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
      {createOpen && (
        <CreateTipDialog
          onClose={() => setCreateOpen(false)}
          onSaved={() => { setCreateOpen(false); reload(); }}
        />
      )}
      {editTarget && (
        <EditTipDialog
          tip={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); reload(); }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: CreateTipDialog 생성**

`development/front-admin-web/components/overview/CreateTipDialog.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { createTipAction } from "@/app/tips/actions";
import type { NaverMapInstance } from "@/types/naver-maps";

interface CreateTipDialogProps {
  onClose: () => void;
  onSaved: () => void;
}

const NCP_CLIENT_ID = process.env.NEXT_PUBLIC_NCP_MAP_CLIENT_ID;
const SDK_BASE_URL = "https://oapi.map.naver.com/openapi/v3/maps.js";

export function CreateTipDialog({ onClose, onSaved }: CreateTipDialogProps) {
  const [address, setAddress] = useState("");
  const [content, setContent] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<NaverMapInstance | null>(null);
  const pinMarkerRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initMap = () => {
      const naver = (window as any).naver;
      if (!naver?.maps?.Map || !mapContainerRef.current) return;
      const map = new naver.maps.Map(mapContainerRef.current, {
        center: new naver.maps.LatLng(37.5666103, 126.9783882),
        zoom: 12
      });
      mapRef.current = map;
      naver.maps.Event.addListener(map, "click", (e: any) => {
        const coord = e.coord;
        setLat(coord.lat());
        setLng(coord.lng());
        if (pinMarkerRef.current) pinMarkerRef.current.setMap(null);
        pinMarkerRef.current = new naver.maps.Marker({
          position: coord,
          map
        });
      });
    };

    if ((window as any).naver?.maps?.Map) {
      initMap();
    } else if (NCP_CLIENT_ID) {
      const existing = document.querySelector('script[data-id="ncp-maps-sdk-base"]');
      if (existing) {
        existing.addEventListener("load", initMap, { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = `${SDK_BASE_URL}?ncpKeyId=${encodeURIComponent(NCP_CLIENT_ID)}`;
      script.async = false;
      script.dataset.id = "ncp-maps-sdk-base";
      script.addEventListener("load", initMap, { once: true });
      document.head.appendChild(script);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lat || !lng) { setError("지도에서 위치를 클릭해 주세요."); return; }
    if (!address.trim()) { setError("주소를 입력해 주세요."); return; }
    if (!content.trim()) { setError("내용을 입력해 주세요."); return; }
    setSaving(true);
    setError(null);
    try {
      await createTipAction({ address: address.trim(), content: content.trim(), latitude: lat, longitude: lng });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 오류");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h3 className="dialog-title">팁 추가</h3>
          <button type="button" className="dialog-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="dialog-body">
          <label className="form-label">
            주소
            <input
              className="form-input"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="도로명 주소 직접 입력"
            />
          </label>
          <label className="form-label">
            내용
            <textarea
              className="form-textarea"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="팁 내용을 입력하세요"
              rows={3}
            />
          </label>
          <div className="form-label">
            위치 <span className="form-hint">(지도를 클릭해 핀 설정)</span>
            <div ref={mapContainerRef} className="tip-mini-map" />
            {lat && lng && (
              <span className="form-hint tip-coords">
                {lat.toFixed(5)}, {lng.toFixed(5)}
              </span>
            )}
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="dialog-footer">
            <button type="button" className="btn btn--ghost" onClick={onClose}>취소</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? "저장 중…" : "저장"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: EditTipDialog 생성**

`development/front-admin-web/components/overview/EditTipDialog.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { updateTipAction } from "@/app/tips/actions";
import type { ServiceOpsTip } from "@/lib/services/service-ops-api";
import type { NaverMapInstance } from "@/types/naver-maps";

interface EditTipDialogProps {
  tip: ServiceOpsTip;
  onClose: () => void;
  onSaved: () => void;
}

const NCP_CLIENT_ID = process.env.NEXT_PUBLIC_NCP_MAP_CLIENT_ID;
const SDK_BASE_URL = "https://oapi.map.naver.com/openapi/v3/maps.js";

export function EditTipDialog({ tip, onClose, onSaved }: EditTipDialogProps) {
  const [address, setAddress] = useState(tip.address);
  const [content, setContent] = useState(tip.content);
  const [lat, setLat] = useState<number>(tip.latitude);
  const [lng, setLng] = useState<number>(tip.longitude);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<NaverMapInstance | null>(null);
  const pinMarkerRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initMap = () => {
      const naver = (window as any).naver;
      if (!naver?.maps?.Map || !mapContainerRef.current) return;
      const map = new naver.maps.Map(mapContainerRef.current, {
        center: new naver.maps.LatLng(tip.latitude, tip.longitude),
        zoom: 14
      });
      mapRef.current = map;
      // 기존 핀 표시
      pinMarkerRef.current = new naver.maps.Marker({
        position: new naver.maps.LatLng(tip.latitude, tip.longitude),
        map
      });
      naver.maps.Event.addListener(map, "click", (e: any) => {
        const coord = e.coord;
        setLat(coord.lat());
        setLng(coord.lng());
        if (pinMarkerRef.current) pinMarkerRef.current.setMap(null);
        pinMarkerRef.current = new naver.maps.Marker({ position: coord, map });
      });
    };
    if ((window as any).naver?.maps?.Map) {
      initMap();
    } else if (NCP_CLIENT_ID) {
      const existing = document.querySelector('script[data-id="ncp-maps-sdk-base"]');
      if (existing) { existing.addEventListener("load", initMap, { once: true }); return; }
      const script = document.createElement("script");
      script.src = `${SDK_BASE_URL}?ncpKeyId=${encodeURIComponent(NCP_CLIENT_ID)}`;
      script.async = false;
      script.dataset.id = "ncp-maps-sdk-base";
      script.addEventListener("load", initMap, { once: true });
      document.head.appendChild(script);
    }
  }, [tip.latitude, tip.longitude]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim()) { setError("주소를 입력해 주세요."); return; }
    if (!content.trim()) { setError("내용을 입력해 주세요."); return; }
    setSaving(true);
    setError(null);
    try {
      await updateTipAction(tip.id, { address: address.trim(), content: content.trim(), latitude: lat, longitude: lng });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 오류");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h3 className="dialog-title">팁 편집</h3>
          <button type="button" className="dialog-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="dialog-body">
          <label className="form-label">
            주소
            <input className="form-input" type="text" value={address} onChange={(e) => setAddress(e.target.value)} />
          </label>
          <label className="form-label">
            내용
            <textarea className="form-textarea" value={content} onChange={(e) => setContent(e.target.value)} rows={3} />
          </label>
          <div className="form-label">
            위치 <span className="form-hint">(클릭으로 핀 이동)</span>
            <div ref={mapContainerRef} className="tip-mini-map" />
            <span className="form-hint tip-coords">{lat.toFixed(5)}, {lng.toFixed(5)}</span>
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="dialog-footer">
            <button type="button" className="btn btn--ghost" onClick={onClose}>취소</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? "저장 중…" : "저장"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: globals.css에 TipsPanel + 미니맵 CSS 추가**

`app/globals.css` 에 추가:

```css
/* ─── TipsPanel ──────────────────────────────────────────────── */
.tips-panel {
  padding: 12px;
}

.tips-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.tips-panel-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.tips-panel-content-cell {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tips-panel-actions {
  display: flex;
  gap: 4px;
}

.tips-panel-loading {
  padding: 24px;
  text-align: center;
  color: var(--color-text-tertiary);
  font-size: 13px;
}

/* ─── Tip mini-map ───────────────────────────────────────────── */
.tip-mini-map {
  width: 100%;
  height: 200px;
  border-radius: var(--border-radius-md);
  overflow: hidden;
  border: 0.5px solid var(--color-border-secondary);
  margin-top: 6px;
}

.tip-coords {
  display: block;
  margin-top: 4px;
  font-size: 11px;
  color: var(--color-text-tertiary);
}
```

- [ ] **Step 5: 타입체크**

```bash
cd development/front-admin-web
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 6: 커밋**

```bash
git add -A
git commit -m "feat: TipsPanel + CreateTipDialog + EditTipDialog"
```

---

## Task 8: MapShell 팁 마커 + 양방향 연동 + BottomMapPanel 팁 탭 연결

**Files:**
- Modify: `development/front-admin-web/components/dashboard/MapShell.tsx`
- Modify: `development/front-admin-web/components/overview/FullscreenMapHost.tsx`
- Modify: `development/front-admin-web/app/globals.css`

- [ ] **Step 1: MapShell에 팁 마커 렌더링 effect 추가**

`MapShell.tsx` 에서:

1. 모듈 상수 추가:
```typescript
const TIP_COLOR_VAR = "--rm-tip";
```

2. `MapShell` 함수 파라미터에서 `tipPins` 와 `onTipSelect` 를 활성화:
```typescript
const onTipSelectRef = useRef(onTipSelect);
const tipMarkerCacheRef = useRef<Map<string, NaverMarkerInstance>>(new Map());
// onTipSelectRef 갱신 useEffect에 onTipSelect 추가
```

3. 팁 아이콘 SVG 함수 추가:
```typescript
function tipIconSvg(): string {
  return `<svg ${ICON_SVG_PROPS}>
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
    <circle cx="12" cy="9" r="2.5" fill="none"/>
  </svg>`;
}
```

4. 팁 마커 HTML 함수 추가:
```typescript
function tipMarkerHtml(address: string, showLabel: boolean): string {
  const wrapped = markerWrapper(tipIconSvg(), TIP_COLOR_VAR);
  if (!showLabel) return wrapped;
  return `<div style="position:relative;pointer-events:auto;width:${ICON_PX}px;height:${ICON_PX}px;">${labelMarkup(address)}${wrapped}</div>`;
}
```

5. globals.css 에 팁 마커 색 변수 추가 (`:root` 블록 또는 전용 섹션):
```css
:root { --rm-tip: #7C3AED; }
[data-theme="dark"] { --rm-tip: #a78bfa; }
```

6. 팁 마커 useEffect 추가 (기존 stationPins useEffect 패턴 그대로):

```typescript
useEffect(() => {
  if (!sdkReady) return;
  const map = mapRef.current;
  const naver = typeof window !== "undefined" ? window.naver : undefined;
  if (!map || !naver?.maps?.Marker) return;

  const cache = tipMarkerCacheRef.current;
  const incomingIds = new Set<string>();
  const showLabel = currentZoom >= LABEL_VISIBLE_ZOOM;

  for (const pin of tipPins) {
    incomingIds.add(pin.id);
    const position = new naver.maps.LatLng(pin.latitude, pin.longitude);
    const html = tipMarkerHtml(pin.address, showLabel);
    const icon = {
      content: html,
      anchor: new naver.maps.Point(ICON_ANCHOR, ICON_ANCHOR),
      size: new naver.maps.Size(ICON_PX, ICON_PX)
    };
    const existing = cache.get(pin.id);
    if (existing) {
      existing.setPosition?.(position);
      existing.setIcon?.(icon);
      continue;
    }
    const marker = new naver.maps.Marker({
      position, map, title: pin.address, icon,
      clickable: Boolean(onTipSelectRef.current)
    });
    if (onTipSelectRef.current && naver.maps.Event) {
      naver.maps.Event.addListener(marker, "click", () => {
        onTipSelectRef.current?.(pin.id);
      });
    }
    cache.set(pin.id, marker);
  }

  for (const [tipId, marker] of cache.entries()) {
    if (!incomingIds.has(tipId)) {
      marker.setMap(null);
      cache.delete(tipId);
    }
  }
}, [sdkReady, tipPins, mapVersion, currentZoom]);
```

7. 테마 토글 시 캐시 정리 블록에 팁 마커도 추가:
```typescript
// 기존 stationMarkerCacheRef.current.clear() 아래에:
for (const m of tipMarkerCacheRef.current.values()) m.setMap(null);
tipMarkerCacheRef.current.clear();
```

- [ ] **Step 2: FullscreenMapHost에 selectedTipId 상태 + TipsPanel 연결**

`FullscreenMapHost.tsx` 수정:

```typescript
// import 추가:
import { TipsPanel } from "@/components/overview/TipsPanel";

// FullscreenMapHostProps에서 tipContent prop 제거 (직접 TipsPanel 렌더링으로 교체)
// selectedTipId 상태 추가:
const [selectedTipId, setSelectedTipId] = useState<string | null>(null);

// MapShell 호출에 onTipSelect 추가:
<MapShell
  ...
  tipPins={[...props.tipPins]}
  onTipSelect={setSelectedTipId}
  ...
/>

// BottomMapPanel 에 tipContent 전달:
<BottomMapPanel
  ...
  tipContent={
    <TipsPanel
      selectedTipId={selectedTipId}
      onTipSelect={setSelectedTipId}
    />
  }
/>
```

`FullscreenMapHostProps` 에서 `tipContent?: React.ReactNode` 제거 (이제 직접 TipsPanel 렌더링).

`BottomMapPanel.tsx` 에서 `tipContent?: React.ReactNode` 를 필수가 아닌 선택 prop 으로 유지 (이미 그렇게 되어 있음).

- [ ] **Step 3: 타입체크 + 빌드**

```bash
cd development/front-admin-web
npx tsc --noEmit && npm run build
```

Expected: 0 errors, build 성공

- [ ] **Step 4: 커밋**

```bash
git add -A
git commit -m "feat: MapShell tip markers + TipsPanel bidirectional sync"
```

---

## Task 9: 최종 검증 + PR

**Files:**
- 수정 없음 (검증 전용)

- [ ] **Step 1: 백엔드 전체 테스트**

```bash
cd development/service-ops-api
./gradlew test
```

Expected: 전체 통과

- [ ] **Step 2: 프론트엔드 타입체크 + 빌드**

```bash
cd development/front-admin-web
npx tsc --noEmit && npm run build
```

Expected: 0 errors, build 성공

- [ ] **Step 3: 배포 서버 확인 (https://thcr.cleversystem.ai)**

백엔드 서버 배포 후:

1. 루트 페이지(`/`) 진입 → 지도가 full viewport 로 즉시 표시되어야 함 (토글 없음)
2. 하단 패널 탭 클릭 → 차량 탭 열림, VehiclesPanel 표시
3. 충전소 탭 클릭 → StationsPanel 표시
4. 팁 탭 클릭 → TipsPanel 표시
5. "팁 추가" 버튼 → CreateTipDialog 열림, 미니맵 표시, 클릭으로 핀 설정
6. 팁 저장 → 목록 갱신, 지도에 보라색 마커 표시
7. 지도 팁 마커 클릭 → TipsPanel 해당 행 하이라이트
8. TipsPanel 행 클릭 → 지도 마커 포커스 (selectedTipId 동기화)
9. `/overview`, `/monitoring` 접근 → `/` 로 리다이렉트 (삭제 X, 리다이렉트 파일 남겨뒀으면 그냥 확인 — 이미 삭제했으면 404 OK)
10. `/management` 페이지 → 여전히 정상 동작

- [ ] **Step 4: PR 생성**

```bash
cd development/front-admin-web
gh pr create \
  --title "feat: Group A — fullscreen map always-on + Tips CRUD" \
  --body "$(cat <<'EOF'
## Summary
- FullscreenMapHost를 항상-on full viewport 레이아웃으로 승격
- 하단 패널 탭: 차량 / 충전소 / 팁
- 팁(위치 기반 알림) full-stack 구현: 백엔드 REST API + 프론트엔드 TipsPanel + 지도 마커
- 삭제: /test-matching, /overview redirect, /monitoring redirect, OverviewMapBanner, OverviewKpiTiles

## Test Plan
- [ ] 루트 페이지 지도 full viewport 표시 확인
- [ ] 하단 패널 탭 차량/충전소/팁 전환 확인
- [ ] 팁 CRUD (생성/편집/삭제) 확인
- [ ] 팁 마커 ↔ 테이블 행 양방향 연동 확인
- [ ] 백엔드 테스트 전체 통과: TipApiContractTests
- [ ] /management 페이지 정상 동작 확인
EOF
)"
```

---

## 주의사항

1. **`VehiclesPanel` props 타입 확인**: Task 2 Step 4 에서 `BottomMapPanel` 이 `VehiclesPanel` 을 렌더링할 때 필요한 prop 이 모두 전달되는지 타입체크로 확인. 특히 `riderActiveContractById` 의 타입이 `Map<string, RiderActiveContractSummary>` 인지 확인.

2. **`StationListResult` 타입**: `lib/services/station-data.ts` 에서 export 되는 타입 이름이 `StationListResult` 인지 확인 후 import. 실제 이름이 다르면 해당 파일에서 확인 후 수정.

3. **`loadOtherTabContent` 제거**: Task 2 Step 8 에서 page.tsx 가 단순화되면 `loadOtherTabContent` 함수도 삭제. 이를 참조하는 타입 추론이 있으면 같이 제거.

4. **NCP 미니맵 SDK 중복 로드**: `CreateTipDialog`, `EditTipDialog` 가 이미 MapShell 이 로드한 NCP SDK 를 재사용한다. `script[data-id="ncp-maps-sdk-base"]` 로 중복 로드를 방지하는 로직이 이미 포함되어 있음.

5. **`ContractMatchingForm` props**: Task 2 에서 `BottomMapPanel` 이 `ContractMatchingForm` 을 렌더링한다. 현재 page.tsx 에서 `statusParam` 이 `string | null` 로 전달되므로 그대로 유지.
