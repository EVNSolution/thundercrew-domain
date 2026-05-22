"use client";

import { useMemo, useState, type ReactNode } from "react";

import { DeleteVehicleButton } from "@/components/management/DeleteVehicleButton";
import { VEHICLE_DRAG_TYPE } from "@/components/management/ContractMatchingForm";
import { VehicleDetailDialog, type VehicleDetailRow } from "@/components/management/VehicleDetailDialog";
import { MapShell } from "@/components/dashboard/MapShell";
import type { VehicleDataResult } from "@/lib/services/vehicle-data";
import type {
  FrontendDashboardBikePin,
  FrontendVehicle,
  ServiceOpsBikeOperationStatus
} from "@/lib/services/service-ops-api";

/**
 * `/overview?tab=vehicles` 의 차량 현황 패널. EVN Logistics 차량 현황 UI 의
 * 레이아웃 / 컴포넌트 배치를 그대로 옮기고 색상만 우리 테마 토큰을 사용.
 *
 * 두 줄 필터 → 액션 버튼 row → 12컬럼 테이블 (+ 옵션 지도 분할) 구조.
 *
 * 데이터 매핑:
 * - 호기 ← FrontendVehicle.idx
 * - VIN ← FrontendVehicle.vin
 * - 플릿 ← (도메인 없음, "—" 표시 + 필터 disabled)
 * - 배치현황 ← operationStatus 매핑 (READY → 유휴, IN_SERVICE → 운영중).
 *   수리·대기중 / 미출고 는 backend 가 아직 모르므로 필터 옵션엔 있지만
 *   매칭되는 row 가 없다.
 * - 운영 구분 ← (계약 도메인 매핑 미정, "—" + 필터 disabled)
 * - 운전자 ← rider name (매칭된 라이더)
 * - SOC ← bikePin.batteryPercent (텔레메트리)
 * - 배터리 전압 ← (텔레메트리 필드 없음, "—" + 필터 disabled)
 * - 운행 상태 ← bikePin.drivingStatus (DRIVING / PARKED → 운행중 / 유휴)
 * - 차량 상태 ← bikePin.ignitionStatus + connectionStatus → 사람 친화 라벨
 *
 * 비활성 필터/액션 (다운로드, 업로드, 운행계획없음, 점검필요, 플릿 등) 은
 * UI 만 두고 "준비 중" 으로 disabled — 백엔드 / 도메인 확장 시 활성화.
 */

type DeploymentFilter = "ALL" | "OPERATING" | "IDLE" | "REPAIR" | "PRE_DEPLOY";
type FilterState = {
  query: string;
  vehicleState: "ALL" | "IDLE" | "REPAIR" | "CHARGING";
  fleet: "ALL"; // 도메인 없음, 단일 옵션
  deployment: DeploymentFilter;
  operationType: "ALL"; // 도메인 없음
  socFilter: "ALL" | "LOW";
  voltageFilter: "ALL"; // 도메인 없음
  noPlanOnly: boolean; // 데이터 없음
  needsCheckOnly: boolean; // 데이터 없음
};

type SortKey = "idx" | "plate" | "model" | "deployment" | "rider" | "soc";
type SortDir = "asc" | "desc";

const DEFAULT_FILTERS: FilterState = {
  query: "",
  vehicleState: "ALL",
  fleet: "ALL",
  deployment: "ALL",
  operationType: "ALL",
  socFilter: "ALL",
  voltageFilter: "ALL",
  noPlanOnly: false,
  needsCheckOnly: false
};

const LOW_BATTERY_THRESHOLD = 20;

