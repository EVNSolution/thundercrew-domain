import { useMemo, useState } from 'react';
import { apiConfig } from '../../api/config';
import { logAudit } from '../../mock/audit-store';
import {
  ACCENT_CHOICES,
  DEFAULT_SETTINGS,
  clearSettingsMessage,
  diffSettings,
  saveSettings,
  validateSettings,
  type OperationSettings,
} from '../../mock/settings-store';
import { useSettingsStore } from '../../mock/useSettingsStore';

function numberField(value: string, fallback: number): number {
  const parsed = Number.parseInt(value.replace(/[^\d]/g, ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * 설정 — 서비스 기준과 외부 연동.
 *
 * 저장하기 전까지는 **초안**이다. 임계값은 다른 화면이 곧바로 읽으므로 타이핑
 * 중간값이 그대로 반영되면 화면이 깜빡인다. 그래서 폼은 초안을 들고 있고 저장을
 * 눌렀을 때만 스토어로 넘긴다.
 *
 * 기준: docs/frontend/03-screen-feature-map.md §15
 */
export function SettingsPage({ onSignOut }: { onSignOut: () => void }) {
  const { settings, lastMessage } = useSettingsStore();
  const [draft, setDraft] = useState<OperationSettings>(settings);

  const changes = useMemo(() => diffSettings(settings, draft), [settings, draft]);
  const problems = useMemo(() => validateSettings(draft), [draft]);
  const problemOf = (field: keyof OperationSettings) =>
    problems.find((problem) => problem.field === field)?.text ?? null;

  const set = <K extends keyof OperationSettings>(key: K, value: OperationSettings[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const onSave = () => {
    const saved = saveSettings(draft);
    for (const change of saved) {
      logAudit({
        action: 'UPDATE',
        targetKind: 'SETTINGS',
        targetLabel: change.label,
        summary: '설정을 저장했습니다.',
        before: change.before,
        after: change.after,
      });
    }
  };

  return (
    <main className="page-content">
      <div className="page-hero">
        <div className="hero-titles">
          <h1>설정</h1>
          <p>서비스 기준과 외부 연동을 설정합니다.</p>
        </div>
        <div className="hero-tools">
          {changes.length > 0 && <span className="chip is-amber">저장 안 됨 {changes.length}</span>}
          <button
            className="btn"
            type="button"
            disabled={changes.length === 0}
            onClick={() => setDraft(settings)}
          >
            되돌리기
          </button>
          <button
            className="btn is-primary"
            type="button"
            disabled={changes.length === 0 || problems.length > 0}
            onClick={onSave}
          >
            저장
          </button>
        </div>
      </div>

      {lastMessage && (
        <p
          className={lastMessage.kind === 'rejected' ? 'error-state' : 'inline-warn'}
          role="status"
          style={{ marginTop: 0, marginBottom: 'var(--space-3)' }}
        >
          <span aria-hidden="true">{lastMessage.kind === 'rejected' ? '✕' : '✓'}</span>
          {lastMessage.text}
          <button
            className="btn is-small"
            type="button"
            onClick={clearSettingsMessage}
            style={{ marginLeft: 'auto' }}
          >
            닫기
          </button>
        </p>
      )}

      <div className="page-grid">
        <section className="page-panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">알림 기준</div>
              <p className="panel-sub">각 업무 화면이 이 값으로 경보합니다</p>
            </div>
          </div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="st-stale">배송 방치 임계 (분)</label>
              <input
                className="control num"
                id="st-stale"
                inputMode="numeric"
                value={String(draft.staleOrderMinutes)}
                onChange={(event) =>
                  set('staleOrderMinutes', numberField(event.target.value, 0))
                }
              />
              <span className="field-hint">
                풀에 올라온 주문을 이 시간 넘게 아무도 잡지 않으면 배차·관제에서 강조합니다.
              </span>
            </div>
            <div className="field">
              <label htmlFor="st-tolerance">클리닝 지연 허용 (분)</label>
              <input
                className="control num"
                id="st-tolerance"
                inputMode="numeric"
                value={String(draft.cleaningToleranceMinutes)}
                onChange={(event) =>
                  set('cleaningToleranceMinutes', numberField(event.target.value, 0))
                }
              />
              <span className="field-hint">
                예정 시각에서 이만큼 넘어가면 지연으로 봅니다. 0 이면 1분만 늦어도 지연입니다.
              </span>
            </div>
            <div className="field">
              <label htmlFor="st-telemetry-stale">미수신 경보 임계 (분)</label>
              <input
                className="control num"
                id="st-telemetry-stale"
                inputMode="numeric"
                value={String(draft.telemetryStaleMinutes)}
                onChange={(event) =>
                  set('telemetryStaleMinutes', numberField(event.target.value, 0))
                }
              />
              <span className="field-hint">진단의 미수신 차량 목록 기준입니다.</span>
            </div>
            <div className="field">
              <label htmlFor="st-maint">정비 임박 임계 (%)</label>
              <input
                className="control num"
                id="st-maint"
                inputMode="numeric"
                value={String(draft.maintenanceSoonPercent)}
                onChange={(event) =>
                  set('maintenanceSoonPercent', numberField(event.target.value, 0))
                }
              />
              <span className="field-hint">
                <b>새로 추가하는 품목의 기본값</b>입니다. 이미 있는 품목은 각자의 임계를 그대로
                씁니다 — 설정 한 번으로 품목별 기준이 날아가면 안 됩니다.
              </span>
            </div>
          </div>
          {problems.length > 0 && (
            <p className="error-state" role="alert" style={{ marginTop: 'var(--space-4)' }}>
              <b>저장할 수 없습니다</b>
              {problems.map((problem) => problem.text).join(' ')}
            </p>
          )}
        </section>

        <section className="page-panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">텔레메트리</div>
              <p className="panel-sub">수집을 끄면 관제 위치도 갱신되지 않습니다</p>
            </div>
          </div>
          <div className="check-list">
            <ToggleRow
              name="수집"
              meta="차량 위치·배터리를 주기적으로 받습니다."
              on={draft.telemetryEnabled}
              onToggle={() => set('telemetryEnabled', !draft.telemetryEnabled)}
            />
          </div>
          <div className="form-grid" style={{ marginTop: 'var(--space-4)' }}>
            <div className="field">
              <label htmlFor="st-interval">수집 주기 (초)</label>
              <input
                className="control num"
                id="st-interval"
                inputMode="numeric"
                disabled={!draft.telemetryEnabled}
                value={String(draft.telemetryIntervalSeconds)}
                onChange={(event) =>
                  set('telemetryIntervalSeconds', numberField(event.target.value, 0))
                }
              />
              <span className="field-hint">
                {problemOf('telemetryIntervalSeconds') ??
                  '짧게 잡으면 위치가 정확해지지만 단말 배터리와 수집 비용이 올라갑니다.'}
              </span>
            </div>
          </div>
        </section>

        <section className="page-panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">단말 연동</div>
              <p className="panel-sub">OTOPLUG observer</p>
            </div>
          </div>
          <div className="check-list">
            <ToggleRow
              name="observer 연동"
              meta="외부 단말 API 에서 이벤트를 받아옵니다."
              on={draft.deviceObserverEnabled}
              onToggle={() => set('deviceObserverEnabled', !draft.deviceObserverEnabled)}
            />
          </div>
          <div className="form-grid" style={{ marginTop: 'var(--space-4)' }}>
            <div className="field is-wide">
              <label htmlFor="st-endpoint">observer 주소</label>
              <input
                className="control"
                id="st-endpoint"
                disabled={!draft.deviceObserverEnabled}
                value={draft.deviceObserverEndpoint}
                onChange={(event) => set('deviceObserverEndpoint', event.target.value)}
              />
              <span className="field-hint">
                {problemOf('deviceObserverEndpoint') ??
                  'https 만 받습니다. 인증 키는 여기서 다루지 않습니다 — 서버 환경변수에만 둡니다.'}
              </span>
            </div>
          </div>
          <p className="inline-warn">
            <span aria-hidden="true">⚠</span>
            연동 키와 비밀값은 이 화면에 두지 않습니다. 관리자 웹에 보이는 값은 주소와 on/off 뿐이고
            키는 서버 환경변수에만 있습니다.
          </p>
        </section>

        <section className="page-panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">테마</div>
              <p className="panel-sub">액센트 색 · 라이트 한 세트</p>
            </div>
          </div>
          <div className="swatch-row" role="radiogroup" aria-label="액센트 색">
            {ACCENT_CHOICES.map((choice) => (
              <button
                key={choice.id}
                className="swatch"
                type="button"
                role="radio"
                aria-checked={draft.accentId === choice.id}
                onClick={() => set('accentId', choice.id)}
                title={choice.label}
              >
                <span className="swatch-dot" style={{ background: choice.base }} aria-hidden="true" />
                <span className="swatch-name">{choice.label}</span>
              </button>
            ))}
          </div>
          <p className="sub" style={{ marginTop: 12 }}>
            다크모드는 두지 않습니다. 흰 표면 + 검정 텍스트를 기본으로 하므로 액센트도 라이트 한
            세트만 받습니다. 클리닝·정비 모드의 보조색은 모드 고유값이라 이 설정을 따르지 않습니다.
          </p>
          <p className="sub">
            권역 색은 여기가 아니라 <b>관리 → 권역</b>이 소유합니다. 권역마다 다른 색이므로 전역
            설정 한 칸에 담을 수 없습니다.
          </p>
        </section>

        <section className="page-panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">관리자 계정</div>
              <p className="panel-sub">
                {apiConfig.mode === 'mock' ? 'mock 세션' : '로그인된 세션'}
              </p>
            </div>
          </div>

          <div className="form-grid">
            <div className="field">
              <label>비밀번호</label>
              <div className="readonly-value">백엔드 미구현</div>
              <span className="field-hint">
                비밀번호 변경은 백엔드 엔드포인트가 붙은 뒤에 엽니다. 지금 입력란만 만들어 두면
                바꿨다고 착각할 수 있어서 두지 않았습니다.
              </span>
            </div>
            <div className="field">
              <label>세션</label>
              <div className="readonly-value">httpOnly 쿠키</div>
              <span className="field-hint">
                토큰은 JS 가 읽지 않습니다. 그래서 로그인 여부도 저장값이 아니라 백엔드에 물어서
                판단합니다.
              </span>
            </div>
          </div>

          <div className="form-actions">
            <button className="btn is-danger" type="button" onClick={onSignOut}>
              로그아웃
            </button>
          </div>
        </section>
      </div>

      {changes.length > 0 && (
        <section className="page-panel" style={{ marginTop: 'var(--space-4)' }}>
          <div className="panel-head">
            <div>
              <div className="panel-title">저장하지 않은 변경</div>
              <p className="panel-sub">{changes.length}개 항목</p>
            </div>
            <button
              className="btn is-primary"
              type="button"
              disabled={problems.length > 0}
              onClick={onSave}
            >
              저장
            </button>
          </div>
          <div className="table-wrap">
            <table className="page-table" style={{ minWidth: 480 }}>
              <thead>
                <tr>
                  <th scope="col">항목</th>
                  <th scope="col">현재</th>
                  <th scope="col">바꿀 값</th>
                </tr>
              </thead>
              <tbody>
                {changes.map((change) => (
                  <tr key={change.label}>
                    <td>{change.label}</td>
                    <td className="sub">{change.before}</td>
                    <td>
                      <b>{change.after}</b>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="sub" style={{ marginTop: 10 }}>
            저장하면 감사 로그에 항목별로 남습니다. mock 이라 새로고침하면 기본값(
            {DEFAULT_SETTINGS.staleOrderMinutes}분 · {DEFAULT_SETTINGS.telemetryStaleMinutes}분)으로
            돌아갑니다.
          </p>
        </section>
      )}
    </main>
  );
}

function ToggleRow({
  name,
  meta,
  on,
  onToggle,
}: {
  name: string;
  meta: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`check-row${on ? ' checked' : ''}`}
      role="checkbox"
      aria-checked={on}
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(event) => {
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault();
          onToggle();
        }
      }}
    >
      <span className="check-box" aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={3.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 13l4 4L19 7" />
        </svg>
      </span>
      <div>
        <div className="check-name">{name}</div>
        <div className="check-meta">{meta}</div>
      </div>
      <span className={`chip is-mini ${on ? 'is-green' : 'is-gray'}`}>{on ? '사용' : '중지'}</span>
    </div>
  );
}
