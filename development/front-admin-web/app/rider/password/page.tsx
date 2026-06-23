"use client";

import { useState, useTransition } from "react";

import { changeRiderPasswordAction } from "./password-action";

export default function RiderPasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    const newPassword = String(formData.get("newPassword") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");
    if (newPassword !== confirmPassword) {
      setError("새 비밀번호가 일치하지 않습니다.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await changeRiderPasswordAction(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      // 풀 페이지 로드로 이동 — stale RSC 없이 라이더 홈이 바로 렌더된다.
      window.location.href = "/rider";
    });
  }

  return (
    <main style={{ maxWidth: 360, margin: "0 auto", padding: "48px 16px" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>비밀번호 변경</h1>
      <form action={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span>현재 비밀번호</span>
          <input
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span>새 비밀번호</span>
          <input
            name="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span>새 비밀번호 확인</span>
          <input
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        {error ? <p style={{ color: "#dc2626", fontSize: 14, margin: 0 }}>{error}</p> : null}
        <button type="submit" disabled={pending} style={{ marginTop: 8, padding: "10px 0" }}>
          {pending ? "변경 중…" : "비밀번호 변경"}
        </button>
      </form>
      <p style={{ marginTop: 16, fontSize: 14, textAlign: "center" }}>
        <a href="/rider" style={{ color: "#2563eb" }}>← 홈으로</a>
      </p>
    </main>
  );
}
