import Link from "next/link";

import { PageHeader } from "@/components/layout/PageHeader";
import { loadDashboardMapState } from "@/lib/services/dashboard-map-state-data";

// Authenticated, per-admin loader. At build time the env-less mock fallback
// returns synchronously without touching cookies, which lets Next.js
// statically prerender the page. In production that would freeze the
// output across all admins, so we opt in to dynamic rendering explicitly.
export const dynamic = "force-dynamic";

const HUB_CARDS = [
  {
    href: "/riders",
    icon: "👤",
    title: "라이더",
    description: "라이더 등록·수정, 교육 기록, 보험 가입 이력"
  },
  {
    href: "/vehicles",
    icon: "🛵",
    title: "차량",
    description: "차량 등록·수정, 운영 상태 변경, 디바이스 매핑"
  },
  {
    href: "/stations",
    icon: "🔋",
    title: "스테이션",
    description: "충전소 등록·수정, 배터리 재고 카운트"
  },
  {
    href: "/contracts",
    icon: "📄",
    title: "계약",
    description: "라이더-차량 계약, 계약 템플릿"
  },
  {
    href: "/insurance",
    icon: "🛡",
    title: "보험",
    description: "라이더 보험 가입·관리, 보험 항목 마스터"
  }
] as const;

const numberFormatter = new Intl.NumberFormat("ko-KR");

function formatCount(value: number): string {
  return numberFormatter.format(value);
}

export default async function OverviewPage() {
  const state = await loadDashboardMapState();
  const summary = state.data.summary;

  return (
    <div className="page-container">
      <PageHeader
        title="Overview"
        description="실시간 운영 지표와 도메인 관리 화면으로 진입할 수 있습니다."
      />

      {state.notice ? (
        <p className="notice" role="status">
          {state.notice}
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
      <div className="overview-hub-grid">
        {HUB_CARDS.map((hub) => (
          <Link key={hub.href} href={hub.href} className="overview-hub-card">
            <span className="overview-hub-card-icon" aria-hidden="true">
              {hub.icon}
            </span>
            <p className="overview-hub-card-title">{hub.title}</p>
            <p className="overview-hub-card-description">{hub.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
