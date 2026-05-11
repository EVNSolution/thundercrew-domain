import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import type { RiderDataResult } from "@/lib/services/rider-data";

/**
 * Read-only table-card for the rider list on `/overview ?tab=riders`.
 * The minimal-shell redesign has no rider detail page to drill into,
 * so the table is purely informational.
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
            <th>보험</th>
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
