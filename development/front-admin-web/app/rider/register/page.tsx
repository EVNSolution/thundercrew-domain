"use client";

import { useState, useTransition } from "react";

import { registerRiderAction } from "./register-action";

export default function RiderRegisterPage() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    const password = String(formData.get("password") ?? "");
    const confirm = String(formData.get("confirm") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    const phoneNumber = String(formData.get("phoneNumber") ?? "").trim();

    if (!name || !phoneNumber || !password || !confirm) {
      setError("모든 항목을 입력하세요.");
      return;
    }
    if (password !== confirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    startTransition(async () => {
      const result = await registerRiderAction(formData);
      if (result?.error) {
        setError(result.error);
      }
    });
  }

  return (
    <main style={{ maxWidth: 360, margin: "0 auto", padding: "48px 16px" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>썬더크루 라이더 회원가입</h1>
      <form action={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span>이름</span>
          <input
            name="name"
            type="text"
            autoComplete="name"
            placeholder="홍길동"
            required
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span>전화번호</span>
          <input
            name="phoneNumber"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="010-0000-0000"
            required
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span>비밀번호</span>
          <input name="password" type="password" autoComplete="new-password" required />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span>비밀번호 확인</span>
          <input name="confirm" type="password" autoComplete="new-password" required />
        </label>
        {error ? <p style={{ color: "#dc2626", fontSize: 14, margin: 0 }}>{error}</p> : null}
        <button type="submit" disabled={pending} style={{ marginTop: 8, padding: "10px 0" }}>
          {pending ? "가입 중…" : "회원가입"}
        </button>
      </form>
      <p style={{ marginTop: 16, fontSize: 14, textAlign: "center" }}>
        이미 계정이 있으신가요?{" "}
        <a href="/rider/login" style={{ color: "#2563eb" }}>로그인</a>
      </p>
    </main>
  );
}
