import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import type { RiderDataResult } from "@/lib/services/rider-data";

/**
 * Pure presentational table-card for the rider list. Pulled out of
 * `/riders/page.tsx` so the same render can be embedded inline on the
 * Overview management hub without duplicating the JSX.
 *
 * Optional `matchedRiderIds` / `insuredRiderIds` sets let callers light
 * up the 계약 / 보험 columns with real "있음/없음" badges. When the sets
 * are not provided the columns fall back to `—`, which is what happens
 * on the /riders hub page that does not (currently) load the matching
 * snapshot.
 */
export function RidersPanel({
  data,
  matchedRiderIds,
  insuredRiderIds
}: {
  data: RiderDataResult;
  matchedRiderIds?: Set<string>;
  insuredRiderIds?: Set<string>;
}) {
  if (!data.riders.length) {
    return (
      <EmptyState
        actionLabel="라이더 등록"
        description="아직 등록된 라이더가 없습니다. ID 입력 없이 이름과 연락처부터 등록합니다."
        href="/riders/new"
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
            <th>보험</th>
            <th>상세</th>
          </tr>
        </thead>
        <tbody>
          {data.riders.map((rider) => {
            const riderKey = rider.id ?? rider.slug;
            const hasContract = matchedRiderIds ? matchedRiderIds.has(riderKey) : null;
            const hasInsurance = insuredRiderIds ? insuredRiderIds.has(riderKey) : null;
            return (
              <tr key={rider.slug}>
                <td>{rider.name}</td>
                <td>{rider.phone}</td>
                <td>{renderPresence(hasContract)}</td>
                <td>{renderPresence(hasInsurance)}</td>
                <td>
                  <Link className="button-secondary" href={`/riders/${rider.slug}`}>
                    보기
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function renderPresence(hasIt: boolean | null) {
  if (hasIt === null) return <span className="muted">—</span>;
  return hasIt ? (
    <Badge tone="active">있음</Badge>
  ) : (
    <Badge tone="muted">없음</Badge>
  );
}
