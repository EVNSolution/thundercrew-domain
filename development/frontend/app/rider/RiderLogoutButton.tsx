"use client";

import { useTransition } from "react";

import { logoutRiderAction } from "./actions";

export default function RiderLogoutButton() {
  const [pending, startTransition] = useTransition();

  function onLogout() {
    startTransition(async () => {
      await logoutRiderAction();
      // 풀 페이지 로드 — 서버액션 redirect() 시 클라이언트가 stale RSC(관리자 로그인 UI)를
      // 그리는 문제가 있어, 비워진 세션으로 미들웨어가 새로 평가하도록 강제 이동한다.
      window.location.href = "/rider/login";
    });
  }

  return (
    <button
      type="button"
      onClick={onLogout}
      disabled={pending}
      style={{
        width: "100%",
        padding: "12px 0",
        borderRadius: 8,
        border: "1px solid #e5e7eb",
        background: "#f9fafb",
        color: "#374151",
        fontSize: 14,
        fontWeight: 500,
        cursor: "pointer",
      }}
    >
      {pending ? "로그아웃 중…" : "로그아웃"}
    </button>
  );
}
