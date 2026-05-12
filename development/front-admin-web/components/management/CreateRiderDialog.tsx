"use client";

import { useRef } from "react";

import { createRiderFromOverviewAction } from "@/app/overview/actions";

/**
 * Floating create dialog for the /overview riders tab.
 * Operator-requested minimal field set: 이름 / 연락처 / 교육 여부.
 *
 * '교육 여부' is a one-shot selector — if the operator picks 온라인 /
 * 오프라인 the server action also creates a rider_education_record
 * alongside the rider (completedAt = now). '없음' skips it.
 */
export function CreateRiderDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
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
        <form action={createRiderFromOverviewAction}>
          <h3>라이더 등록</h3>
          <label>
            이름
            <input name="name" maxLength={100} required />
          </label>
          <label>
            연락처
            <input name="phoneNumber" maxLength={30} placeholder="예: 010-0000-0000" required />
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
