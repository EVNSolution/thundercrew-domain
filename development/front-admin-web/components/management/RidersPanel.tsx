import type { ReactNode } from "react";

import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import type { RiderDataResult } from "@/lib/services/rider-data";
import type { RiderActiveContractSummary } from "@/lib/services/rider-matching-snapshot-data";

/**
 * Read-only table-card for the rider list on `/overview ?tab=riders`.
 * Columns: 이름 / 연락처 / 계약 / 구독|렌탈 / 형태 / 기간 / 보험 여부 / 교육 여부.
 *
 * The four contract-shape columns (계약 / 구독·렌탈 / 형태 / 기간) all
 * come from `riderActiveContractById` - the rider's most recent active
 * contract resolved to its template. When the rider has no active
 * contract those four cells render `—`.
 */
export function RidersPanel({
  data,
  matchedRiderIds,
  insuredRiderIds,
  educatedRiderIds,
  riderActiveContractById
}: {
  data: RiderDataResult;
  matchedRiderIds?: Set<string>;
  insuredRiderIds?: Set<string>;
  educatedRiderIds?: Set<string>;
  riderActiveContractById?: Map<string, RiderActiveContractSummary>;
}) {
  if (!data.riders.length) {
    return (
      <EmptyState
        description="아직 등록된 라이더가 없습니다."
        title="라이더 없음"
      />
    );
  }

  return (
    <div className="table-card">
      <table className="table">
        <thead>
          <tr>
            <th>이름</th>
            <th>연락처</th>
            <th>계약</th>
            <th>구독/렌탈</th>
            <th>형태</th>
            <th>기간</th>
            <th>보험 여부</th>
            <th>교육 여부</th>
          </tr>
        </thead>
        <tbody>
          {data.riders.map((rider) => {
            const riderKey = rider.id ?? rider.slug;
            const hasContract = matchedRiderIds ? matchedRiderIds.has(riderKey) : null;
            const hasInsurance = insuredRiderIds ? insuredRiderIds.has(riderKey) : null;
            const hasEducation = educatedRiderIds ? educatedRiderIds.has(riderKey) : null;
            const contract = riderActiveContractById?.get(riderKey) ?? null;
            return (
              <tr key={rider.slug}>
                <td>{rider.name}</td>
                <td>{rider.phone}</td>
                <td>{renderPresence(hasContract)}</td>
                <td>{renderCategory(contract?.category ?? null)}</td>
                <td>{renderReturnType(contract?.returnType ?? null)}</td>
                <td>{renderDuration(contract?.durationLabel ?? null)}</td>
                <td>{renderPresence(hasInsurance)}</td>
                <td>{renderPresence(hasEducation)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function renderPresence(hasIt: boolean | null): ReactNode {
  if (hasIt === null) return <span className="muted">—</span>;
  return hasIt ? <Badge tone="active">있음</Badge> : <Badge tone="muted">없음</Badge>;
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
