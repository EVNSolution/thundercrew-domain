"use client";

import { useMemo, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/Badge";
import { DeleteVehicleButton } from "@/components/management/DeleteVehicleButton";
import { IgnitionControlButton } from "@/components/management/IgnitionControlButton";
import { OperationStatusToggle } from "@/components/management/OperationStatusToggle";
import { VEHICLE_DRAG_TYPE } from "@/components/management/ContractMatchingForm";
import { VehicleDetailDialog, type VehicleDetailRow } from "@/components/management/VehicleDetailDialog";
import type { VehicleDataResult } from "@/lib/services/vehicle-data";
import type { RiderActiveContractSummary } from "@/lib/services/rider-matching-snapshot-data";
import type {
  FrontendDashboardBikePin,
  FrontendVehicle,
  ServiceOpsBikeOperationStatus
} from "@/lib/services/service-ops-api";

/**
 * `/?tab=vehicles` 의 차량 현황 패널. 한 행에서 차량 자체 + 매칭된 라이더 +
 * 라이더의 계약·보험·교육 + 텔레메트리 + 단말기 + 시동 제어까지 한 번에
 * 훑을 수 있도록 라이더 탭과 동일한 라이더-측 컬럼들을 함께 노출한다.
 *
 * 컬럼 (총 16):
 *   차량번호 / 구분 / 운영 상태 / 이름 / 연락처 / 교육 / 구독·렌탈 / 형태 /
 *   기간 / 보험 / IMEI / 연결 상태 / 시동 상태 / 시동 제어 / 속도 / 잔량
 *
 * 데이터 매핑:
 * - 차량번호 / 구분(engineType) / 운영 상태 ← FrontendVehicle (이 패널 데이터)
 * - 이름 / 연락처 ← bikeActiveRiderById → riderInfoById 두 단계 lookup
 * - 교육 / 구독·렌탈 / 형태 / 기간 / 보험 ← bikeActiveRiderById 로 riderId 를
 *   먼저 찾고, 라이더 탭과 동일한 4 종 map (educationTypeByRiderId,
 *   riderActiveContractById, insuredRiderIds) 으로 lookup
 * - IMEI ← deviceUidByBikeId (페이지 진입 시 batch-load)
 * - 연결 상태 / 시동 상태 / 속도 / 잔량 ← bikePinById (텔레메트리 핀)
 * - 시동 제어 ← ignitionBlockedByBikeId + IgnitionControlButton (라이더 탭과
 *   같은 컴포넌트 재사용)
 *
 * 행 클릭은 차량 상세 다이얼로그 — 라이더 정보는 단순 조회용이고 편집은
 * 라이더 탭에서 처리하도록 책임 분리. 시동 제어 토글만 행 안에서 직접 동작.
 *
 * 지도 보기 토글은 페이지 최상단의 글로벌 토글로 이동했으므로 이 패널에서는
 * 다루지 않는다. 필터는 차량번호/모델명/IMEI 검색 한 줄만.
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
  deviceUidByBikeId,
  insuredRiderIds,
  educationTypeByRiderId,
  riderActiveContractById,
  ignitionBlockedByBikeId
}: {
  data: VehicleDataResult;
  bikeActiveRiderById?: Map<string, string>;
  riderInfoById?: Map<string, { name: string; phone: string }>;
  /** 텔레메트리 핀 — 연결 상태 / 시동 / 속도 / 잔량 컬럼이 참조. */
  bikePins?: ReadonlyArray<FrontendDashboardBikePin>;
  /** 차량 → 부착된 단말기 IMEI 사전. 루트 페이지가 batch loader 로 받아서 내려준다. */
  deviceUidByBikeId?: Map<string, string>;
  /** 활성 보험 보유 라이더 id set — 매칭된 라이더가 보험에 가입돼 있는지 판단. */
  insuredRiderIds?: Set<string>;
  /** riderId → ONLINE/OFFLINE 교육 type. */
  educationTypeByRiderId?: Map<string, "ONLINE" | "OFFLINE">;
  /** riderId → 활성 매칭의 계약 요약(category / returnType / durationLabel). */
  riderActiveContractById?: Map<string, RiderActiveContractSummary>;
  /** bikeId → 시동 방지 토글 현재 상태. 시동 제어 인라인 토글의 초기값. */
  ignitionBlockedByBikeId?: Map<string, boolean>;
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
            placeholder="차량번호, 모델명, IMEI 검색"
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
              <th aria-label="삭제" />
              <th>차량번호</th>
              <th>구분</th>
              <th>운영 상태</th>
              <th>이름</th>
              <th>연락처</th>
              <th>교육</th>
              <th>구독/렌탈</th>
              <th>형태</th>
              <th>기간</th>
              <th>보험</th>
              <th>IMEI</th>
              <th>연결 상태</th>
              <th>시동 상태</th>
              <th>시동 제어</th>
              <th>속도</th>
              <th>잔량</th>
            </tr>
          </thead>
          <tbody>
            {visibleVehicles.length === 0 ? (
              <tr>
                <td colSpan={17} className="table-empty-cell">
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
              // 라이더-측 lookup. 매칭이 없으면 모두 null → "—" 폴백.
              const educationType = activeRiderId ? educationTypeByRiderId?.get(activeRiderId) ?? null : null;
              const contract = activeRiderId ? riderActiveContractById?.get(activeRiderId) ?? null : null;
              const hasInsurance = activeRiderId && insuredRiderIds ? insuredRiderIds.has(activeRiderId) : null;
              const ignitionBlocked = ignitionBlockedByBikeId?.get(vehicleKey) ?? false;
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
                  <td onClick={(event) => event.stopPropagation()}>
                    {vehicle.id ? (
                      <DeleteVehicleButton vehicleId={vehicle.id} plateNumber={vehicle.plateNumber} />
                    ) : null}
                  </td>
                  <td>{vehicle.plateNumber}</td>
                  <td>{renderEngineTypeBadge(vehicle.engineType)}</td>
                  <td onClick={(event) => event.stopPropagation()}>
                    {vehicle.id ? (
                      <OperationStatusToggle bikeId={vehicle.id} initialStatus={op} />
                    ) : (
                      renderOperationBadge(op)
                    )}
                  </td>
                  <td>{riderInfo ? riderInfo.name : <span className="muted">미배정</span>}</td>
                  <td>{riderInfo ? riderInfo.phone : <span className="muted">—</span>}</td>
                  <td>{renderEducationType(educationType)}</td>
                  <td>{renderCategory(contract?.category ?? null)}</td>
                  <td>{renderReturnType(contract?.returnType ?? null)}</td>
                  <td>{renderDuration(contract?.durationLabel ?? null)}</td>
                  <td>{renderPresence(hasInsurance)}</td>
                  <td className="vehicles-cell-mono">{imei || <span className="muted">—</span>}</td>
                  <td>{renderConnection(pin?.connectionStatus)}</td>
                  <td>{renderIgnition(pin?.ignitionStatus)}</td>
                  <td onClick={(event) => event.stopPropagation()}>
                    {vehicle.id ? (
                      <IgnitionControlButton bikeId={vehicle.id} initialBlocked={ignitionBlocked} />
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
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

// 구분(engineType) 뱃지. ELECTRIC = 액센트 톤 (전기 = 정상 운영의 기본 차종),
// ICE = battery-mid(노랑) 톤으로 시각 구분. 도메인 가정상 다수가 ELECTRIC 이므로
// 액센트가 "기본" 컬러 역할.
function renderEngineTypeBadge(engineType: FrontendVehicle["engineType"]): ReactNode {
  if (engineType === "ICE") {
    return <span className="vehicles-pill vehicles-pill--engine-ice">내연</span>;
  }
  if (engineType === "ELECTRIC") {
    return <span className="vehicles-pill vehicles-pill--engine-electric">전기</span>;
  }
  return <span className="muted">—</span>;
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

// 라이더-측 컬럼 렌더러. 라이더 탭 (`RidersPanel`) 과 라벨/톤 통일.
function renderEducationType(type: "ONLINE" | "OFFLINE" | null): ReactNode {
  if (type === "ONLINE") return "온라인";
  if (type === "OFFLINE") return "오프라인";
  return <span className="muted">—</span>;
}

function renderCategory(category: RiderActiveContractSummary["category"] | null | undefined): ReactNode {
  if (category === "SUBSCRIPTION") return "구독";
  if (category === "RENTAL") return "렌탈";
  if (category === "CUSTOM") return "커스텀";
  return <span className="muted">—</span>;
}

function renderReturnType(returnType: RiderActiveContractSummary["returnType"] | null | undefined): ReactNode {
  if (returnType === "TAKEOVER") return "인수형";
  if (returnType === "RETURN") return "반납형";
  return <span className="muted">—</span>;
}

function renderDuration(durationLabel: string | null | undefined): ReactNode {
  if (!durationLabel) return <span className="muted">—</span>;
  return durationLabel;
}

function renderPresence(hasIt: boolean | null): ReactNode {
  if (hasIt) return <Badge tone="active">있음</Badge>;
  return <span className="muted">—</span>;
}