export function VehiclesPanel({
  data,
  bikeActiveRiderById,
  riderInfoById,
  bikePins
}: {
  data: VehicleDataResult;
  bikeActiveRiderById?: Map<string, string>;
  riderInfoById?: Map<string, { name: string; phone: string }>;
  bikePins?: ReadonlyArray<FrontendDashboardBikePin>;
}) {
  const [activeRow, setActiveRow] = useState<VehicleDetailRow | null>(null);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [mapView, setMapView] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("idx");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const bikePinById = useMemo(() => {
    const map = new Map<string, FrontendDashboardBikePin>();
    for (const pin of bikePins ?? []) {
      map.set(pin.bikeId, pin);
    }
    return map;
  }, [bikePins]);

  const visibleVehicles = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    const filtered = data.vehicles.filter((vehicle) => {
      if (q) {
        const plateMatch = vehicle.plateNumber.toLowerCase().includes(q);
        const vinMatch = (vehicle.vin ?? "").toLowerCase().includes(q);
        if (!plateMatch && !vinMatch) return false;
      }
      const op = vehicle.operationStatus ?? statusToOperation(vehicle.status);
      // 배치현황 필터: OPERATING(=운영중) 은 IN_SERVICE, IDLE(=유휴) 는 READY.
      // REPAIR / PRE_DEPLOY 는 우리 데이터에 매칭 row 가 없어서 항상 0건.
      if (filters.deployment !== "ALL") {
        if (filters.deployment === "OPERATING" && op !== "IN_SERVICE") return false;
        if (filters.deployment === "IDLE" && op !== "READY") return false;
        if (filters.deployment === "REPAIR") return false;
        if (filters.deployment === "PRE_DEPLOY") return false;
      }
      const vehicleKey = vehicle.id ?? vehicle.slug;
      if (filters.socFilter === "LOW") {
        const pin = bikePinById.get(vehicleKey);
        if (pin?.batteryPercent === null || pin?.batteryPercent === undefined) return false;
        if (pin.batteryPercent > LOW_BATTERY_THRESHOLD) return false;
      }
      // 차량 상태(EVN: 유휴 차량 / 정비중 / 충전 필요) 우리 대응:
      // 유휴 = drivingStatus PARKED, 충전 필요 = SOC ≤ threshold,
      // 정비중 은 데이터 없음.
      if (filters.vehicleState !== "ALL") {
        const pin = bikePinById.get(vehicleKey);
        if (filters.vehicleState === "IDLE" && pin?.drivingStatus !== "PARKED") return false;
        if (filters.vehicleState === "CHARGING") {
          if (pin?.batteryPercent === null || pin?.batteryPercent === undefined) return false;
          if (pin.batteryPercent > LOW_BATTERY_THRESHOLD) return false;
        }
        if (filters.vehicleState === "REPAIR") return false;
      }
      return true;
    });
    return sortVehicles(filtered, sortKey, sortDir, bikeActiveRiderById, riderInfoById, bikePinById);
  }, [data.vehicles, filters, sortKey, sortDir, bikeActiveRiderById, riderInfoById, bikePinById]);

  const visibleBikePins = useMemo(() => {
    if (!mapView) return [];
    const visibleIds = new Set(visibleVehicles.map((v) => v.id ?? v.slug));
    return (bikePins ?? []).filter((pin) => visibleIds.has(pin.bikeId));
  }, [mapView, visibleVehicles, bikePins]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  return (
    <div className={`vehicles-panel ${mapView ? "vehicles-panel--split" : ""}`}>
      {/* 필터 행 1: 지도보기 / 검색 / 차량상태 / 플릿 / 배치현황 / 운영유형 / SOC */}
      <div className="vehicles-filter-row">
        <label className="vehicles-filter-toggle">
          <input
            type="checkbox"
            checked={mapView}
            onChange={(event) => setMapView(event.target.checked)}
          />
          <span>지도 보기</span>
        </label>
        <div className="vehicles-filter-search-wrap">
          <input
            className="vehicles-filter-search"
            type="search"
            placeholder="차량번호, VIN"
            value={filters.query}
            onChange={(event) => setFilters({ ...filters, query: event.target.value })}
          />
          <span className="vehicles-filter-search-icon" aria-hidden="true">🔍</span>
        </div>
        <select
          className="vehicles-filter-select"
          value={filters.vehicleState}
          onChange={(event) =>
            setFilters({ ...filters, vehicleState: event.target.value as FilterState["vehicleState"] })
          }
        >
          <option value="ALL">차량 상태</option>
          <option value="IDLE">유휴 차량</option>
          <option value="REPAIR" disabled>정비중 (준비중)</option>
          <option value="CHARGING">충전 필요</option>
        </select>
        <select className="vehicles-filter-select" disabled value="ALL" title="플릿(운영사) 도메인 추가 후 활성화 예정">
          <option value="ALL">플릿 (준비중)</option>
        </select>
        <select
          className="vehicles-filter-select"
          value={filters.deployment}
          onChange={(event) =>
            setFilters({ ...filters, deployment: event.target.value as DeploymentFilter })
          }
        >
          <option value="ALL">배치 현황</option>
          <option value="OPERATING">운영중</option>
          <option value="IDLE">유휴</option>
          <option value="REPAIR" disabled>수리/대기중 (준비중)</option>
          <option value="PRE_DEPLOY" disabled>미출고 (준비중)</option>
        </select>
        <select className="vehicles-filter-select" disabled value="ALL" title="운영 유형(직영/구독/판매) 매핑 추가 후 활성화">
          <option value="ALL">운영 유형 (준비중)</option>
        </select>
        <select
          className="vehicles-filter-select"
          value={filters.socFilter}
          onChange={(event) =>
            setFilters({ ...filters, socFilter: event.target.value as FilterState["socFilter"] })
          }
        >
          <option value="ALL">배터리 SOC</option>
          <option value="LOW">저전압 (≤ {LOW_BATTERY_THRESHOLD}%)</option>
        </select>
      </div>

      {/* 필터 행 2: 배터리 전압 / 운행 계획 없음 / 점검 필요 */}
      <div className="vehicles-filter-row">
        <select className="vehicles-filter-select" disabled value="ALL" title="배터리 전압 telemetry 필드 추가 후 활성화">
          <option value="ALL">배터리 전압 (준비중)</option>
        </select>
        <label className="vehicles-filter-toggle vehicles-filter-toggle--disabled" title="배송 계획 도메인 연동 후 활성화">
          <input type="checkbox" disabled checked={filters.noPlanOnly} onChange={() => {}} />
          <span>운행 계획 없음 (준비중)</span>
        </label>
        <label className="vehicles-filter-toggle vehicles-filter-toggle--disabled" title="단말기 진단 코드 도메인 연동 후 활성화">
          <input type="checkbox" disabled checked={filters.needsCheckOnly} onChange={() => {}} />
          <span>에러코드 또는 단말기 점검 필요 (준비중)</span>
        </label>
        <span className="vehicles-filter-count">
          {visibleVehicles.length} / {data.vehicles.length}
        </span>
      </div>

      {/* 액션 버튼 row */}
      <div className="vehicles-action-row">
        <button type="button" className="vehicles-action-button" disabled title="CSV / XLSX 추출 API 추가 후 활성화">
          다운로드
        </button>
        <button type="button" className="vehicles-action-button" disabled title="Bulk import API 추가 후 활성화">
          업로드
        </button>
        {/* "새 차량 추가" 는 page tab-action 영역에 이미 마운트되어 있음 — 중복
            방지를 위해 여기서는 안내 텍스트만. 위치 통일이 필요하면 다음
            iteration 에서 page.tsx 의 tab-action 을 비우고 여기로 이동. */}
        <span className="vehicles-action-hint">새 차량 추가 ↗ 우측 상단</span>
      </div>

      <div className="vehicles-panel-body">
        <div className="table-card vehicles-table-scroll">
          <table className="table vehicles-table">
            <thead>
              <tr>
                <SortableHeader label="호기" sortKey="idx" current={sortKey} dir={sortDir} onSort={handleSort} />
                <SortableHeader label="차량번호" sortKey="plate" current={sortKey} dir={sortDir} onSort={handleSort} />
                <th>VIN</th>
                <SortableHeader label="모델" sortKey="model" current={sortKey} dir={sortDir} onSort={handleSort} />
                <th>플릿</th>
                <SortableHeader label="배치현황" sortKey="deployment" current={sortKey} dir={sortDir} onSort={handleSort} />
                <th>운영 구분</th>
                <SortableHeader label="운전자" sortKey="rider" current={sortKey} dir={sortDir} onSort={handleSort} />
                <SortableHeader label="SOC" sortKey="soc" current={sortKey} dir={sortDir} onSort={handleSort} />
                <th>배터리 전압</th>
                <th>운행 상태</th>
                <th>차량 상태</th>
                <th style={{ textAlign: "right" }}>작업</th>
              </tr>
            </thead>
            <tbody>
              {visibleVehicles.length === 0 ? (
                <tr>
                  <td colSpan={13} className="table-empty-cell">
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
                    <td className="vehicles-cell-mono">{vehicle.idx ?? "—"}</td>
                    <td>{vehicle.plateNumber}</td>
                    <td className="vehicles-cell-mono">{vehicle.vin || <span className="muted">—</span>}</td>
                    <td>{vehicle.model || <span className="muted">—</span>}</td>
                    <td><span className="muted">—</span></td>
                    <td>{renderDeploymentBadge(op)}</td>
                    <td><span className="muted">—</span></td>
                    <td>{riderInfo ? riderInfo.name : <span className="muted">미배정</span>}</td>
                    <td>{renderSoc(pin?.batteryPercent)}</td>
                    <td><span className="muted">—</span></td>
                    <td>{renderDrivingBadge(pin?.drivingStatus)}</td>
                    <td>{renderIgnitionState(pin)}</td>
                    <td
                      style={{ textAlign: "right" }}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <DeleteVehicleButton vehicleId={vehicleKey} plateNumber={vehicle.plateNumber} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {mapView ? (
          <div className="vehicles-panel-map">
            <MapShell bikePins={visibleBikePins} />
          </div>
        ) : null}
      </div>

      <VehicleDetailDialog
        key={activeRow ? (activeRow.vehicle.id ?? activeRow.vehicle.slug) : "none"}
        row={activeRow}
        onClose={() => setActiveRow(null)}
      />
    </div>
  );
}

function SortableHeader({
  label,
  sortKey,
  current,
  dir,
  onSort
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  const isActive = current === sortKey;
  const arrow = !isActive ? "↕" : dir === "asc" ? "↑" : "↓";
  return (
    <th>
      <button
        type="button"
        className={`vehicles-sort-button${isActive ? " is-active" : ""}`}
        onClick={() => onSort(sortKey)}
      >
        {label}
        <span className="vehicles-sort-arrow" aria-hidden="true">{arrow}</span>
      </button>
    </th>
  );
}

function renderDeploymentBadge(op: ServiceOpsBikeOperationStatus): ReactNode {
  const isOperating = op === "IN_SERVICE";
  return (
    <span className={`vehicles-pill vehicles-pill--${isOperating ? "operating" : "idle"}`}>
      {isOperating ? "운영중" : "유휴"}
    </span>
  );
}

function renderDrivingBadge(drivingStatus: string | undefined): ReactNode {
  if (!drivingStatus) return <span className="muted">—</span>;
  if (drivingStatus === "DRIVING") {
    return <span className="vehicles-pill vehicles-pill--driving">운행중</span>;
  }
  return <span className="vehicles-pill vehicles-pill--idle">유휴</span>;
}

function renderIgnitionState(pin: FrontendDashboardBikePin | undefined): ReactNode {
  if (!pin) return <span className="vehicles-pill vehicles-pill--unknown">상태없음 (No Status)</span>;
  if (pin.ignitionStatus === "ON") {
    return <span className="vehicles-pill vehicles-pill--ignition-on">ON (시동이 켜진 상태)</span>;
  }
  if (pin.ignitionStatus === "OFF") {
    return <span className="vehicles-pill vehicles-pill--ignition-off">OFF (시동이 꺼진 상태)</span>;
  }
  return <span className="vehicles-pill vehicles-pill--unknown">상태없음 (No Status)</span>;
}

function renderSoc(percent: number | null | undefined): ReactNode {
  if (percent === null || percent === undefined) return <span className="muted">—</span>;
  const tone = percent <= LOW_BATTERY_THRESHOLD ? "low" : percent <= 50 ? "mid" : "high";
  return (
    <span className={`vehicles-soc vehicles-soc--${tone}`}>
      {percent.toFixed(0)}%
    </span>
  );
}

function statusToOperation(status: FrontendVehicle["status"]): ServiceOpsBikeOperationStatus {
  return status === "운행" ? "IN_SERVICE" : "READY";
}

function sortVehicles(
  vehicles: FrontendVehicle[],
  key: SortKey,
  dir: SortDir,
  bikeActiveRiderById: Map<string, string> | undefined,
  riderInfoById: Map<string, { name: string; phone: string }> | undefined,
  bikePinById: Map<string, FrontendDashboardBikePin>
): FrontendVehicle[] {
  const sign = dir === "asc" ? 1 : -1;
  const lookupRider = (v: FrontendVehicle): string | null => {
    const riderId = bikeActiveRiderById?.get(v.id ?? v.slug) ?? null;
    return riderId ? riderInfoById?.get(riderId)?.name ?? null : null;
  };
  const lookupSoc = (v: FrontendVehicle): number => {
    const pin = bikePinById.get(v.id ?? v.slug);
    return pin?.batteryPercent ?? -1;
  };
  return [...vehicles].sort((a, b) => {
    switch (key) {
      case "idx":
        return ((a.idx ?? Number.MAX_SAFE_INTEGER) - (b.idx ?? Number.MAX_SAFE_INTEGER)) * sign;
      case "plate":
        return a.plateNumber.localeCompare(b.plateNumber) * sign;
      case "model":
        return a.model.localeCompare(b.model) * sign;
      case "deployment":
        return (a.status === b.status ? 0 : a.status === "운행" ? -1 : 1) * sign;
      case "rider": {
        const an = lookupRider(a) ?? "";
        const bn = lookupRider(b) ?? "";
        if (!an && !bn) return 0;
        if (!an) return 1;
        if (!bn) return -1;
        return an.localeCompare(bn) * sign;
      }
      case "soc":
        return (lookupSoc(a) - lookupSoc(b)) * sign;
    }
  });
}

export type { ReactNode };
