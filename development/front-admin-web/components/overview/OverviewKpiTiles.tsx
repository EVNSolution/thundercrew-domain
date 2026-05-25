"use client";

import { useMemo } from "react";

import { useFleetSimulation } from "@/components/overview/FleetSimulationContext";

/**
 * 페이지 상단의 두 KPI 카드 (차량 현황 / 라이더 현황).
 *
 * SSR baseline 값을 props 로 받고, 시뮬레이션 중인 IMEI=-1 차량의
 * ignitionStatus 를 client-side 에서 overlay 한다.
 *
 * IMEI=-1 차량은 실제 DB 차량이라 totalBikes / totalRiders 는 SSR 값 그대로.
 * 단, 실제 텔레메트리가 없어 ignitionStatus 는 항상 OFF — EN_ROUTE 시뮬레이션
 * 중인 차량만 클라이언트에서 ON 으로 카운트해 더한다.
 */
export interface OverviewKpiTilesProps {
  totalBikes: number;
  ignitionOnCount: number;
  insuredVehicleCount: number;
  totalRiders: number;
  subscriptionRiderCount: number;
  rentalRiderCount: number;
}

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
  const { simulated } = useFleetSimulation();

  // 시뮬레이션 중 EN_ROUTE(ignition ON) 차량 카운트.
  // IMEI=-1 차량의 DB ignitionStatus 는 항상 OFF 이라 이중 카운트 없음.
  const simulatedIgnitionOn = useMemo(() => {
    let n = 0;
    for (const state of simulated.values()) {
      if (state.ignitionStatus === "ON") n++;
    }
    return n;
  }, [simulated]);

  const ignitionOnEffective = ignitionOnCount + simulatedIgnitionOn;

  return (
    <div className="overview-kpi-groups">
      <article className="kpi-group">
        <h3 className="kpi-group-heading">차량 현황</h3>
        <div className="kpi-group-metrics">
          <div>
            <p className="metric-label">전체 차량</p>
            <p className="metric-value">{formatCount(totalBikes)}</p>
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
            <p className="metric-value">{formatCount(totalRiders)}</p>
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
