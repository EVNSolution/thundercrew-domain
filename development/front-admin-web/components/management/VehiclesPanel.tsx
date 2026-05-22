"use client";

import { useMemo, useState, type ReactNode } from "react";

import { VEHICLE_DRAG_TYPE } from "@/components/management/ContractMatchingForm";
import { VehicleDetailDialog, type VehicleDetailRow } from "@/components/management/VehicleDetailDialog";
import type { VehicleDataResult } from "@/lib/services/vehicle-data";
import type {
  FrontendDashboardBikePin,
  FrontendVehicle,
  ServiceOpsBikeOperationStatus
} from "@/lib/services/service-ops-api";

/**
 * `/?tab=vehicles` 의 차량 현황 패널. 운영자가 한 화면에서 차량 +
 * 라이더 + 텔레메트리 + 단말기 정보를 한꺼번에 훑을 수 있도록 10개 컬럼만
 * 남긴 단순 구조.
 *
 * 컬럼:
 *   차량번호 / 모델 / 운영 상태 / 이름 / 연락처 / IMEI / 연결 상태 / 시동 / 속도 / 잔량
 *
 * 데이터 매핑:
 * - 차량번호 / 모델 / 운영 상태 ← FrontendVehicle (이 패널 데이터)
 * - 이름 / 연락처 ← bikeActiveRiderById → riderInfoById 두 단계 lookup
 * - IMEI ← deviceUidByBikeId (페이지 진입 시 batch-load)
 * - 연결 상태 / 시동 / 속도 / 잔량 ← bikePinById (텔레메트리 핀)
 *
 * 지도 보기 토글은 페이지 최상단의 글로벌 토글로 이동했으므로 이 패널에서는
 * 다루지 않는다. 필터는 차량번호/모델/IMEI 검색 한 줄만.
 */

type FilterState = {
  query: string;
  operationStatus: "ALL" | "READY" | "IN_SERVICE";
};

const DEFAULT_FILTERS: FilterState = {
  query: "",
  operationStatus: "ALL"
};

const STATUS_LABEL: Record<ServiceOpsBikeOperationStatus, string> = {
  READY: "대기",
  IN_SERVICE: "운행"
};

const LOW_BATTERY_THRESHOLD = 20;

