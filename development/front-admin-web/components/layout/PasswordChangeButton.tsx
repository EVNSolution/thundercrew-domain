"use client";

import { useRef } from "react";

import { changeAdminPassword } from "@/app/login/actions";

/**
 * 우상단 floating action bar 의 "비밀번호 변경" 버튼 + 다이얼로그. 로그인된
 * admin 본인 비밀번호만 변경 가능 — 현재 비밀번호 + 새 비밀번호 + 새 비밀번호
 * 확인 세 필드. server action 이 길이/일치 검증 후 backend 호출, 결과는
 * status param 으로 query string 에 실려 부모 페이지가 안내 메시지로 노출.
 *
 * 다이얼로그는 native modal `<dialog>` + `showModal()` 으로 띄움. 다른 detail
 * 다이얼로그들과 동일한 modal 패턴이라 일관성 유지.
 */
export function PasswordChangeButton() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const handleOpen = () => {
    formRef.current?.reset();
    dialogRef.current?.showModal();
  };

  return (
    <>
      <button
        className="sidebar-link"
        type="button"
        onClick={handleOpen}
        title="비밀번호 변경"
        aria-label="비밀번호 변경"
      >
        <KeyIcon />
        <span className="sidebar-label">비밀번호 변경</span>
      </button>
      <dialog ref={dialogRef} className="overview-create-dialog">
        <form
          ref={formRef}
          action={changeAdminPassword}
          onSubmit={() => {
            // server action submit 직후 페이지 redirect 가 일어나므로 modal 을
            // 명시적으로 닫지 않아도 unmount 된다. 다만 redirect 가 실패하는
            // 환경(개발 모드 일부) 대비 dialog 를 미리 닫아둔다.
            dialogRef.current?.close();
          }}
        >
          <h3>비밀번호 변경</h3>
          <label>
            현재 비밀번호
            <input
              type="password"
              name="currentPassword"
              required
              autoComplete="current-password"
              maxLength={100}
            />
          </label>
          <label>
            새 비밀번호 (8자 이상)
            <input
              type="password"
              name="newPassword"
              required
              minLength={8}
              maxLength={100}
              autoComplete="new-password"
            />
          </label>
          <label>
            새 비밀번호 확인
            <input
              type="password"
              name="confirmPassword"
              required
              minLength={8}
              maxLength={100}
              autoComplete="new-password"
            />
          </label>
          <div className="overview-create-dialog-actions">
            <button type="button" className="button-neutral" onClick={() => dialogRef.current?.close()}>
              취소
            </button>
            <button type="submit" className="button-primary">
              변경
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

// 작은 자물쇠/열쇠 outline 아이콘. 로그아웃 / 테마 토글 아이콘과 같은 stroke
// 기반 line-art 세트.
function KeyIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="8" cy="15" r="3.5" />
      <path d="M10.5 12.5 L20 3" />
      <path d="M16 7 L19 10" />
      <path d="M14 9 L17 12" />
    </svg>
  );
}
