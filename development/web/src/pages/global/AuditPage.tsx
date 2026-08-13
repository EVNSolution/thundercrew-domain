import { useMemo, useState } from 'react';
import {
  ACTION_LABEL,
  RANGE_LABEL,
  TARGET_LABEL,
  auditActors,
  withinRange,
  type AuditAction,
  type AuditRange,
  type AuditTargetKind,
} from '../../mock/audit-store';
import { useAuditStore } from '../../mock/useAuditStore';
import { useNow } from '../../mock/useOrderStore';

const TARGET_ORDER: readonly AuditTargetKind[] = [
  'VEHICLE',
  'RIDER',
  'CONTRACT',
  'EQUIPMENT',
  'ORDER',
  'RESERVATION',
  'MAINTENANCE_ITEM',
  'MAINTENANCE_RECORD',
  'SETTINGS',
];

const ACTION_ORDER: readonly AuditAction[] = [
  'CREATE',
  'UPDATE',
  'MOVE',
  'DELETE',
  'ASSIGN',
  'CANCEL',
  'COMPLETE',
];

/** 동작별 칩 색. 지우는 동작만 위험색을 쓴다. */
function actionChip(action: AuditAction): string {
  if (action === 'DELETE' || action === 'CANCEL') return 'is-risk';
  if (action === 'MOVE') return 'is-amber';
  if (action === 'CREATE' || action === 'ASSIGN') return 'is-blue';
  if (action === 'COMPLETE') return 'is-green';
  return 'is-gray';
}

