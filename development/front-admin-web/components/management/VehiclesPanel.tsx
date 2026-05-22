"use client";

import { useMemo, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/Badge";
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
 * `/overview?tab=vehicles` 의 차량 현황 패널. EVN Logistics 의 차량 현황
 * 페이지를 참고해 정리한 구조 — UI/UX 만 차용하고 도메인 모델은 우리 것
 * 그대로 사용:
 *
 * - 필터 바: 검색 (plate / VIN), 운영 상태, 라이더 배정, 저전압
 * - 컬럼: 호기(idx) / 차량번호 / VIN / 모델 / 운영 상태 / 라이더 / SOC / 작업
 * - 헤더 정렬 가능 (호기 / 차량번호 / 모델 / 운영상태 / 라이더명 / SOC)
 * - 지도 보기 토글: ON 이면 좌 리스트 / 우 지도 의 50:50 분할 — 우리 기존
 *   MapShell 을 그대로 임베드해서 monitoring 페이지와 같은 마커 시각화 사용
 *
 * 필드 매핑:
 * - 호기 = FrontendVehicle.idx (DB 의 bigserial idx)
 * - VIN = FrontendVehicle.vin
 * - SOC = bikePin.batteryPercent (텔레메트리 — 없으면 "—")
 * - 운영상태 = FrontendVehicle.status (운행 / 대기) — badge 로 표시
 */

type FilterState = {
  query: string;
  operationStatus: "ALL" | "READY" | "IN_SERVICE";
  riderAssignment: "ALL" | "ASSIGNED" | "UNASSIGNED";
  lowBatteryOnly: boolean;
};

type SortKey = "idx" | "plate" | "model" | "status" | "rider" | "soc";
type SortDir = "asc" | "desc";

const DEFAULT_FILTERS: FilterState = {
  query: "",
  operationStatus: "ALL",
  riderAssignment: "ALL",
  lowBatteryOnly: false
};

const LOW_BATTERY_THRESHOLD = 20;

const STATUS_LABEL: Record<ServiceOpsBikeOperationStatus, string> = {
  READY: "대기",
  IN_SERVICE: "운행"
};

export function VehiclesPanel({
  data,
  bikeActiveRiderById,
  riderInfoById,
  bikePins
}: {
  data: VehicleDataResult;
  bikeActiveRiderById?: Map<string, string>;
  riderInfoById?: Map<string, { name: string; phone: string }>;
  /** 지도 보기 + SOC 컬럼 채우는데 쓰는 텔레메트리 핀. dashboard map-state 의 bikePins 그대로. */
  bikePins?: ReadonlyArray<FrontendDashboardBikePin>;
}) {
  const [activeRow, setActiveRow] = useState<VehicleDetailRow | null>(null);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [mapView, setMapView] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("idx");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // bikeId → 텔레메트리 핀. SOC 노출 + 저전압 필터 + 지도 마커 필터링에 사용.
  const bikePinById = useMemo(() => {
    const map = new Map<string, FrontendDashboardBikePin>();
    for (const pin of bikePins ?? []) {
      map.set(pin.bikeId, pin);
    }
    return map;
  }, [bikePins]);

  // filter + sort 를 한 번에 통과시킨 결과. 표 / 지도 둘 다 같은 집합 사용.
  const visibleVehicles = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    const filtered = data.vehicles.filter((vehicle) => {
      // 검색: plate / VIN substring
      if (q) {
        const plateMatch = vehicle.plateNumber.toLowerCase().includes(q);
        const vinMatch = (vehicle.vin ?? "").toLowerCase().includes(q);
        if (!plateMatch && !vinMatch) return false;
      }
      // 운영 상태
      if (filters.operationStatus !== "ALL") {
        const op = vehicle.operationStatus ?? statusToOperation(vehicle.status);
        if (op !== filters.operationStatus) return false;
      }
      // 라이더 배정
      if (filters.riderAssignment !== "ALL") {
        const vehicleKey = vehicle.id ?? vehicle.slug;
        const hasRider = Boolean(bikeActiveRiderById?.get(vehicleKey));
        if (filters.riderAssignment === "ASSIGNED" && !hasRider) return false;
        if (filters.riderAssignment === "UNASSIGNED" && hasRider) return false;
      }
      // 저전압: 텔레메트리가 있고 batteryPercent ≤ 20 인 차량만
      if (filters.lowBatteryOnly) {
        const vehicleKey = vehicle.id ?? vehicle.slug;
        const pin = bikePinById.get(vehicleKey);
        if (pin?.batteryPercent === null || pin?.batteryPercent === undefined) return false;
        if (pin.batteryPercent > LOW_BATTERY_THRESHOLD) return false;
      }
      return true;
    });
    return sortVehicles(filtered, sortKey, sortDir, bikeActiveRiderById, riderInfoById, bikePinById);
  }, [data.vehicles, filters, sortKey, sortDir, bikeActiveRiderById, riderInfoById, bikePinById]);

  // 지도 보기에 넘길 마커 — 화면에 보이는 차량만 마커로. mapState 의 핀 중에서
  // 매칭되는 것만 골라서 MapShell 의 입력으로.
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
      <div className="vehicles-filter-bar">
        <label className="vehicles-filter-toggle">
          <input
            type="checkbox"
            checked={mapView}
            onChange={(event) => setMapView(event.target.checked)}
          />
          <span>지도 보기</span>
        </label>
        <input
          className="vehicles-filter-search"
          type="search"
          placeholder="차량번호 또는 VIN 검색"
          value={filters.query}
          onChange={(event) => setFilters({ ...filters, query: event.target.value })}
        />
        <select
          className="vehicles-filter-select"
          value={filters.operationStatus}
          onChange={(event) =>
            setFilters({ ...filters, operationStatus: event.target.value as FilterState["operationStatus"] })
          }
        >
          <option value="ALL">운영 상태: 전체</option>
          <option value="IN_SERVICE">운영중</option>
          <option value="READY">대기</option>
        </select>
        <select
          className="vehicles-filter-select"
          value={filters.riderAssignment}
          onChange={(event) =>
            setFilters({ ...filters, riderAssignment: event.target.value as FilterState["riderAssignment"] })
          }
        >
          <option value="ALL">라이더: 전체</option>
          <option value="ASSIGNED">배정됨</option>
          <option value="UNASSIGNED">미배정</option>
        </select>
        <label className="vehicles-filter-toggle">
          <input
            type="checkbox"
            checked={filters.lowBatteryOnly}
            onChange={(event) => setFilters({ ...filters, lowBatteryOnly: event.target.checked })}
          />
          <span>저전압만 (≤ {LOW_BATTERY_THRESHOLD}%)</span>
        </label>
        <span className="vehicles-filter-count">
          {visibleVehicles.length} / {data.vehicles.length}
        </span>
      </div>

      <div className="vehicles-panel-body">
        <div className="table-card">
          <table className="table" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "60px" }} />
              <col />
              <col />
              <col />
              <col style={{ width: "92px" }} />
              <col />
              <col style={{ width: "80px" }} />
              <col style={{ width: "72px" }} />
            </colgroup>
            <thead>
              <tr>
                <SortableHeader label="호기" sortKey="idx" current={sortKey} dir={sortDir} onSort={handleSort} />
                <SortableHeader label="차량번호" sortKey="plate" current={sortKey} dir={sortDir} onSort={handleSort} />
                <th>VIN</th>
                <SortableHeader label="모델" sortKey="model" current={sortKey} dir={sortDir} onSort={handleSort} />
                <SortableHeader label="운영 상태" sortKey="status" current={sortKey} dir={sortDir} onSort={handleSort} />
                <SortableHeader label="라이더" sortKey="rider" current={sortKey} dir={sortDir} onSort={handleSort} />
                <SortableHeader label="SOC" sortKey="soc" current={sortKey} dir={sortDir} onSort={handleSort} />
                <th style={{ textAlign: "right" }}>작업</th>
              </tr>
            </thead>
            <tbody>
              {visibleVehicles.length === 0 ? (
                <tr>
                  <td colSpan={8} className="table-empty-cell">
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
                    <td>{vehicle.model}</td>
                    <td>{renderOperationBadge(op)}</td>
                    <td>{riderInfo ? riderInfo.name : <span className="muted">미배정</span>}</td>
                    <td>{renderSoc(pin?.batteryPercent)}</td>
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

function renderOperationBadge(op: ServiceOpsBikeOperationStatus): ReactNode {
  if (op === "IN_SERVICE") return <Badge tone="active">{STATUS_LABEL[op]}</Badge>;
  return <Badge tone="muted">{STATUS_LABEL[op]}</Badge>;
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
    // 텔레메트리 없는 차량은 정렬상 최하단(asc) / 최상단(desc) 어디로 갈지
    // 통일성 위해 큰 음수로 두어 asc 시 맨 위로 — "값 없음" 이 운영자에게는
    // 잘 보여야 처치가 가능하니까.
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
      case "status":
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
