"use client";

import { useRef } from "react";

import { signOutAdmin } from "@/app/login/actions";

/**
 * 우상단 floating action bar 의 로그아웃 버튼. 클릭 즉시 세션이 끊기는 것은
 * 운영자에게 위험하므로 `window.confirm` 으로 1 단계 의사 확인을 끼운다.
 *
 * 아이콘은 "문 + 바깥쪽 화살표" SVG — 운영자가 흔히 본 로그아웃 시각 언어를
 * 그대로 옮긴 것. stroke 기반이라 sidebar-link 의 currentColor + light/dark
 * 테마에 자동 적응한다.
 *
 * 폼이 server action 으로 직접 submit 되어야 쿠키가 서버에서 안전하게 지워
 * 지므로, confirm 결과를 onSubmit 단계에서 처리 — 취소 시 `preventDefault`
 * 로 막고, OK 시 그대로 통과해 server action 이 실행된다.
 */
export function LogoutButton() {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={signOutAdmin}
      className="top-actions-form"
      onSubmit={(event) => {
        if (!window.confirm("로그아웃 하시겠습니까?")) {
          event.preventDefault();
        }
      }}
    >
      <button
        className="sidebar-link"
        type="submit"
        title="로그아웃"
        aria-label="로그아웃"
      >
        <LogoutIcon />
        <span className="sidebar-label">로그아웃</span>
      </button>
    </form>
  );
}

// 문 + 바깥쪽 화살표. 운영자가 첨부한 reference 이미지의 형태 그대로 —
// 왼쪽에 열린 문(직사각형 + 손잡이 점) + 오른쪽 바깥으로 향하는 화살표.
function LogoutIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* 문틀 (왼쪽 직사각형) */}
      <path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4" />
      {/* 손잡이 점 */}
      <circle cx="8.2" cy="12" r="0.6" fill="currentColor" stroke="none" />
      {/* 바깥으로 향하는 화살표 */}
      <path d="M11 12h10" />
      <path d="M17 8l4 4-4 4" />
    </svg>
  );
}