export function VehiclesPanel({
  data,
  bikeActiveRiderById,
  riderInfoById,
  bikePins,
  deviceUidByBikeId
}: {
  data: VehicleDataResult;
  bikeActiveRiderById?: Map<string, string>;
  riderInfoById?: Map<string, { name: string; phone: string }>;
  /** 텔레메트리 핀 — 연결 상태 / 시동 / 속도 / 잔량 컬럼이 참조. */
  bikePins?: ReadonlyArray<FrontendDashboardBikePin>;
  /** 차량 → 부착된 단말기 IMEI 사전. 루트 페이지가 batch loader 로 받아서 내려준다. */
  deviceUidByBikeId?: Map<string, string>;
}) {
  const [activeRow, setActiveRow] = useState<VehicleDetailRow | null>(null);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  // bikeId → 텔레메트리 핀 1:1 인덱스. 표 렌더링이 매 행마다 lookup 1회.
  const bikePinById = useMemo(() => {
    const map = new Map<string, FrontendDashboardBikePin>();
    for (const pin of bikePins ?? []) {
      map.set(pin.bikeId, pin);
    }
    return map;
  }, [bikePins]);

  const visibleVehicles = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    return data.vehicles.filter((vehicle) => {
      const vehicleKey = vehicle.id ?? vehicle.slug;
      if (q) {
        const plateMatch = vehicle.plateNumber.toLowerCase().includes(q);
        const modelMatch = (vehicle.model ?? "").toLowerCase().includes(q);
        const imei = deviceUidByBikeId?.get(vehicleKey) ?? "";
        const imeiMatch = imei.toLowerCase().includes(q);
        if (!plateMatch && !modelMatch && !imeiMatch) return false;
      }
      if (filters.operationStatus !== "ALL") {
        const op = vehicle.operationStatus ?? statusToOperation(vehicle.status);
        if (op !== filters.operationStatus) return false;
      }
      return true;
    });
  }, [data.vehicles, filters, deviceUidByBikeId]);

  return (
    <div className="vehicles-panel">
      <div className="vehicles-filter-row">
        <div className="vehicles-filter-search-wrap">
          <input
            className="vehicles-filter-search"
            type="search"
            placeholder="차량번호, 모델, IMEI 검색"
            value={filters.query}
            onChange={(event) => setFilters({ ...filters, query: event.target.value })}
          />
          <span className="vehicles-filter-search-icon" aria-hidden="true">🔍</span>
        </div>
        <select
          className="vehicles-filter-select"
          value={filters.operationStatus}
          onChange={(event) =>
            setFilters({ ...filters, operationStatus: event.target.value as FilterState["operationStatus"] })
          }
        >
          <option value="ALL">운영 상태: 전체</option>
          <option value="IN_SERVICE">운행</option>
          <option value="READY">대기</option>
        </select>
        <span className="vehicles-filter-count">
          {visibleVehicles.length} / {data.vehicles.length}
        </span>
      </div>

      <div className="table-card vehicles-table-scroll">
        <table className="table vehicles-table">
          <thead>
            <tr>
              <th>차량번호</th>
              <th>모델</th>
              <th>운영 상태</th>
              <th>이름</th>
              <th>연락처</th>
              <th>IMEI</th>
              <th>연결 상태</th>
              <th>시동</th>
              <th>속도</th>
              <th>잔량</th>
            </tr>
          </thead>
          <tbody>
            {visibleVehicles.length === 0 ? (
              <tr>
                <td colSpan={10} className="table-empty-cell">
                  조건에 맞는 차량 없음
                </td>
              </tr>
            ) : null}
            {visibleVehicles.map((vehicle) => {
              const vehicleKey = vehicle.id ?? vehicle.slug;
              const activeRiderId = bikeActiveRiderById?.get(vehicleKey) ?? null;
              const riderInfo = activeRiderId ? riderInfoById?.get(activeRiderId) ?? null : null;
              const pin = bikePinById.get(vehicleKey);
              const op = vehicle.operationStatus ?? statusToOperation(vehicle.status);
              const imei = deviceUidByBikeId?.get(vehicleKey) ?? null;
              return (
                <tr
                  key={vehicle.slug}
                  className="table-row-clickable"
                  draggable={Boolean(vehicle.id)}
                  onDragStart={(event) => {
                    if (!vehicle.id) return;
                    event.dataTransfer.setData(VEHICLE_DRAG_TYPE, vehicle.id);
                    event.dataTransfer.effectAllowed = "copy";
                  }}
                  onClick={() =>
                    setActiveRow({
                      vehicle,
                      riderName: riderInfo?.name ?? null,
                      riderPhone: riderInfo?.phone ?? null
                    })
                  }
                >
                  <td>{vehicle.plateNumber}</td>
                  <td>{vehicle.model || <span className="muted">—</span>}</td>
                  <td>{renderOperationBadge(op)}</td>
                  <td>{riderInfo ? riderInfo.name : <span className="muted">미배정</span>}</td>
                  <td>{riderInfo ? riderInfo.phone : <span className="muted">—</span>}</td>
                  <td className="vehicles-cell-mono">{imei || <span className="muted">—</span>}</td>
                  <td>{renderConnection(pin?.connectionStatus)}</td>
                  <td>{renderIgnition(pin?.ignitionStatus)}</td>
                  <td>{renderSpeed(pin?.speedKph)}</td>
                  <td>{renderBattery(pin?.batteryPercent)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <VehicleDetailDialog
        key={activeRow ? (activeRow.vehicle.id ?? activeRow.vehicle.slug) : "none"}
        row={activeRow}
        onClose={() => setActiveRow(null)}
      />
    </div>
  );
}

function statusToOperation(status: FrontendVehicle["status"]): ServiceOpsBikeOperationStatus {
  return status === "운행" ? "IN_SERVICE" : "READY";
}

function renderOperationBadge(op: ServiceOpsBikeOperationStatus): ReactNode {
  const isOperating = op === "IN_SERVICE";
  return (
    <span className={`vehicles-pill vehicles-pill--${isOperating ? "operating" : "idle"}`}>
      {STATUS_LABEL[op]}
    </span>
  );
}

// 연결 상태: telemetry 의 connectionStatus 그대로 사람 친화 라벨로. 핀이 없는
// 차량(텔레메트리 한 번도 못 받음) 은 "—" — 단말기를 부착하지 않은 경우와
// 단말기는 있는데 통신 끊긴 경우 둘 다 핀이 없을 수 있어 한 톤으로 표시.
function renderConnection(status: string | undefined): ReactNode {
  if (!status) return <span className="muted">—</span>;
  if (status === "ONLINE") {
    return <span className="vehicles-pill vehicles-pill--operating">온라인</span>;
  }
  if (status === "SIGNAL_LOST") {
    return <span className="vehicles-pill vehicles-pill--unknown">신호 끊김</span>;
  }
  // 그 외(OFFLINE / PARKED_OFFLINE 등) 는 회색 톤으로 통일.
  return <span className="vehicles-pill vehicles-pill--idle">오프라인</span>;
}

function renderIgnition(status: string | undefined): ReactNode {
  if (status === "ON") return <span className="vehicles-pill vehicles-pill--ignition-on">ON</span>;
  if (status === "OFF") return <span className="vehicles-pill vehicles-pill--ignition-off">OFF</span>;
  return <span className="muted">—</span>;
}

function renderSpeed(speedKph: number | null | undefined): ReactNode {
  if (speedKph === null || speedKph === undefined) return <span className="muted">—</span>;
  return <span className="vehicles-cell-mono">{Math.round(speedKph)} km/h</span>;
}

function renderBattery(percent: number | null | undefined): ReactNode {
  if (percent === null || percent === undefined) return <span className="muted">—</span>;
  const tone = percent <= LOW_BATTERY_THRESHOLD ? "low" : percent <= 50 ? "mid" : "high";
  return (
    <span className={`vehicles-soc vehicles-soc--${tone}`}>
      {percent.toFixed(0)}%
    </span>
  );
}
