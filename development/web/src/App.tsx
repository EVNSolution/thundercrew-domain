import { useCallback, useEffect, useState } from 'react';
import {
  MODES,
  isModeId,
  screenBelongsToMode,
  type ModeId,
  type ScreenId,
} from './app-modes';
import { AdminShell } from './components/AdminShell';
import { LoginPage } from './pages/LoginPage';
import { ModeSelectPage } from './pages/ModeSelectPage';
import { ScreenShell } from './screens/ScreenShell';
import { probeSession, readStoredMode, storeMode, clearStoredMode, type Principal } from './session';

type Stage =
  | { kind: 'checking' }
  | { kind: 'failed'; message: string }
  | { kind: 'anonymous' }
  | { kind: 'choosing'; principal: Principal }
  | { kind: 'working'; principal: Principal; mode: ModeId; screen: ScreenId };

/** URL prefix 에서 모드를 읽는다. 쿠키·sessionStorage 가 정본이고 URL 은 보조다. */
function readModeFromPath(): ModeId | null {
  const first = window.location.pathname.split('/').filter(Boolean)[0];
  return isModeId(first) ? first : null;
}

function syncPath(mode: ModeId, screen: ScreenId): void {
  const next = `${MODES[mode].path}/${screen}`;
  if (window.location.pathname !== next) {
    window.history.replaceState(null, '', next);
  }
}

export function App() {
  const [stage, setStage] = useState<Stage>({ kind: 'checking' });

  useEffect(() => {
    let cancelled = false;
    probeSession()
      .then((principal) => {
        if (cancelled) return;
        if (!principal) {
          setStage({ kind: 'anonymous' });
          return;
        }
        const mode = readModeFromPath() ?? readStoredMode();
        if (mode) {
          setStage({ kind: 'working', principal, mode, screen: MODES[mode].home });
          return;
        }
        setStage({ kind: 'choosing', principal });
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setStage({
          kind: 'failed',
          message: cause instanceof Error ? cause.message : '세션을 확인하지 못했습니다.',
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const enterMode = useCallback((principal: Principal, mode: ModeId) => {
    storeMode(mode);
    const screen = MODES[mode].home;
    syncPath(mode, screen);
    setStage({ kind: 'working', principal, mode, screen });
  }, []);

  const navigate = useCallback((screen: ScreenId) => {
    setStage((current) => {
      if (current.kind !== 'working') return current;
      syncPath(current.mode, screen);
      return { ...current, screen };
    });
  }, []);

  const switchMode = useCallback(() => {
    setStage((current) => {
      if (current.kind !== 'working') return current;
      clearStoredMode();
      return { kind: 'choosing', principal: current.principal };
    });
  }, []);

  if (stage.kind === 'checking') {
    // 로딩 중에는 기존 레이아웃 크기를 유지한다. 정적 셸만 먼저 그린다.
    return (
      <div className="entry" aria-busy="true">
        <div className="entry-brand">
          <span className="entry-brand-mark" aria-hidden="true">
            T
          </span>
          <div className="entry-brand-copy">
            <h1>썬더크루</h1>
            <p>세션 확인 중</p>
          </div>
        </div>
      </div>
    );
  }

  if (stage.kind === 'failed') {
    // remote 오류를 mock 데이터로 감추지 않는다.
    return (
      <div className="entry">
        <div className="login-card">
          <p className="error-state" role="alert">
            <b>백엔드에 연결하지 못했습니다</b>
            {stage.message}
          </p>
          <button className="btn" type="button" onClick={() => window.location.reload()}>
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  if (stage.kind === 'anonymous') {
    return <LoginPage onSignedIn={(principal) => setStage({ kind: 'choosing', principal })} />;
  }

  if (stage.kind === 'choosing') {
    return <ModeSelectPage onSelect={(mode) => enterMode(stage.principal, mode)} />;
  }

  // 모드에 없는 화면이 열려 있으면 첫 화면으로 되돌린다.
  const screen = screenBelongsToMode(stage.screen, stage.mode)
    ? stage.screen
    : MODES[stage.mode].home;

  return (
    <AdminShell mode={stage.mode} screen={screen} onNavigate={navigate} onSwitchMode={switchMode}>
      <ScreenShell mode={stage.mode} screen={screen} />
    </AdminShell>
  );
}
