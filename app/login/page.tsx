import { Field } from "@/components/ui/FormField";
import { signInAdmin } from "./actions";

const statusMessage: Record<string, string> = {
  "missing-env": "Supabase 환경변수가 아직 연결되지 않았습니다.",
  "auth-error": "로그인에 실패했습니다. 테스트 관리자 이메일/비밀번호를 확인하세요."
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const message = status ? statusMessage[status] : null;

  return (
    <div className="page-container">
      <section className="hero">
        <p className="hero-kicker">Admin Auth</p>
        <h1 className="hero-title">관리자 로그인</h1>
        <p className="hero-description">Supabase Auth email/password 로그인으로 연결했습니다. 테스트 관리자 계정은 로컬 `.env.local`에만 저장합니다.</p>
      </section>
      <form action={signInAdmin} className="card" style={{ maxWidth: 480, margin: "0 auto 80px" }}>
        <Field label="이메일"><input className="input" name="email" type="email" placeholder="admin@thundercrew-domain.local" required /></Field><br />
        <Field label="비밀번호"><input className="input" name="password" type="password" placeholder="로컬 테스트 비밀번호" required /></Field>
        {message ? <div className="notice" style={{ marginTop: 16 }}>{message}</div> : null}
        <div className="notice" style={{ marginTop: 16 }}>실제 인증은 Supabase Auth로 요청합니다. 세션 쿠키/권한 보호는 다음 단계에서 middleware와 SSR client로 확장합니다.</div>
        <div className="form-actions"><button className="button-primary" type="submit">로그인</button></div>
      </form>
    </div>
  );
}
