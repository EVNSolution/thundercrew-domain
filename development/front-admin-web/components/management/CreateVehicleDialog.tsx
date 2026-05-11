"use client";

import { useRef } from "react";

import { createVehicleFromOverviewAction } from "@/app/overview/actions";

/**
 * Floating create dialog for the /overview vehicles tab.
 */
export function CreateVehicleDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        className="button-primary"
        type="button"
        onClick={() => dialogRef.current?.showModal()}
      >
        차량 등록
      </button>
      <dialog ref={dialogRef} className="overview-create-dialog">
        <form action={createVehicleFromOverviewAction}>
          <h3>차량 등록</h3>
          <label>
            차량번호
            <input name="plateNumber" maxLength={30} placeholder="예: 서울가1234" required />
          </label>
          <label>
            VIN
            <input name="vin" maxLength={64} placeholder="차대번호" required />
          </label>
          <label>
            모델
            <input name="modelName" maxLength={100} placeholder="예: NIU NQi GTS" />
          </label>
          <label>
            운영 상태
            <select name="operationStatus" defaultValue="READY">
              <option value="READY">대기</option>
              <option value="IN_SERVICE">운행 중</option>
              <option value="REPAIRING">수리</option>
              <option value="INSPECTION_REQUIRED">점검 필요</option>
            </select>
          </label>
          <label>
            메모
            <textarea name="memo" rows={3} placeholder="운영자 내부 메모" />
          </label>
          <div className="overview-create-dialog-actions">
            <button type="button" onClick={() => dialogRef.current?.close()}>
              취소
            </button>
            <button className="button-primary" type="submit">
              등록
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
