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

async function loadActiveTabContent(tab: TabKey): Promise<{ panel: ReactNode; notice: string | undefined }> {
  switch (tab) {
    case "riders": {
      const data = await loadRiderList();
      return { panel: <RidersPanel data={data} />, notice: data.notice };
    }
    case "vehicles": {
      const data = await loadVehicleList();
      return { panel: <VehiclesPanel data={data} />, notice: data.notice };
    }
    case "stations": {
      const data = await loadStationList();
      return { panel: <StationsPanel data={data} />, notice: data.notice };
    }
    case "contracts": {
      const data = await loadContractList();
      return { panel: <ContractsPanel data={data} />, notice: data.notice };
    }
    case "insurance": {
      const data = await loadInsuranceList();
      return { panel: <InsurancePanel data={data} />, notice: data.notice };
    }
  }
}

export default async function OverviewPage({
  searchParams
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ tab: tabParam }, mapState] = await Promise.all([searchParams, loadDashboardMapState()]);
  const activeTab: TabKey = isValidTabKey(tabParam) ? tabParam : "riders";
  const activeConfig = TABS.find((tab) => tab.key === activeTab) ?? TABS[0];
  const summary = mapState.data.summary;
  const activeContent = await loadActiveTabContent(activeTab);

  return (
    <div className="page-container">
      {mapState.notice ? (
        <p className="notice" role="status">
          {mapState.notice}
        </p>
      ) : null}

      <h2 className="overview-section-heading">차량 현황</h2>
      <div className="overview-metric-grid">
        <article className="metric-card">
          <p className="metric-label">전체 차량</p>
          <p className="metric-value">{formatCount(summary.totalBikes)}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">운행 중</p>
          <p className="metric-value">{formatCount(summary.onlineBikeCount)}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">신호 끊김</p>
          <p className="metric-value">{formatCount(summary.signalLostBikeCount)}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">주차 오프라인</p>
          <p className="metric-value">{formatCount(summary.parkedOfflineBikeCount)}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">저전압</p>
          <p className="metric-value">{formatCount(summary.lowBatteryBikeCount)}</p>
        </article>
      </div>

      <h2 className="overview-section-heading">충전소 현황</h2>
      <div className="overview-metric-grid">
        <article className="metric-card">
          <p className="metric-label">활성 스테이션</p>
          <p className="metric-value">{formatCount(summary.activeStationCount)}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">가용 배터리</p>
          <p className="metric-value">{formatCount(summary.availableBatteryCount)}</p>
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
