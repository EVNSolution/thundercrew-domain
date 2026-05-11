import Link from "next/link";
import type { ReactNode } from "react";

import { ContractsPanel } from "@/components/management/ContractsPanel";
import { InsurancePanel } from "@/components/management/InsurancePanel";
import { RidersPanel } from "@/components/management/RidersPanel";
import { StationsPanel } from "@/components/management/StationsPanel";
import { VehiclesPanel } from "@/components/management/VehiclesPanel";
import { loadContractList } from "@/lib/services/contract-data";
import { loadDashboardMapState } from "@/lib/services/dashboard-map-state-data";
import { loadInsuranceList } from "@/lib/services/insurance-data";
import { loadRiderList } from "@/lib/services/rider-data";
import { loadStationList } from "@/lib/services/station-data";
import { loadVehicleList } from "@/lib/services/vehicle-data";

// Authenticated, per-admin loader. At build time the env-less mock fallback
// returns synchronously without touching cookies, which lets Next.js
// statically prerender the page. In production that would freeze the
// output across all admins, so we opt in to dynamic rendering explicitly.
export const dynamic = "force-dynamic";

type TabKey = "riders" | "vehicles" | "stations" | "contracts" | "insurance";

type TabConfig = {
  key: TabKey;
  label: string;
  hubHref: string;
  createHref: string;
  createLabel: string;
};

const TABS: ReadonlyArray<TabConfig> = [
  { key: "riders", label: "라이더", hubHref: "/riders", createHref: "/riders/new", createLabel: "라이더 등록" },
  { key: "vehicles", label: "차량", hubHref: "/vehicles", createHref: "/vehicles/new", createLabel: "차량 등록" },
  { key: "stations", label: "스테이션", hubHref: "/stations", createHref: "/stations/new", createLabel: "스테이션 등록" },
  { key: "contracts", label: "계약", hubHref: "/contracts", createHref: "/contracts/new", createLabel: "계약 등록" },
  { key: "insurance", label: "보험", hubHref: "/insurance", createHref: "/insurance/new", createLabel: "보험 등록" }
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
  // Always fetch the three datasets that feed the KPI groups (dashboard
  // summary + rider list + contract list). Active contracts span both
  // rider-matched and bike-matched counts, so we derive the "matched"
  // KPI from the same contract list rather than asking the backend twice.
  const [{ tab: tabParam }, mapState, riderData, contractData] = await Promise.all([
    searchParams,
    loadDashboardMapState(),
    loadRiderList(),
    loadContractList()
  ]);

  const activeTab: TabKey = isValidTabKey(tabParam) ? tabParam : "riders";
  const activeConfig = TABS.find((tab) => tab.key === activeTab) ?? TABS[0];
  const summary = mapState.data.summary;

  const activeContracts = contractData.contracts.filter((contract) => contract.status === "활성");
  const matchedCount = activeContracts.length;
  const totalRiders = riderData.riders.length;
  // 시동 차량 = telemetry ignition_status === "ON". The dashboard summary
  // does not aggregate this yet, so we count it from the bike pin list
  // (which carries `ignitionStatus` per pin). UNKNOWN / OFF are excluded.
  const ignitionOnCount = mapState.data.bikePins.filter(
    (pin) => pin.ignitionStatus === "ON"
  ).length;

  // Reuse the data we already fetched for KPI calculations when the
  // active tab needs the same loader, so we don't pay a second round-trip
  // when the operator lands on (or switches to) the 라이더 / 계약 tabs.
  const activeContent: { panel: ReactNode; notice: string | undefined } =
    activeTab === "riders"
      ? { panel: <RidersPanel data={riderData} />, notice: riderData.notice }
      : activeTab === "contracts"
        ? { panel: <ContractsPanel data={contractData} />, notice: contractData.notice }
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

      <div className="overview-tab-actions">
        <Link className="button-secondary" href={activeConfig.hubHref}>
          전체 관리 화면 →
        </Link>
        <Link className="button-primary" href={activeConfig.createHref}>
          {activeConfig.createLabel}
        </Link>
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

// Loader for tabs whose data is not already needed by the KPI groups
// (vehicles / stations / insurance). The riders + contracts tabs reuse
// the data the parent component already fetched.
async function loadOtherTabContent(
  tab: Exclude<TabKey, "riders" | "contracts">
): Promise<{ panel: ReactNode; notice: string | undefined }> {
  switch (tab) {
    case "vehicles": {
      const data = await loadVehicleList();
      return { panel: <VehiclesPanel data={data} />, notice: data.notice };
    }
    case "stations": {
      const data = await loadStationList();
      return { panel: <StationsPanel data={data} />, notice: data.notice };
    }
    case "insurance": {
      const data = await loadInsuranceList();
      return { panel: <InsurancePanel data={data} />, notice: data.notice };
    }
  }
}
