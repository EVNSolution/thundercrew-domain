import { findMenuItem, MODES, type ModeId, type ScreenId } from '../app-modes';
import { resolveScreenPlan } from './plan';

/**
 * 화면 껍데기.
 *
 * 슬라이스 1 의 산출물이다. 레이아웃·제목·패널 구성과 각 패널이 읽을 데이터
 * 출처를 보여주고, 아직 정해지지 않은 것을 그 화면 안에서 밝힌다.
 * 빈 상태는 이유와 다음 행동을 작업 영역 안에서 설명한다(DSV DESIGN.md).
 */
export function ScreenShell({ mode, screen }: { mode: ModeId; screen: ScreenId }) {
  const item = findMenuItem(screen, mode);
  const plan = resolveScreenPlan(mode, screen);
  const isGlobal = screen === 'audit' || screen === 'diagnostics' || screen === 'settings';
  const scopeLabel = isGlobal ? '전역' : MODES[mode].label;

  return (
    <main className="page-content">
      <div className="page-hero">
        <div className="hero-titles">
          <h1>{item?.label ?? screen}</h1>
          <p>{item?.description ?? ''}</p>
        </div>
        <div className="hero-tools">
          <span className={`scope-tag${isGlobal ? ' is-neutral' : ''}`}>{scopeLabel}</span>
        </div>
      </div>

      {!plan ? (
        <div className="empty-state">
          <b>계획이 없는 화면입니다</b>
          docs/frontend/03-screen-feature-map.md 에 이 화면의 패널 구성을 먼저 정의해야 합니다.
        </div>
      ) : (
        <div className="page-grid">
          <section className="page-panel">
            <div className="panel-head">
              <div>
                <div className="panel-title">패널 구성</div>
                <p className="panel-sub">
                  레이아웃 {plan.panels[0]?.layout ?? '—'} · {plan.panels.length}개 영역
                </p>
              </div>
              <span className="chip is-gray">껍데기</span>
            </div>
            <div className="table-wrap">
              <table className="page-table">
                <thead>
                  <tr>
                    <th scope="col">영역</th>
                    <th scope="col">내용</th>
                    <th scope="col">데이터 출처</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.panels.map((panel) => (
                    <tr key={panel.title}>
                      <td style={{ fontWeight: 800, whiteSpace: 'nowrap' }}>{panel.title}</td>
                      <td>{panel.note}</td>
                      <td className="sub">{panel.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {plan.open.length > 0 && (
            <section className="page-panel is-alert">
              <div className="panel-head">
                <div>
                  <div className="panel-title">이 화면의 미결 항목</div>
                  <p className="panel-sub">QA 중 판단이 필요한 지점입니다.</p>
                </div>
                <span className="chip is-amber">{plan.open.length}건</span>
              </div>
              <ul style={{ display: 'grid', gap: 8 }}>
                {plan.open.map((question) => (
                  <li
                    key={question}
                    style={{
                      padding: '9px 12px',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-control)',
                      fontSize: 13,
                    }}
                  >
                    {question}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
