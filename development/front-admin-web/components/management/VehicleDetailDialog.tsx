"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { PlateNumberInput } from "@/components/management/PlateNumberInput";
import { updateVehicleFromOverviewAction } from "@/app/overview/actions";
import type { FrontendVehicle, ServiceOpsBikeOperationStatus } from "@/lib/services/service-ops-api";

/**
 * 차량 상세 + 편집 다이얼로그. 차체 기본 정보(plateNumber / modelName) 와
 * 운영 상태(operationStatus) 가 백엔드에서는 두 endpoint 로 분리되어 있지만
 * UI 에서는 "저장" 한 번으로 묶고, server action 안에서 두 호출을 순차 실행한다.
 */
export interface VehicleDetailRow {
  vehicle: FrontendVehicle;
  riderName: string | null;
  riderPhone: string | null;
}

const STATUS_TO_CODE: Record<FrontendVehicle["status"], ServiceOpsBikeOperationStatus> = {
  "운행": "IN_SERVICE",
  "대기": "READY"
};

export function VehicleDetailDialog({
  row,
  onClose
}: {
  row: VehicleDetailRow | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<"view" | "edit">("view");

  // 모달 open/close 만 effect 에서 처리. 상태 리셋은 부모의 key prop 으로
  // 재마운트해 useState 초기값이 새로 잡히도록 한다.
  useEffect(() => {
    if (row) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [row]);

  const handleClose = useCallback(() => {
    dialogRef.current?.close();
    onClose();
  }, [onClose]);

  if (!row) return null;

  const { vehicle } = row;
  const vehicleId = vehicle.id ?? vehicle.slug;
  const boundUpdate = updateVehicleFromOverviewAction.bind(null, vehicleId);
  const currentOperationStatus = vehicle.operationStatus ?? STATUS_TO_CODE[vehicle.status];

  return (
    <dialog
      ref={dialogRef}
      className="overview-create-dialog"
      onClose={onClose}
      onCancel={onClose}
    >
      <h3>차량 상세</h3>
      {mode === "view" ? (
        <div className="detail-row-grid">
          <DetailField label="차량번호" value={vehicle.plateNumber} />
          <DetailField label="모델" value={vehicle.model || "—"} />
          <DetailField label="운영 상태" value={vehicle.status} />
          <DetailField label="이름" value={row.riderName ?? "—"} />
          <DetailField label="연락처" value={row.riderPhone ?? "—"} />
          <div className="overview-create-dialog-actions">
            <button type="button" className="button-neutral" onClick={handleClose}>
              닫기
            </button>
            <button type="button" className="button-primary" onClick={() => setMode("edit")}>
              수정
            </button>
          </div>
        </div>
      ) : (
        <form action={boundUpdate}>
          {/* server action 이 두 endpoint 분기를 결정할 때 참고하는 현재 상태값. */}
          <input type="hidden" name="currentOperationStatus" value={currentOperationStatus} />
          <label>
            차량번호
            <PlateNumberInput name="plateNumber" defaultValue={vehicle.plateNumber} required />
          </label>
          <label>
            모델
            <input name="modelName" defaultValue={vehicle.model} maxLength={100} placeholder="예: NIU NQi GTS" />
          </label>
          <label>
            운영 상태
            <select name="operationStatus" defaultValue={currentOperationStatus}>
              <option value="READY">대기</option>
              <option value="IN_SERVICE">운행</option>
            </select>
          </label>
          <div className="overview-create-dialog-actions">
            <button type="button" className="button-neutral" onClick={() => setMode("view")}>
              취소
            </button>
            <button type="submit" className="button-primary">
              저장
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-field">
      <span className="detail-field-label">{label}</span>
      <span className="detail-field-value">{value}</span>
    </div>
  );
}

