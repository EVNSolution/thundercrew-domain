import type { ReactNode } from "react";

import { Badge } from "@/components/ui/Badge";
import type { VehicleDataResult } from "@/lib/services/vehicle-data";

/**
 * Read-only table-card for the vehicle list on `/overview ?tab=vehicles`.
 * Columns: 차량번호 / 모델 / 차체 상태 / 보험 / 이름 / 연락처.
 *
 * 보험 + 이름 + 연락처 all pivot on the vehicle's active contract:
 *   vehicle id → bikeActiveRiderById → riderId → riderInfoById / insured set.
 * Vehicles with no active contract show `—` in all three columns.
 */
export function VehiclesPanel({
  data,
  insuredRiderIds,
  bikeActiveRiderById,
  riderInfoById
}: {
  data: VehicleDataResult;
  insuredRiderIds?: Set<string>;
  bikeActiveRiderById?: Map<string, string>;
  riderInfoById?: Map<string, { name: string; phone: string }>;
}) {
  return (
    <div className="table-card">
      <table className="table">
        <thead>
          <tr>
            <th>차량번호</th>
            <th>모델</th>
            <th>운영 상태</th>
            <th>보험</th>
            <th>이름</th>
            <th>연락처</th>
          </tr>
        </thead>
        <tbody>
          {data.vehicles.length === 0 ? (
            <tr>
              <td colSpan={6} className="muted" style={{ textAlign: "center" }}>
                데이터 없음
              </td>
            </tr>
          ) : null}
          {data.vehicles.map((vehicle) => {
            const vehicleKey = vehicle.id ?? vehicle.slug;
            const activeRiderId = bikeActiveRiderById?.get(vehicleKey) ?? null;
            const riderInfo = activeRiderId ? riderInfoById?.get(activeRiderId) ?? null : null;
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
                <td>{riderInfo ? riderInfo.name : <span className="muted">—</span>}</td>
                <td>{riderInfo ? riderInfo.phone : <span className="muted">—</span>}</td>
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
