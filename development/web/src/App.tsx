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
import { DeliveryControlPage } from './pages/delivery/ControlPage';
import { DeliveryDispatchPage } from './pages/delivery/DispatchPage';
import { DeliveryRecordsPage } from './pages/delivery/RecordsPage';
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

/**
 * URL 두 번째 조각에서 화면을 읽는다. `/delivery/dispatch` 같은 링크를 직접
 * 열거나 북마크했을 때 그 화면으로 들어가야 한다. 모드에 없는 화면이면
 * null 을 주고 호출부가 첫 화면으로 떨어뜨린다.
 */
function readScreenFromPath(mode: ModeId): ScreenId | null {
  const second = window.location.pathname.split('/').filter(Boolean)[1];
  if (!second) return null;
  const candidate = second as ScreenId;
  return screenBelongsToMode(candidate, mode) ? candidate : null;
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
          // URL 에 화면까지 있으면 그대로 들어간다 (북마크·공유 링크).
          const screen = readScreenFromPath(mode) ?? MODES[mode].home;
          syncPath(mode, screen);
          setStage({ kind: 'working', principal, mode, screen });
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

  // 구현이 끝난 화면은 실제 컴포넌트를, 아직인 화면은 껍데기를 렌더한다.
  function renderScreen() {
    if (stage.kind !== 'working') return null;
    if (stage.mode === 'delivery' && screen === 'control') return <DeliveryControlPage />;
    if (stage.mode === 'delivery' && screen === 'dispatch') return <DeliveryDispatchPage />;
    if (stage.mode === 'delivery' && screen === 'records') return <DeliveryRecordsPage />;
    return <ScreenShell mode={stage.mode} screen={screen} />;
  }

  return (
    <AdminShell mode={stage.mode} screen={screen} onNavigate={navigate} onSwitchMode={switchMode}>
      {renderScreen()}
    </AdminShell>
  );
}
