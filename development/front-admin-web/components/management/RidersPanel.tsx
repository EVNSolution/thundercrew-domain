"use client";

import { useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/Badge";
import { DeleteRiderButton } from "@/components/management/DeleteRiderButton";
import { RiderDetailDialog, type RiderDetailRow } from "@/components/management/RiderDetailDialog";
import { RIDER_DRAG_TYPE } from "@/components/management/ContractMatchingForm";
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
 * Read-only table-card for the rider list on `/overview ?tab=riders`.
 * Columns: 이름 / 연락처 / 교육 여부 / 차량 번호 / 구독·렌탈 / 형태 / 기간 / 보험.
 *
 * The contract-shape columns (차량 번호 + 구독·렌탈 + 형태 + 기간) all
 * come from the rider's most recent active contract. 차량 번호 needs a
 * separate map (`riderActiveBikePlate`) because the contract row only
 * carries the bikeId.
 *
 * 행 클릭 시 상세 다이얼로그가 열리고 거기서 수정으로 전환할 수 있다.
 * 작업 칼럼의 삭제 폼은 `onClick` 으로 이벤트 전파를 막아 행 클릭과
 * 충돌하지 않게 한다.
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
  /** 보험 select 의 선택 가능 항목 (insurance_items). 없으면 다이얼로그에서 비활성. */
  insuranceOptions?: ReadonlyArray<InsuranceOption>;
  /** bikeId → telemetry ignition_status (ON/OFF/UNKNOWN). 매칭된 차량의 현재 시동 상태 표시. */
  ignitionStatusByBikeId?: Map<string, string>;
  /** bikeId → 시동 방지 토글 현재 상태. */
  ignitionBlockedByBikeId?: Map<string, boolean>;
  /** riderId → 활성 매칭의 bikeId. 다이얼로그가 시동 정보 lookup 에 사용. */
  riderActiveBikeId?: Map<string, string>;
}) {
  const [activeRow, setActiveRow] = useState<RiderDetailRow | null>(null);

  return (
    <div className="table-card">
      <table className="table" style={{ tableLayout: "fixed" }}>
        <colgroup>
          <col />
          <col />
          <col />
          <col />
          <col />
          <col />
          <col />
          <col />
          <col style={{ width: "72px" }} />
        </colgroup>
        <thead>
          <tr>
            <th>이름</th>
            <th>연락처</th>
            <th>교육</th>
            <th>차량 번호</th>
            <th>구독/렌탈</th>
            <th>형태</th>
            <th>기간</th>
            <th>보험</th>
            <th style={{ textAlign: "right" }}>작업</th>
          </tr>
        </thead>
        <tbody>
          {data.riders.length === 0 ? (
            <tr>
              <td colSpan={9} className="table-empty-cell">
                데이터 없음
              </td>
            </tr>
          ) : null}
          {data.riders.map((rider) => {
            const riderKey = rider.id ?? rider.slug;
            const hasInsurance = insuredRiderIds ? insuredRiderIds.has(riderKey) : null;
            const educationType = educationTypeByRiderId?.get(riderKey) ?? null;
            const contract = riderActiveContractById?.get(riderKey) ?? null;
            const plate = riderActiveBikePlate?.get(riderKey) ?? null;
            const activeInsurance = riderActiveInsuranceByRiderId?.get(riderKey) ?? null;
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
                <td>{rider.name}</td>
                <td>{rider.phone}</td>
                <td>{renderEducationType(educationType)}</td>
                <td>{renderPlate(plate)}</td>
                <td>{renderCategory(contract?.category ?? null)}</td>
                <td>{renderReturnType(contract?.returnType ?? null)}</td>
                <td>{renderDuration(contract?.durationLabel ?? null)}</td>
                <td>{renderPresence(hasInsurance)}</td>
                <td
                  style={{ textAlign: "right" }}
                  onClick={(event) => event.stopPropagation()}
                >
                  <DeleteRiderButton riderId={riderKey} riderName={rider.name} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <RiderDetailDialog
        key={activeRow ? (activeRow.rider.id ?? activeRow.rider.slug) : "none"}
        row={activeRow}
        insuranceOptions={insuranceOptions ?? []}
        onClose={() => setActiveRow(null)}
      />
    </div>
  );
}

function renderPresence(hasIt: boolean | null): ReactNode {
  if (hasIt) return <Badge tone="active">있음</Badge>;
  return <span className="muted">—</span>;
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
