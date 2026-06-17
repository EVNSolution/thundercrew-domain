"use client";

import { useMemo, type ReactNode } from "react";

import { Badge } from "@/components/ui/Badge";
import type { InsuranceOption } from "@/components/management/RidersPanel";
import { statusToOperation } from "@/components/overview/filter-compute";
import { useVehicleFilter } from "@/components/overview/VehicleFilterContext";
import type { VehicleDataResult } from "@/lib/services/vehicle-data";
import type { RiderActiveContractSummary } from "@/lib/services/rider-matching-snapshot-data";
import type {
  FrontendVehicle,
  ServiceOpsBikeOperationStatus,
  ServiceOpsRiderInsurance
} from "@/lib/services/service-ops-api";

/**
 * 지도 하단 패널의 차량 현황 탭. 읽기 전용 표로, 차량 자체 정보(엑셀 스타일)
 * 와 매칭된 라이더·계약·보험 정보만 한 줄에서 훑을 수 있게 한다. 매칭/등록·
 * 삭제 등 관리 동작은 모두 `/management` 페이지에서 처리하므로 이 패널에는
 * 어떤 관리 affordance 도 두지 않는다.
 *
 * 컬럼 (총 11):
 *   차량번호 / 구분 / 운영 상태 / IMEI / 이름 / 연락처 / 교육 / 구독·렌탈 /
 *   형태 / 기간 / 보험
 *
 * 데이터 매핑:
 * - 차량번호 / 구분(engineType) / 운영 상태 ← FrontendVehicle (이 패널 데이터)
 * - IMEI ← vehicle.imei (자원 관리·차량 상세와 동일 소스)
 * - 이름 / 연락처 ← bikeActiveRiderById → riderInfoById 두 단계 lookup
 * - 교육 / 구독·렌탈 / 형태 / 기간 / 보험 ← bikeActiveRiderById 로 riderId 를
 *   먼저 찾고, 라이더 탭과 동일한 4 종 map (educationTypeByRiderId,
 *   riderActiveContractById, riderActiveInsuranceByRiderId, insuranceOptions)
 *   으로 lookup
 *
 * 행 클릭은 차량 상세 다이얼로그 — 라이더 정보는 단순 조회용이고 편집은
 * 라이더 탭/관리 페이지에서 처리하도록 책임 분리.
 */

const STATUS_LABEL: Record<ServiceOpsBikeOperationStatus, string> = {
  READY: "대기",
  IN_SERVICE: "운행"
};

