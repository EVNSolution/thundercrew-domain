import type { ReactNode } from "react";

import { Badge } from "@/components/ui/Badge";
import type { VehicleDataResult } from "@/lib/services/vehicle-data";

/**
 * Read-only table-card for the vehicle list on `/overview ?tab=vehicles`.
 * Columns: 차량번호 / 모델 / 차체 상태 / 보험 / 배정.
 *
 * The 보험 column reports whether the rider currently driving this
 * vehicle has an active rider-insurance row. The lookup walks
 * vehicle id → active contract's riderId (`bikeActiveRiderById`) →
 * insured set membership (`insuredRiderIds`). Vehicles with no active
 * contract show `—`.
 */
export function VehiclesPanel({
  data,
  insuredRiderIds,
  bikeActiveRiderById
}: {
  data: VehicleDataResult;
  insuredRiderIds?: Set<string>;
  bikeActiveRiderById?: Map<string, string>;
}) {
  return (
    <div className="table-card">
      <table className="table">
        <thead>
          <tr>
            <th>차량번호</th>
            <th>모델</th>
            <th>차체 상태</th>
            <th>보험</th>
            <th>배정</th>
          </tr>
        </thead>
        <tbody>
          {data.vehicles.length === 0 ? (
            <tr>
              <td colSpan={5} className="muted" style={{ textAlign: "center" }}>
                데이터 없음
              </td>
            </tr>
          ) : null}
          {data.vehicles.map((vehicle) => {
            const vehicleKey = vehicle.id ?? vehicle.slug;
            const activeRiderId = bikeActiveRiderById?.get(vehicleKey) ?? null;
            const hasInsurance =
              activeRiderId && insuredRiderIds ? insuredRiderIds.has(activeRiderId) : null;
            return (
              <tr key={vehicle.slug}>
                <td>{vehicle.plateNumber}</td>
                <td>{vehicle.model}</td>
                <td>
                  <Badge
                    tone={vehicle.status === "운행 중" ? "active" : vehicle.status === "대기" ? "muted" : "outline"}
                  >
                    {vehicle.status}
                  </Badge>
                </td>
                <td>{renderInsurance(hasInsurance)}</td>
                <td>{vehicle.riderName ?? vehicle.assignmentStatus}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function renderInsurance(hasInsurance: boolean | null): ReactNode {
  if (hasInsurance) return <Badge tone="active">있음</Badge>;
  return <span className="muted">—</span>;
}
