"use client";

import { useRef } from "react";

import { createRiderFromOverviewAction } from "@/app/overview/actions";

/**
 * Floating create dialog for the /overview riders tab. Native `<dialog>`
 * element so the modal + backdrop come from the browser; the open state
 * is owned by a ref and reset whenever the page revalidates after submit.
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
            소속
            <input name="teamName" maxLength={100} placeholder="예: 강남 1팀" />
          </label>
          <label>
            담당 구역
            <input name="areaName" maxLength={100} placeholder="예: 강남/역삼" />
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
