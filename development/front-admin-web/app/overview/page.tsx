import Link from "next/link";
import type { ReactNode } from "react";

import { CreateRiderDialog } from "@/components/management/CreateRiderDialog";
import { CreateStationDialog } from "@/components/management/CreateStationDialog";
import { CreateVehicleDialog } from "@/components/management/CreateVehicleDialog";
import { RidersPanel } from "@/components/management/RidersPanel";
import { StationsPanel } from "@/components/management/StationsPanel";
import { VehiclesPanel } from "@/components/management/VehiclesPanel";
import { loadDashboardMapState } from "@/lib/services/dashboard-map-state-data";
import { loadRiderList } from "@/lib/services/rider-data";
import { loadRiderMatchingSnapshot } from "@/lib/services/rider-matching-snapshot-data";
import { loadStationList } from "@/lib/services/station-data";
import { loadVehicleList } from "@/lib/services/vehicle-data";

// Authenticated, per-admin loader. At build time the env-less mock fallback
// returns synchronously without touching cookies, which lets Next.js
// statically prerender the page. In production that would freeze the
// output across all admins, so we opt in to dynamic rendering explicitly.
export const dynamic = "force-dynamic";

type TabKey = "riders" | "vehicles" | "stations";

type TabConfig = {
  key: TabKey;
  label: string;
};

// Minimal-shell refactor (#175): all domain hub + form pages were
// deleted in favour of redesigning from scratch. Tab configs are now
// pure label-to-key mappings — no createHref / hubHref since none of
// those routes exist any more.
const TABS: ReadonlyArray<TabConfig> = [
  { key: "riders", label: "라이더" },
  { key: "vehicles", label: "차량" },
  { key: "stations", label: "스테이션" }
];

const numberFormatter = new Intl.NumberFormat("ko-KR");

function formatCount(value: number): string {
  return numberFormatter.format(value);
}

function isValidTabKey(value: string | undefined): value is TabKey {
  return TABS.some((tab) => tab.key === value);
}

