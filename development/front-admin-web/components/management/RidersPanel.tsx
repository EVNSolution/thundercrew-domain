import type { ReactNode } from "react";

import { Badge } from "@/components/ui/Badge";
import type { RiderDataResult } from "@/lib/services/rider-data";
import type { RiderActiveContractSummary } from "@/lib/services/rider-matching-snapshot-data";

/**
 * Read-only table-card for the rider list on `/overview ?tab=riders`.
 * Columns: 이름 / 연락처 / 교육 여부 / 차량 번호 / 구독·렌탈 / 형태 / 기간 / 보험.
 *
 * The contract-shape columns (차량 번호 + 구독·렌탈 + 형태 + 기간) all
 * come from the rider's most recent active contract. 차량 번호 needs a
 * separate map (`riderActiveBikePlate`) because the contract row only
 * carries the bikeId.
 */
export function RidersPanel({
  data,
  insuredRiderIds,
  educatedRiderIds,
  riderActiveContractById,
  riderActiveBikePlate
}: {
  data: RiderDataResult;
  insuredRiderIds?: Set<string>;
  educatedRiderIds?: Set<string>;
  riderActiveContractById?: Map<string, RiderActiveContractSummary>;
  riderActiveBikePlate?: Map<string, string>;
}) {
  return (
    <div className="table-card">
      <table className="table">
        <thead>
          <tr>
            <th>이름</th>
            <th>연락처</th>
            <th>교육 여부</th>
            <th>차량 번호</th>
            <th>구독/렌탈</th>
            <th>형태</th>
            <th>기간</th>
            <th>보험</th>
          </tr>
        </thead>
        <tbody>
          {data.riders.length === 0 ? (
            <tr>
              <td colSpan={8} className="muted" style={{ textAlign: "center" }}>
                데이터 없음
              </td>
            </tr>
          ) : null}
          {data.riders.map((rider) => {
            const riderKey = rider.id ?? rider.slug;
            const hasInsurance = insuredRiderIds ? insuredRiderIds.has(riderKey) : null;
            const hasEducation = educatedRiderIds ? educatedRiderIds.has(riderKey) : null;
            const contract = riderActiveContractById?.get(riderKey) ?? null;
            const plate = riderActiveBikePlate?.get(riderKey) ?? null;
            return (
              <tr key={rider.slug}>
                <td>{rider.name}</td>
                <td>{rider.phone}</td>
                <td>{renderPresence(hasEducation)}</td>
                <td>{renderPlate(plate)}</td>
                <td>{renderCategory(contract?.category ?? null)}</td>
                <td>{renderReturnType(contract?.returnType ?? null)}</td>
                <td>{renderDuration(contract?.durationLabel ?? null)}</td>
                <td>{renderPresence(hasInsurance)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function renderPresence(hasIt: boolean | null): ReactNode {
  if (hasIt) return <Badge tone="active">있음</Badge>;
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
