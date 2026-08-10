import { useState, type FormEvent } from 'react';
import { apiConfig } from '../api/config';
import { login } from '../session';
import type { Principal } from '../session';

/**
 * 관리자 로그인. 토큰은 백엔드가 httpOnly 쿠키로 내려주고 JS 는 읽지 않는다.
 * 실패를 mock 으로 감추지 않고 오류를 그대로 보여준다.
 */
export function LoginPage({ onSignedIn }: { onSignedIn: (principal: Principal) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      onSignedIn(await login(email, password));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '로그인에 실패했습니다.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="entry">
      <div className="entry-brand">
        <span className="entry-brand-mark" aria-hidden="true">
          T
        </span>
        <div className="entry-brand-copy">
          <h1>썬더크루</h1>
          <p>운영 콘솔 로그인</p>
        </div>
      </div>

      <form className="login-card" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="login-email">이메일</label>
          <input
            className="control"
            id="login-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="login-password">비밀번호</label>
          <input
            className="control"
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>

        {error && (
          <p className="error-state" role="alert">
            <b>로그인하지 못했습니다</b>
            {error}
          </p>
        )}

        <div className="form-actions">
          <button className="btn is-primary" type="submit" disabled={pending}>
            {pending ? '확인 중' : '로그인'}
          </button>
        </div>

        {apiConfig.mode === 'mock' && (
          <p className="sub">
            mock 모드입니다. 아무 값이나 넣으면 통과하고, 백엔드를 호출하지 않습니다.
          </p>
        )}
      </form>
    </div>
  );
}
