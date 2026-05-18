"use client";

import { useCallback, useRef, useState } from "react";

import { PhoneNumberInput } from "@/components/management/PhoneNumberInput";
import { createRiderFromOverviewAction } from "@/app/overview/actions";

/**
 * Floating create dialog for the /overview riders tab.
 * Operator-requested minimal field set: 이름 / 연락처 / 교육 여부.
 *
 * '교육 여부' is a one-shot selector — if the operator picks 온라인 /
 * 오프라인 the server action also creates a rider_education_record
 * alongside the rider (completedAt = now). '없음' skips it.
 *
 * 상단 우측 ↻ 버튼: 입력값 일괄 초기화. 다이얼로그를 취소로 닫아도
 * 브라우저는 입력값을 그대로 유지하기 때문에 (의도적, 실수 닫힘 보호용)
 * 이 버튼만이 명시적 초기화 경로다. `form.reset()` 으로 uncontrolled
 * 입력을 비우고, 내부 state 를 가진 자식 컴포넌트(`PhoneNumberInput`)
 * 는 key 를 증가시켜 강제 재마운트로 같이 초기화한다.
 */
export function CreateRiderDialog() {
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
        라이더 등록
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
        <form ref={formRef} action={createRiderFromOverviewAction}>
          <h3>라이더 등록</h3>
          <label>
            이름
            <input name="name" maxLength={100} required />
          </label>
          <label>
            연락처
            <PhoneNumberInput key={`phone-${resetKey}`} name="phoneNumber" maxLength={20} required />
          </label>
          <label>
            교육 여부
            <select name="initialEducationType" defaultValue="">
              <option value="">없음</option>
              <option value="ONLINE">온라인 교육</option>
              <option value="OFFLINE">오프라인 교육</option>
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