function stamp(value: number, now: number): string {
  const sameDay = new Date(value).toDateString() === new Date(now).toDateString();
  return new Date(value).toLocaleString('ko-KR', {
    month: sameDay ? undefined : '2-digit',
    day: sameDay ? undefined : '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * 감사 — 운영자가 무엇을 바꿨나. 읽기 전용.
 *
 * 용도별로 나누지 않는다. 행위자가 관리자 계정이고 관리자에게는 용도가 없다.
 * 대상(차량·계약)에는 용도가 있으므로 **대상 용도는 컬럼으로 표시한다** (§13).
 */
export function AuditPage() {
  const { entries } = useAuditStore();
  const now = useNow(30_000);
  const [range, setRange] = useState<AuditRange>('WEEK');
  const [actor, setActor] = useState('ALL');
  const [target, setTarget] = useState<'ALL' | AuditTargetKind>('ALL');
  const [action, setAction] = useState<'ALL' | AuditAction>('ALL');

  const actors = useMemo(() => auditActors(entries), [entries]);

  const rows = useMemo(
    () =>
      entries.filter((entry) => {
        if (!withinRange(entry, range, now)) return false;
        if (actor !== 'ALL' && entry.actor !== actor) return false;
        if (target !== 'ALL' && entry.targetKind !== target) return false;
        if (action !== 'ALL' && entry.action !== action) return false;
        return true;
      }),
    [entries, range, actor, target, action, now],
  );

  // 어떤 종류의 대상을 몇 건 건드렸나. 표를 읽기 전에 성격을 먼저 보여준다.
  const byTarget = useMemo(() => {
    const counts = new Map<AuditTargetKind, number>();
    for (const entry of rows) {
      counts.set(entry.targetKind, (counts.get(entry.targetKind) ?? 0) + 1);
    }
    return TARGET_ORDER.filter((kind) => counts.has(kind)).map((kind) => ({
      kind,
      count: counts.get(kind) ?? 0,
    }));
  }, [rows]);

  const moveCount = rows.filter((entry) => entry.action === 'MOVE').length;
  const deleteCount = rows.filter(
    (entry) => entry.action === 'DELETE' || entry.action === 'CANCEL',
  ).length;

  const filtered = range !== 'WEEK' || actor !== 'ALL' || target !== 'ALL' || action !== 'ALL';

  return (
    <main className="page-content">
      <div className="page-hero">
        <div className="hero-titles">
          <h1>감사</h1>
          <p>운영자가 무엇을 바꿨는지 확인합니다.</p>
        </div>
        <div className="hero-tools">
          <span className="scope-tag is-neutral">읽기 전용</span>
          <button className="btn" type="button">
            내보내기
          </button>
        </div>
      </div>

      <div className="page-grid">
        <section className="page-panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">요약</div>
              <p className="panel-sub">{RANGE_LABEL[range]} 기준</p>
            </div>
          </div>
          <dl className="kpi-row">
            <div className="kpi-item">
              <dt>작업</dt>
              <dd>
                {rows.length}
                <small>건</small>
              </dd>
            </div>
            <div className="kpi-item">
              <dt>행위자</dt>
              <dd>
                {new Set(rows.map((entry) => entry.actor)).size}
                <small>명</small>
              </dd>
            </div>
            <div className="kpi-item">
              <dt>용도 이동</dt>
              <dd style={moveCount > 0 ? { color: 'var(--color-warning)' } : undefined}>
                {moveCount}
                <small>건</small>
              </dd>
            </div>
            <div className="kpi-item">
              <dt>삭제 · 취소</dt>
              <dd className={deleteCount > 0 ? 'delta-late' : ''}>
                {deleteCount}
                <small>건</small>
              </dd>
            </div>
          </dl>

          {byTarget.length > 0 && (
            <div className="filter-chips" style={{ marginTop: 'var(--space-4)' }}>
              {byTarget.map(({ kind, count }) => (
                <button
                  key={kind}
                  className="filter-chip"
                  type="button"
                  aria-pressed={target === kind}
                  onClick={() => setTarget(target === kind ? 'ALL' : kind)}
                >
                  {TARGET_LABEL[kind]}
                  <span className="num">{count}</span>
                </button>
              ))}
            </div>
          )}

          <p className="sub" style={{ marginTop: 12 }}>
            용도로 나누지 않습니다. 행위자는 관리자 계정이고 관리자에게는 용도가 없습니다. 대상
            차량·계약에는 용도가 있으므로 대상 용도만 컬럼으로 남깁니다.
          </p>
        </section>

        <section className="page-panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">작업 로그</div>
              <p className="panel-sub">
                {rows.length}건 · 최신순
                {filtered && ' · 필터 적용됨'}
              </p>
            </div>
            <div className="panel-tools">
              <div className="seg" role="group" aria-label="기간">
                {(['TODAY', 'WEEK', 'ALL'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={range === value}
                    onClick={() => setRange(value)}
                  >
                    {RANGE_LABEL[value]}
                  </button>
                ))}
              </div>
              <select
                className="control is-auto"
                aria-label="행위자"
                value={actor}
                onChange={(event) => setActor(event.target.value)}
              >
                <option value="ALL">전체 행위자</option>
                {actors.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <select
                className="control is-auto"
                aria-label="대상 종류"
                value={target}
                onChange={(event) => setTarget(event.target.value as 'ALL' | AuditTargetKind)}
              >
                <option value="ALL">전체 대상</option>
                {TARGET_ORDER.map((kind) => (
                  <option key={kind} value={kind}>
                    {TARGET_LABEL[kind]}
                  </option>
                ))}
              </select>
              <select
                className="control is-auto"
                aria-label="동작"
                value={action}
                onChange={(event) => setAction(event.target.value as 'ALL' | AuditAction)}
              >
                <option value="ALL">전체 동작</option>
                {ACTION_ORDER.map((value) => (
                  <option key={value} value={value}>
                    {ACTION_LABEL[value]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="empty-state">
              <b>해당하는 작업이 없습니다</b>
              기간을 전체로 넓히거나 필터를 지우세요.
            </div>
          ) : (
            <div className="table-wrap">
              <table className="page-table" style={{ minWidth: 860 }}>
                <thead>
                  <tr>
                    <th scope="col">시각</th>
                    <th scope="col">행위자</th>
                    <th scope="col">동작</th>
                    <th scope="col">대상</th>
                    <th scope="col">대상 용도</th>
                    <th scope="col">내용</th>
                    <th scope="col">변경 전 → 후</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((entry) => (
                    <tr key={entry.id}>
                      <td className="num">{stamp(entry.at, now)}</td>
                      <td>{entry.actor}</td>
                      <td>
                        <span className={`chip is-mini ${actionChip(entry.action)}`}>
                          {ACTION_LABEL[entry.action]}
                        </span>
                      </td>
                      <td>
                        <div>{entry.targetLabel}</div>
                        <div className="sub">{TARGET_LABEL[entry.targetKind]}</div>
                      </td>
                      <td>
                        {entry.targetPurpose === null ? (
                          <span className="sub">—</span>
                        ) : (
                          <span
                            className={`purpose-chip ${entry.targetPurpose === 'DELIVERY' ? 'is-delivery' : 'is-cleaning'}`}
                          >
                            {entry.targetPurpose === 'DELIVERY' ? '배송용' : '클린'}
                          </span>
                        )}
                      </td>
                      <td className="sub">{entry.summary}</td>
                      <td>
                        {entry.before === null && entry.after === null ? (
                          <span className="sub">—</span>
                        ) : (
                          <span className="sub">
                            {entry.before ?? '없음'} → <b>{entry.after ?? '없음'}</b>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="sub" style={{ marginTop: 10 }}>
            배송원이 스스로 잡은 주문과 현장 완료 처리는 여기 남지 않습니다. 그것은 운영자의 변경이
            아니라 업무 수행이라 각 업무의 이력 화면이 담당합니다. 거부된 동작도 남지 않습니다 —
            아무것도 바뀌지 않았기 때문입니다.
          </p>
        </section>
      </div>
    </main>
  );
}
