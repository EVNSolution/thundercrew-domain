import { Field } from "@/components/ui/FormField";
import { serviceOpsApiConfigured } from "@/lib/services/service-ops-api";
import { signInAdmin } from "./actions";

// 로그인 실패 / 만료 상태별 안내. 게이트(미들웨어) 가 보낸 status 도
// 여기서 같은 자리에 표시한다. 운영자 친화적인 한 줄이라 inline 메시지만
// 살리고 본문 설명·기능 안내 같은 텍스트는 다 떼어냈다.
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
      <form action={signInAdmin} className="card" style={{ maxWidth: 480, margin: "80px auto" }}>
        <Field label={serviceOpsMode ? "로그인 ID 또는 이메일" : "이메일"}>
          <input
            autoComplete="username"
            className="input"
            name="loginId"
            required
            type={serviceOpsMode ? "text" : "email"}
          />
        </Field>
        <br />
        <Field label="비밀번호">
          <input className="input" name="password" type="password" required />
        </Field>
        {message ? <div className="notice" style={{ marginTop: 16 }}>{message}</div> : null}
        <div className="form-actions">
          <button className="button-primary" type="submit">로그인</button>
        </div>
      </form>
    </div>
  );
}
