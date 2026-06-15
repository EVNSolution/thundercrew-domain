"use client";

import { useCallback, useRef, useState } from "react";

import { createMaintenanceItemAction } from "@/app/actions";

/**
 * 정비 카탈로그 신규 품목 추가 다이얼로그. "정비" 탭 우측 상단 버튼이 열고,
 * categories 체크박스로 적용 차종을 복수 선택한다.
 *
 * cycle 두 필드(km / months) 중 최소 한 값이 필요 — backend check
 * 제약과 일치. 폼은 그 검증을 client-side 에서 하지 않고 server action 에서
 * 처리(silent redirect with status param). 운영자가 비워 보내면 안내 메시지.
 */
export function CreateMaintenanceItemDialog() {
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
        정비 품목 추가
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
        <form ref={formRef} action={createMaintenanceItemAction} key={`create-form-${resetKey}`}>
          <h3>정비 품목 추가</h3>
          <label>
            품목
            <input name="name" required maxLength={100} placeholder="예: 엔진오일" />
          </label>
          <fieldset>
            <legend>적용 차종</legend>
            <label>
              <input type="checkbox" name="categories" value="TWO_WHEEL_ELECTRIC" defaultChecked />
              2륜 전기
            </label>
            <label>
              <input type="checkbox" name="categories" value="TWO_WHEEL_ICE" />
              2륜 내연
            </label>
            <label>
              <input type="checkbox" name="categories" value="FOUR_WHEEL_ELECTRIC" />
              4륜 전기
            </label>
            <label>
              <input type="checkbox" name="categories" value="FOUR_WHEEL_ICE" />
              4륜 내연
            </label>
          </fieldset>
          <label>
            교환주기 (km)
            <input name="cycleKm" type="number" min={0} placeholder="비우면 km 기준 없음" />
          </label>
          <label>
            교환주기 (개월)
            <input name="cycleMonths" type="number" min={0} placeholder="비우면 개월 기준 없음" />
          </label>
          <label>
            메모
            <input name="memo" maxLength={200} placeholder="선택 입력" />
          </label>
          <div className="overview-create-dialog-actions">
            <button type="button" className="button-neutral" onClick={() => dialogRef.current?.close()}>
              취소
            </button>
            <button className="button-primary" type="submit">
              추가
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
