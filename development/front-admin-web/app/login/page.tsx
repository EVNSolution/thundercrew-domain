import { Field } from "@/components/ui/FormField";
import { serviceOpsApiConfigured } from "@/lib/services/service-ops-api";
import { signInAdmin } from "./actions";

const statusMessage: Record<string, string> = {
  "missing-env": "Supabase 환경변수가 아직 연결되지 않았습니다.",
  "auth-error": "로그인에 실패했습니다. 테스트 관리자 이메일/비밀번호를 확인하세요.",
  "missing-credentials": "로그인 ID와 비밀번호를 입력하세요.",
  "service-ops-auth-error": "서비스 API 로그인에 실패했습니다. 백엔드 관리자 계정을 확인하세요.",
  "session-required": "서비스 API 세션이 필요합니다. 다시 로그인하세요.",
  "signed-out": "관리자 세션이 종료되었습니다."
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const message = status ? statusMessage[status] : null;
  const serviceOpsMode = serviceOpsApiConfigured();

  return (
    <div className="page-container">
      <section className="hero">
        <p className="hero-kicker">Admin Auth</p>
        <h1 className="hero-title">관리자 로그인</h1>
        <p className="hero-description">
          {serviceOpsMode
            ? "Spring Boot service-ops-api 관리자 로그인으로 HTTP-only 세션 쿠키를 발급합니다."
            : "Supabase Auth email/password 로그인으로 연결했습니다. 테스트 관리자 계정은 로컬 `.env.local`에만 저장합니다."}
        </p>
      </section>
      <form action={signInAdmin} className="card" style={{ maxWidth: 480, margin: "0 auto 80px" }}>
        <Field label={serviceOpsMode ? "로그인 ID 또는 이메일" : "이메일"}>
          <input
            autoComplete="username"
            className="input"
            name="loginId"
            placeholder={serviceOpsMode ? "admin" : "admin@thundercrew-domain.local"}
            required
            type={serviceOpsMode ? "text" : "email"}
          />
        </Field><br />
        <Field label="비밀번호"><input className="input" name="password" type="password" placeholder="로컬 테스트 비밀번호" required /></Field>
        {message ? <div className="notice" style={{ marginTop: 16 }}>{message}</div> : null}
        <div className="notice" style={{ marginTop: 16 }}>
          {serviceOpsMode
            ? "로그인 성공 시 토큰은 브라우저 입력값이나 공개 파일이 아니라 HTTP-only 쿠키로만 보관합니다."
            : "SERVICE_OPS_API_BASE_URL이 없으면 기존 Supabase Auth 경로를 유지합니다. 백엔드 연결 시 service-ops-api 로그인으로 자동 전환됩니다."}
        </div>
        <div className="form-actions"><button className="button-primary" type="submit">로그인</button></div>
      </form>
    </div>
  );
}