export default async function OverviewPage({
  searchParams
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  // Always fetch the three datasets that feed the KPI groups + the
  // riders-tab columns: dashboard summary, rider list, and a per-rider
  // matching snapshot (active contracts + active insurances bucketed by
  // riderId). The 매칭 KPI count and the riders-tab 계약/보험 columns
  // both read from the snapshot.
  // Always fetch the cross-tab datasets so the panels can fill the
  // 차량 번호 (riders panel) / 이름 + 연락처 (vehicles panel) lookup
  // columns without a second round-trip on tab switch.
  const [{ tab: tabParam }, mapState, riderData, vehicleData, matching] = await Promise.all([
    searchParams,
    loadDashboardMapState(),
    loadRiderList(),
    loadVehicleList(),
    loadRiderMatchingSnapshot()
  ]);

  const activeTab: TabKey = isValidTabKey(tabParam) ? tabParam : "riders";
  const summary = mapState.data.summary;
  const totalRiders = riderData.riders.length;
  const matchedCount = matching.activeContractCount;

  // Per-bike plate lookup for the riders panel's 차량 번호 column.
  const plateByBikeId = new Map<string, string>();
  for (const vehicle of vehicleData.vehicles) {
    plateByBikeId.set(vehicle.id ?? vehicle.slug, vehicle.plateNumber);
  }
  // riderId → plate for that rider's active bike (single entry per rider
  // because matching keeps one active contract per rider).
  const riderActiveBikePlate = new Map<string, string>();
  for (const [bikeId, riderId] of matching.bikeActiveRiderById) {
    const plate = plateByBikeId.get(bikeId);
    if (plate) riderActiveBikePlate.set(riderId, plate);
  }

  // riderId → { name, phone } for the vehicles panel's 이름 + 연락처
  // columns (lookup pivots on bikeActiveRiderById in VehiclesPanel).
  const riderInfoById = new Map<string, { name: string; phone: string }>();
  for (const rider of riderData.riders) {
    riderInfoById.set(rider.id ?? rider.slug, { name: rider.name, phone: rider.phone });
  }
  // 시동 차량 = telemetry ignition_status === "ON". The dashboard summary
  // does not aggregate this yet, so we count it from the bike pin list
  // (which carries `ignitionStatus` per pin). UNKNOWN / OFF are excluded.
  const ignitionOnCount = mapState.data.bikePins.filter(
    (pin) => pin.ignitionStatus === "ON"
  ).length;

  // Reuse the rider data we already fetched for the KPI calculations when
  // the active tab is also 라이더, so we don't pay a second round-trip.
  // Pass the matching sets to the panel so the 계약 / 보험 columns can
  // render real "있음/없음" badges instead of fallback dashes.
  const activeContent: { panel: ReactNode; notice: string | undefined } =
    activeTab === "riders"
      ? {
          panel: (
            <RidersPanel
              data={riderData}
              insuredRiderIds={matching.insuredRiderIds}
              educationTypeByRiderId={matching.educationTypeByRiderId}
              riderActiveContractById={matching.riderActiveContractById}
              riderActiveBikePlate={riderActiveBikePlate}
            />
          ),
          notice: riderData.notice
        }
      : activeTab === "vehicles"
        ? {
            panel: (
              <VehiclesPanel
                data={vehicleData}
                insuredRiderIds={matching.insuredRiderIds}
                bikeActiveRiderById={matching.bikeActiveRiderById}
                riderInfoById={riderInfoById}
              />
            ),
            notice: vehicleData.notice
          }
        : await loadOtherTabContent(activeTab);

  return (
    <div className="page-container">
      {mapState.notice ? (
        <p className="notice" role="status">
          {mapState.notice}
        </p>
      ) : null}

      <div className="overview-kpi-groups">
        <article className="kpi-group">
          <h3 className="kpi-group-heading">차량 현황</h3>
          <div className="kpi-group-metrics">
            <div>
              <p className="metric-label">전체 차량</p>
              <p className="metric-value">{formatCount(summary.totalBikes)}</p>
            </div>
            <div>
              <p className="metric-label">시동 차량</p>
              <p className="metric-value">{formatCount(ignitionOnCount)}</p>
            </div>
            <div>
              <p className="metric-label">매칭 차량</p>
              <p className="metric-value">{formatCount(matchedCount)}</p>
            </div>
          </div>
        </article>

        <article className="kpi-group">
          <h3 className="kpi-group-heading">라이더 현황</h3>
          <div className="kpi-group-metrics">
            <div>
              <p className="metric-label">전체 라이더</p>
              <p className="metric-value">{formatCount(totalRiders)}</p>
            </div>
            <div>
              <p className="metric-label">매칭 인원</p>
              <p className="metric-value">{formatCount(matchedCount)}</p>
            </div>
          </div>
        </article>

        <article className="kpi-group">
          <h3 className="kpi-group-heading">충전소 현황</h3>
          <div className="kpi-group-metrics">
            <div>
              <p className="metric-label">활성 스테이션</p>
              <p className="metric-value">{formatCount(summary.activeStationCount)}</p>
            </div>
          </div>
        </article>
      </div>

      <h2 className="overview-section-heading">관리</h2>
      <div className="overview-tabs-row">
        <nav className="overview-tabs" aria-label="도메인 관리 탭">
          {TABS.map((tab) => {
            const isActive = tab.key === activeTab;
            return (
              <Link
                key={tab.key}
                className={`overview-tab${isActive ? " is-active" : ""}`}
                href={`/overview?tab=${tab.key}`}
                aria-current={isActive ? "page" : undefined}
                // scroll={false} preserves the current scroll position so the
                // operator stays at the tab row when switching domains -
                // otherwise every tab click jumps back to the top of the page
                // because Next.js's default Link behaviour resets scroll on
                // every navigation.
                scroll={false}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
        <div className="overview-tab-action">
          {activeTab === "riders" ? <CreateRiderDialog /> : null}
          {activeTab === "vehicles" ? <CreateVehicleDialog /> : null}
          {activeTab === "stations" ? <CreateStationDialog /> : null}
        </div>
      </div>

      {activeContent.notice ? (
        <p className="notice" role="status">
          {activeContent.notice}
        </p>
      ) : null}

      {activeContent.panel}
    </div>
  );
}

// Loader for the stations tab; riders + vehicles are handled inline
// because the parent component already fetched their data for cross-
// tab lookups.
async function loadOtherTabContent(
  tab: Extract<TabKey, "stations">
): Promise<{ panel: ReactNode; notice: string | undefined }> {
  switch (tab) {
    case "stations": {
      const data = await loadStationList();
      return { panel: <StationsPanel data={data} />, notice: data.notice };
    }
  }
}
