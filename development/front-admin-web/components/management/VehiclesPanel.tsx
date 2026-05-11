import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import type { VehicleDataResult } from "@/lib/services/vehicle-data-core";

/**
 * Read-only table-card for the vehicle list on `/overview ?tab=vehicles`.
 * No drill-down link — minimal-shell redesign keeps the panel purely
 * informational.
 */
export function VehiclesPanel({ data }: { data: VehicleDataResult }) {
  if (!data.vehicles.length) {
    return (
      <EmptyState
        description="아직 등록된 차량이 없습니다."
        title="차량 없음"
      />
    );
  }

  return (
    <div className="table-card">
      <table className="table">
        <thead>
          <tr>
            <th>차량번호</th>
            <th>모델</th>
            <th>차체 상태</th>
            <th>배정</th>
          </tr>
        </thead>
        <tbody>
          {data.vehicles.map((vehicle) => (
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
              <td>{vehicle.riderName ?? vehicle.assignmentStatus}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
