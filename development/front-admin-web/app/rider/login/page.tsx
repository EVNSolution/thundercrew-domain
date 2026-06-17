"use client";

import { useState, useTransition } from "react";

import { loginRiderAction } from "./login-action";

export default function RiderLoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await loginRiderAction(formData);
      if (result?.error) {
        setError(result.error);
      }
    });
  }

  return (
    <main style={{ maxWidth: 360, margin: "0 auto", padding: "48px 16px" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>썬더크루 라이더 로그인</h1>
      <form action={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span>전화번호</span>
          <input
            name="phoneNumber"
            type="tel"
            inputMode="tel"
            autoComplete="username"
            placeholder="010-0000-0000"
            required
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span>비밀번호</span>
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        {error ? <p style={{ color: "#dc2626", fontSize: 14, margin: 0 }}>{error}</p> : null}
        <button type="submit" disabled={pending} style={{ marginTop: 8, padding: "10px 0" }}>
          {pending ? "로그인 중…" : "로그인"}
        </button>
      </form>
    </main>
  );
}
