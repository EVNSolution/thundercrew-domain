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
  rentalRiderCount,
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
