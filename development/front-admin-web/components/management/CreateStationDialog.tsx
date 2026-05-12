"use client";

import { useRef } from "react";

import { createStationFromOverviewAction } from "@/app/overview/actions";

/**
 * Floating create dialog for the /overview stations tab. Operator only
 * fills in the four fields the day-to-day register flow needs - the
 * remaining backend-required fields (name / lat / lng / status /
 * currentBatteryCount) get sensible defaults from the server action
 * so the operator can fill / correct them later if needed.
 */
export function CreateStationDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        className="button-primary"
        type="button"
        onClick={() => dialogRef.current?.showModal()}
      >
        스테이션 등록
      </button>
      <dialog ref={dialogRef} className="overview-create-dialog">
        <form action={createStationFromOverviewAction}>
          <h3>스테이션 등록</h3>
          <label>
            주소
            <input name="address" maxLength={200} required />
          </label>
          <div className="overview-create-dialog-row">
            <label>
              총 수량
              <input name="maxBatteryCapacity" type="number" min={0} placeholder="0" required />
            </label>
            <label>
              잔여 수량
              <input name="availableBatteryCount" type="number" min={0} placeholder="0" />
            </label>
          </div>
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
