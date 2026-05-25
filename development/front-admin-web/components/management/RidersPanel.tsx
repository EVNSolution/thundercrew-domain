"use client";

import { useMemo, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/Badge";
import { DeleteRiderButton } from "@/components/management/DeleteRiderButton";
import { IgnitionControlButton } from "@/components/management/IgnitionControlButton";
import { RiderDetailDialog, type RiderDetailRow } from "@/components/management/RiderDetailDialog";
import { RIDER_DRAG_TYPE } from "@/components/management/ContractMatchingForm";
import {
  applyRiderFilters,
  DEFAULT_RIDER_FILTERS,
  type RiderFilterState
} from "@/components/overview/filter-compute";
import { useFleetSimulation } from "@/components/overview/FleetSimulationContext";
import { RiderFilterControls } from "@/components/overview/RiderFilterControls";
import type { RiderDataResult } from "@/lib/services/rider-data";
import type { RiderActiveContractSummary } from "@/lib/services/rider-matching-snapshot-data";
import type { ServiceOpsRiderInsurance } from "@/lib/services/service-ops-api";

/**
 * 라이더 수정 다이얼로그 안의 "보험" select 가 쓰는 옵션 한 개. id 는 보험 상품
 * (insurance_item) 의 id 이고, label 은 사용자에게 보일 이름.
 */
export interface InsuranceOption {
  id: string;
  label: string;
}

/**
 * Read-only table-card for the rider list on `/?tab=riders`.
 * Columns: 이름 / 연락처 / 교육 / 차량 번호 / 구독·렌탈 / 형태 / 기간 / 보험 /
 * 시동 상태 / 시동 제어.
 *
 * 보험 컬럼은 단순 "있음/없음" 이 아니라 가입된 insurance_item 의 이름 (예:
 * "KB손해보험 기본형") 을 그대로 표시. 차량 탭 보험 컬럼과 시각 통일.
 *
 * 필터 바는 2-row — 검색 한 줄 + select 다섯 개. 검색은 이름/연락처/차량번호
 * substring 매칭, 나머지 select 들은 그대로 매칭. 모든 필터 AND 조합.
 */

export function RidersPanel({
  data,
  insuredRiderIds,
  educationTypeByRiderId,
  riderActiveContractById,
  riderActiveBikePlate,
  riderActiveBikeId,
  riderActiveInsuranceByRiderId,
  insuranceOptions,
  ignitionStatusByBikeId,
  ignitionBlockedByBikeId
}: {
  data: RiderDataResult;
  insuredRiderIds?: Set<string>;
  educationTypeByRiderId?: Map<string, "ONLINE" | "OFFLINE">;
  riderActiveContractById?: Map<string, RiderActiveContractSummary>;
  riderActiveBikePlate?: Map<string, string>;
  /** riderId → 현재 활성 rider_insurance. 다이얼로그 보험 select 의 기본값/삭제 대상. */
  riderActiveInsuranceByRiderId?: Map<string, ServiceOpsRiderInsurance>;
  /** 보험 select 의 선택 가능 항목 (insurance_items). 보험 컬럼에서 id → 이름 lookup 에도 같이 쓴다. */
  insuranceOptions?: ReadonlyArray<InsuranceOption>;
  /** bikeId → telemetry ignition_status (ON/OFF/UNKNOWN). 매칭된 차량의 현재 시동 상태 표시. */
  ignitionStatusByBikeId?: Map<string, string>;
  /** bikeId → 시동 방지 토글 현재 상태. */
  ignitionBlockedByBikeId?: Map<string, boolean>;
  /** riderId → 활성 매칭의 bikeId. 다이얼로그가 시동 정보 lookup 에 사용. */
  riderActiveBikeId?: Map<string, string>;
}) {
  const [activeRow, setActiveRow] = useState<RiderDetailRow | null>(null);
  const [filters, setFilters] = useState<RiderFilterState>(DEFAULT_RIDER_FILTERS);

  const { virtualFleet } = useFleetSimulation();
  const effectiveRiders = useMemo(() => {
    if (!virtualFleet) return data.riders;
    return [...data.riders, ...virtualFleet.riders];
  }, [data.riders, virtualFleet]);

  // insurance_item id → 이름 사전. 보험 컬럼이 매 행마다 lookup 1회.
  const insuranceLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const option of insuranceOptions ?? []) {
      map.set(option.id, option.label);
    }
    return map;
  }, [insuranceOptions]);

  const visibleRiders = useMemo(
    () =>
      applyRiderFilters({
        riders: effectiveRiders,
        filters,
        educationTypeByRiderId,
        riderActiveBikeId,
        riderActiveBikePlate,
        riderActiveContractById,
        insuredRiderIds,
        ignitionStatusByBikeId
      }),
    [
      effectiveRiders,
      filters,
      educationTypeByRiderId,
      riderActiveBikeId,
      riderActiveBikePlate,
      riderActiveContractById,
      insuredRiderIds,
      ignitionStatusByBikeId
    ]
  );

  return (
    <div className="vehicles-panel">
      <RiderFilterControls
        filters={filters}
        onChange={setFilters}
        layout="horizontal"
        count={{ visible: visibleRiders.length, total: effectiveRiders.length }}
      />

      <div className="table-card">
        <table className="table" style={{ tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "48px" }} />
            <col />
            <col />
            <col />
            <col />
            <col />
            <col />
            <col />
            <col />
            <col style={{ width: "92px" }} />
            <col style={{ width: "104px" }} />
          </colgroup>
          <thead>
            <tr>
              <th aria-label="삭제" />
              <th>이름</th>
              <th>연락처</th>
              <th>교육</th>
              <th>차량 번호</th>
              <th>구독/렌탈</th>
              <th>형태</th>
              <th>기간</th>
              <th>보험</th>
              <th>시동 상태</th>
              <th>시동 제어</th>
            </tr>
          </thead>
          <tbody>
            {visibleRiders.length === 0 ? (
              <tr>
                <td colSpan={11} className="table-empty-cell">
                  조건에 맞는 라이더 없음
                </td>
              </tr>
            ) : null}
            {visibleRiders.map((rider) => {
              const riderKey = rider.id ?? rider.slug;
              const hasInsurance = insuredRiderIds ? insuredRiderIds.has(riderKey) : null;
              const educationType = educationTypeByRiderId?.get(riderKey) ?? null;
              const contract = riderActiveContractById?.get(riderKey) ?? null;
              const plate = riderActiveBikePlate?.get(riderKey) ?? null;
              const activeInsurance = riderActiveInsuranceByRiderId?.get(riderKey) ?? null;
              const insuranceLabel = activeInsurance
                ? insuranceLabelById.get(activeInsurance.insuranceItemId) ?? null
                : null;
              // 매칭된 차량의 bikeId 와 그 차량의 시동 정보 (telemetry / 방지 토글).
              const activeBikeId = riderActiveBikeId?.get(riderKey) ?? null;
              const ignitionStatus = activeBikeId ? ignitionStatusByBikeId?.get(activeBikeId) ?? null : null;
              const ignitionBlocked = activeBikeId ? ignitionBlockedByBikeId?.get(activeBikeId) ?? false : false;
              return (
                <tr
                  key={rider.slug}
                  className="table-row-clickable"
                  draggable={Boolean(rider.id)}
                  onDragStart={(event) => {
                    if (!rider.id) return;
                    // ContractMatchingForm 의 라이더 슬롯이 dataTransfer.types
                    // 에 이 식별자가 있을 때만 drop 을 허용한다. effectAllowed=copy
                    // 로 두면 패널 표시는 그대로 유지된다.
                    event.dataTransfer.setData(RIDER_DRAG_TYPE, rider.id);
                    event.dataTransfer.effectAllowed = "copy";
                  }}
                  onClick={() =>
                    setActiveRow({
                      rider,
                      educationLabel: educationLabelOf(educationType),
                      plate,
                      category: categoryLabelOf(contract?.category ?? null),
                      returnType: returnTypeLabelOf(contract?.returnType ?? null),
                      durationLabel: contract?.durationLabel ?? null,
                      hasInsurance,
                      activeContractId: contract?.contractId ?? null,
                      currentInsuranceId: activeInsurance?.id ?? null,
                      currentInsuranceItemId: activeInsurance?.insuranceItemId ?? null,
                      activeBikeId,
                      ignitionStatus,
                      ignitionBlocked
                    })
                  }
                >
                  <td onClick={(event) => event.stopPropagation()}>
                    {rider.id ? <DeleteRiderButton riderId={rider.id} riderName={rider.name} /> : null}
                  </td>
                  <td>{rider.name}</td>
                  <td>{rider.phone}</td>
                  <td>{renderEducationType(educationType)}</td>
                  <td>{renderPlate(plate)}</td>
                  <td>{renderCategory(contract?.category ?? null)}</td>
                  <td>{renderReturnType(contract?.returnType ?? null)}</td>
                  <td>{renderDuration(contract?.durationLabel ?? null)}</td>
                  <td>{renderInsuranceProduct(insuranceLabel)}</td>
                  <td>{renderIgnitionStatus(ignitionStatus, Boolean(activeBikeId))}</td>
                  <td onClick={(event) => event.stopPropagation()}>
                    {activeBikeId ? (
                      <IgnitionControlButton bikeId={activeBikeId} initialBlocked={ignitionBlocked} />
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <RiderDetailDialog
        key={activeRow ? (activeRow.rider.id ?? activeRow.rider.slug) : "none"}
        row={activeRow}
        insuranceOptions={insuranceOptions ?? []}
        onClose={() => setActiveRow(null)}
      />
    </div>
  );
}

// 보험 가입 여부 대신 가입한 상품명을 그대로 노출. 운영자가 "어떤 상품에 가입한
// 라이더" 인지 한눈에 볼 수 있도록. 미가입 / lookup 실패 시 모두 "—".
function renderInsuranceProduct(label: string | null): ReactNode {
  if (!label) return <span className="muted">—</span>;
  return <Badge tone="active">{label}</Badge>;
}

function renderIgnitionStatus(status: string | null, hasBike: boolean): ReactNode {
  // 라이더에 배정된 차량이 없으면 의미상 시동을 논할 수 없음 — \"—\" 유지.
  if (!hasBike) return <span className="muted">—</span>;
  // 차량은 있는데 ON 이 아닌 모든 케이스(OFF / UNKNOWN / 텔레메트리 없음) 는
  // 운영자 멘탈 모델 상 "꺼짐". 차량 탭의 시동 셀과 동일 규칙.
  if (status === "ON") return <Badge tone="active">시동</Badge>;
  return <span className="muted">꺼짐</span>;
}

function renderEducationType(type: "ONLINE" | "OFFLINE" | null): ReactNode {
  if (type === "ONLINE") return "온라인";
  if (type === "OFFLINE") return "오프라인";
  return <span className="muted">—</span>;
}

function renderPlate(plate: string | null): ReactNode {
  if (!plate) return <span className="muted">—</span>;
  return plate;
}

function renderCategory(category: RiderActiveContractSummary["category"]): ReactNode {
  if (category === "SUBSCRIPTION") return "구독";
  if (category === "RENTAL") return "렌탈";
  if (category === "CUSTOM") return "커스텀";
  return <span className="muted">—</span>;
}

function renderReturnType(returnType: RiderActiveContractSummary["returnType"]): ReactNode {
  if (returnType === "TAKEOVER") return "인수형";
  if (returnType === "RETURN") return "반납형";
  return <span className="muted">—</span>;
}

function renderDuration(durationLabel: string | null): ReactNode {
  if (!durationLabel) return <span className="muted">—</span>;
  return durationLabel;
}

// 다이얼로그 view 영역에 보여줄 플레인 텍스트 라벨로 미리 변환. 패널의
// 테이블 셀 렌더링과 별도로 두는 게 다이얼로그 컴포넌트 쪽에서 ReactNode
// 처리 분기를 안 해도 되어 단순해진다.
function educationLabelOf(type: "ONLINE" | "OFFLINE" | null): string {
  if (type === "ONLINE") return "온라인";
  if (type === "OFFLINE") return "오프라인";
  return "—";
}

function categoryLabelOf(category: RiderActiveContractSummary["category"] | null): string | null {
  if (category === "SUBSCRIPTION") return "구독";
  if (category === "RENTAL") return "렌탈";
  if (category === "CUSTOM") return "커스텀";
  return null;
}

function returnTypeLabelOf(returnType: RiderActiveContractSummary["returnType"] | null): string | null {
  if (returnType === "TAKEOVER") return "인수형";
  if (returnType === "RETURN") return "반납형";
  return null;
}