export function VehiclesPanel({
  data,
  bikeActiveRiderById,
  riderInfoById,
  educationTypeByRiderId,
  riderActiveContractById,
  riderActiveInsuranceByRiderId,
  insuranceOptions
}: {
  data: VehicleDataResult;
  bikeActiveRiderById?: Map<string, string>;
  riderInfoById?: Map<string, { name: string; phone: string }>;
  /** riderId → ONLINE/OFFLINE 교육 type. */
  educationTypeByRiderId?: Map<string, "ONLINE" | "OFFLINE">;
  /** riderId → 활성 매칭의 계약 요약(category / returnType / durationLabel). */
  riderActiveContractById?: Map<string, RiderActiveContractSummary>;
  /** riderId → 현재 활성 rider_insurance. 보험 컬럼이 상품 id 를 derive 할 때 참조. */
  riderActiveInsuranceByRiderId?: Map<string, ServiceOpsRiderInsurance>;
  /** insurance_item id → 표시 라벨 사전. 라이더 탭과 동일. */
  insuranceOptions?: ReadonlyArray<InsuranceOption>;
}) {
  const { setSelectedBikeId } = useVehicleFilter();

  // insurance_item id → 표시 라벨 사전. 보험 컬럼이 매 행마다 lookup 1회.
  const insuranceLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const option of insuranceOptions ?? []) {
      map.set(option.id, option.label);
    }
    return map;
  }, [insuranceOptions]);

  // 지도 헤더 필터가 차량 필터의 단일 소스다. FullscreenMapHost 가 이미
  // 필터링한 `visibleVehicles` 를 `data.vehicles` 로 받아 그대로 렌더한다.
  const visibleVehicles = data.vehicles;

  return (
    <div className="vehicles-panel">
      <div className="table-card vehicles-table-scroll">
        <table className="table vehicles-table">
          <thead>
            <tr>
              <th>차량번호</th>
              <th>구분</th>
              <th>운영 상태</th>
              <th>IMEI</th>
              <th>이름</th>
              <th>연락처</th>
              <th>교육</th>
              <th>구독/렌탈</th>
              <th>형태</th>
              <th>기간</th>
              <th>보험</th>
            </tr>
          </thead>
          <tbody>
            {visibleVehicles.length === 0 ? (
              <tr>
                <td colSpan={11} className="table-empty-cell">
                  조건에 맞는 차량 없음
                </td>
              </tr>
            ) : null}
            {visibleVehicles.map((vehicle) => {
              const vehicleKey = vehicle.id ?? vehicle.slug;
              const activeRiderId = bikeActiveRiderById?.get(vehicleKey) ?? null;
              const riderInfo = activeRiderId ? riderInfoById?.get(activeRiderId) ?? null : null;
              const op = vehicle.operationStatus ?? statusToOperation(vehicle.status);
              const imei = vehicle.imei ?? null;
              // 라이더-측 lookup. 매칭이 없으면 모두 null → "—" 폴백.
              const educationType = activeRiderId ? educationTypeByRiderId?.get(activeRiderId) ?? null : null;
              const contract = activeRiderId ? riderActiveContractById?.get(activeRiderId) ?? null : null;
              const activeInsurance = activeRiderId ? riderActiveInsuranceByRiderId?.get(activeRiderId) ?? null : null;
              const insuranceLabel = activeInsurance
                ? insuranceLabelById.get(activeInsurance.insuranceItemId) ?? null
                : null;
              return (
                <tr
                  key={vehicle.slug}
                  className="table-row-clickable"
                  onClick={() => {
                    // selectedBikeId 만 publish — 지도 위 floating panel 이
                    // 컨텍스트를 읽어 자동으로 열린다. rider 정보 lookup 은
                    // OverviewMapBanner 가 직접 함.
                    if (vehicle.id) setSelectedBikeId(vehicle.id);
                  }}
                >
                  <td>{vehicle.plateNumber}</td>
                  <td>{renderEngineTypeBadge(vehicle.engineType)}</td>
                  <td>{renderOperationBadge(op)}</td>
                  <td className="vehicles-cell-mono">{imei || <span className="muted">—</span>}</td>
                  <td>{riderInfo ? riderInfo.name : <span className="muted">미배정</span>}</td>
                  <td>{riderInfo ? riderInfo.phone : <span className="muted">—</span>}</td>
                  <td>{renderEducationType(educationType)}</td>
                  <td>{renderCategory(contract?.category ?? null)}</td>
                  <td>{renderReturnType(contract?.returnType ?? null)}</td>
                  <td>{renderDuration(contract?.durationLabel ?? null)}</td>
                  <td>{renderInsuranceProduct(insuranceLabel)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 차량 상세 floating panel 은 더 이상 이 패널이 직접 렌더하지 않는다.
          OverviewMapBanner 가 selectedBikeId 를 읽어 지도 캔버스 내부 우상단
          에 띄우고, 마커 클릭으로도 같은 panel 이 열린다. */}
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

function renderOperationBadge(op: ServiceOpsBikeOperationStatus): ReactNode {
  const isOperating = op === "IN_SERVICE";
  return (
    <span className={`vehicles-pill vehicles-pill--${isOperating ? "operating" : "idle"}`}>
      {STATUS_LABEL[op]}
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

// 보험 컬럼은 가입 여부 대신 상품명 표시. 라이더 탭과 동일한 형태.
function renderInsuranceProduct(label: string | null): ReactNode {
  if (!label) return <span className="muted">—</span>;
  return <Badge tone="active">{label}</Badge>;
}
