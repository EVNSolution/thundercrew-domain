import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import type { VehicleDataResult } from "@/lib/services/vehicle-data-core";

/**
 * Pure presentational table-card for the vehicle list. Pulled out of
 * `/vehicles/page.tsx` so the same render can be embedded inline on the
 * Overview management hub without duplicating the JSX.
 */
export function VehiclesPanel({ data }: { data: VehicleDataResult }) {
  if (!data.vehicles.length) {
    return (
      <EmptyState
        actionLabel="차량 등록"
        description="아직 등록된 차량이 없습니다. DB ID 입력 없이 차량번호와 VIN부터 등록합니다."
        href="/vehicles/new"
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
            <th>배터리</th>
            <th>위치</th>
            <th>상세</th>
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
              <td>{formatBattery(vehicle.batteryPercent)}</td>
              <td>{vehicle.locationLabel}</td>
              <td>
                <Link className="button-secondary" href={`/vehicles/${vehicle.slug}`}>
                  보기
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatBattery(value: number | null): string {
  return value === null ? "관제 API 후속" : `${value}%`;
}
