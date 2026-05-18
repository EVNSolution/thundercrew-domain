"use client";

import { useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/Badge";
import { DeleteVehicleButton } from "@/components/management/DeleteVehicleButton";
import { VEHICLE_DRAG_TYPE } from "@/components/management/ContractMatchingForm";
import { VehicleDetailDialog, type VehicleDetailRow } from "@/components/management/VehicleDetailDialog";
import type { VehicleDataResult } from "@/lib/services/vehicle-data";

/**
 * Read-only table-card for the vehicle list on `/overview ?tab=vehicles`.
 * Columns: 차량번호 / 모델 / 이름 / 연락처 / 작업.
 *
 * 시동 상태 컬럼은 사용자 요청으로 제거 — 동일 정보는 매칭된 라이더 상세
 * 다이얼로그에서 보여주고 거기서 "시동 방지" 토글도 함께 다룬다.
 *
 * 행 클릭 시 상세 다이얼로그가 열리고 거기서 수정으로 전환할 수 있다.
 */
export function VehiclesPanel({
  data,
  bikeActiveRiderById,
  riderInfoById
}: {
  data: VehicleDataResult;
  bikeActiveRiderById?: Map<string, string>;
  riderInfoById?: Map<string, { name: string; phone: string }>;
}) {
  const [activeRow, setActiveRow] = useState<VehicleDetailRow | null>(null);

  return (
    <div className="table-card">
      <table className="table" style={{ tableLayout: "fixed" }}>
        <colgroup>
          <col />
          <col />
          <col />
          <col />
          <col style={{ width: "72px" }} />
        </colgroup>
        <thead>
          <tr>
            <th>차량번호</th>
            <th>모델</th>
            <th>이름</th>
            <th>연락처</th>
            <th style={{ textAlign: "right" }}>작업</th>
          </tr>
        </thead>
        <tbody>
          {data.vehicles.length === 0 ? (
            <tr>
              <td colSpan={5} className="table-empty-cell">
                데이터 없음
              </td>
            </tr>
          ) : null}
          {data.vehicles.map((vehicle) => {
            const vehicleKey = vehicle.id ?? vehicle.slug;
            const activeRiderId = bikeActiveRiderById?.get(vehicleKey) ?? null;
            const riderInfo = activeRiderId ? riderInfoById?.get(activeRiderId) ?? null : null;
            return (
              <tr
                key={vehicle.slug}
                className="table-row-clickable"
                draggable={Boolean(vehicle.id)}
                onDragStart={(event) => {
                  if (!vehicle.id) return;
                  // ContractMatchingForm 의 차량 슬롯이 같은 식별자를 받을 때만 drop 허용.
                  event.dataTransfer.setData(VEHICLE_DRAG_TYPE, vehicle.id);
                  event.dataTransfer.effectAllowed = "copy";
                }}
                onClick={() =>
                  setActiveRow({
                    vehicle,
                    riderName: riderInfo?.name ?? null,
                    riderPhone: riderInfo?.phone ?? null
                  })
                }
              >
                <td>{vehicle.plateNumber}</td>
                <td>{vehicle.model}</td>
                <td>{riderInfo ? riderInfo.name : <span className="muted">—</span>}</td>
                <td>{riderInfo ? riderInfo.phone : <span className="muted">—</span>}</td>
                <td
                  style={{ textAlign: "right" }}
                  onClick={(event) => event.stopPropagation()}
                >
                  <DeleteVehicleButton vehicleId={vehicleKey} plateNumber={vehicle.plateNumber} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <VehicleDetailDialog
        key={activeRow ? (activeRow.vehicle.id ?? activeRow.vehicle.slug) : "none"}
        row={activeRow}
        onClose={() => setActiveRow(null)}
      />
    </div>
  );
}

// Note: VehiclesPanel 은 더 이상 ignition status 도 보험 상태도 직접 표시하지
// 않는다. 매칭 → 라이더 상세 다이얼로그에서 통합 노출.
export type { ReactNode };
