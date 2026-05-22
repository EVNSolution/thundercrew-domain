"use client";

import { useCallback, useRef, useState } from "react";

import { PlateNumberInput } from "@/components/management/PlateNumberInput";
import { createVehicleFromOverviewAction } from "@/app/actions";

/**
 * Floating create dialog for the root page vehicles tab.
 *
 * 상단 우측 ↻ 버튼은 입력 초기화 — `form.reset()` 으로 uncontrolled
 * 입력(`modelName`, `operationStatus` select) 을 비우고, 내부 state 를
 * 가진 `PlateNumberInput` 은 key 증가로 재마운트 시켜 같이 초기화한다.
 */
export function CreateVehicleDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [resetKey, setResetKey] = useState(0);

  const handleReset = useCallback(() => {
    formRef.current?.reset();
    setResetKey((k) => k + 1);
  }, []);

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
        <button
          type="button"
          className="overview-create-dialog-reset"
          onClick={handleReset}
          aria-label="입력 초기화"
          title="입력 초기화"
        >
          ↻
        </button>
        <form ref={formRef} action={createVehicleFromOverviewAction}>
          <h3>차량 등록</h3>
          <label>
            차량번호
            <PlateNumberInput key={`plate-${resetKey}`} name="plateNumber" required />
          </label>
          <label>
            모델
            <input name="modelName" maxLength={100} placeholder="예: NIU NQi GTS" />
          </label>
          <label>
            운영 상태
            <select name="operationStatus" defaultValue="READY">
              <option value="READY">대기</option>
              <option value="IN_SERVICE">운행</option>
            </select>
          </label>
          <div className="overview-create-dialog-actions">
            <button type="button" className="button-neutral" onClick={() => dialogRef.current?.close()}>
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
