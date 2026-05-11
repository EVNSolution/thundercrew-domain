"use client";

import { useRef } from "react";

import { createStationFromOverviewAction } from "@/app/overview/actions";

/**
 * Floating create dialog for the /overview stations tab.
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
            이름
            <input name="name" maxLength={100} required />
          </label>
          <label>
            주소
            <input name="address" maxLength={200} required />
          </label>
          <label>
            운영 상태
            <select name="status" defaultValue="ACTIVE">
              <option value="ACTIVE">운영 중</option>
              <option value="MAINTENANCE">점검 중</option>
              <option value="INACTIVE">운영 중지</option>
            </select>
          </label>
          <div className="overview-create-dialog-row">
            <label>
              위도
              <input name="latitude" type="number" step="any" placeholder="예: 37.5666" required />
            </label>
            <label>
              경도
              <input name="longitude" type="number" step="any" placeholder="예: 126.9784" required />
            </label>
          </div>
          <div className="overview-create-dialog-row">
            <label>
              최대 수량
              <input name="maxBatteryCapacity" type="number" min={0} placeholder="0" required />
            </label>
            <label>
              현재 수량
              <input name="currentBatteryCount" type="number" min={0} placeholder="0" />
            </label>
            <label>
              가능 수량
              <input name="availableBatteryCount" type="number" min={0} placeholder="0" />
            </label>
          </div>
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
