import { useMemo, useState } from 'react';
import { STALE_ORDER_THRESHOLD_MINUTES, ZONES } from '../../mock/delivery-control';
import {
  assignedOrders,
  claimOrder,
  clearMessage,
  completeOrder,
  idleRiders,
  poolOrders,
  poolWaitMinutes,
  registerOrder,
  RIDER_FLEET,
  returnOrder,
  waitingMinutes,
  withdrawOrder,
  type Order,
} from '../../mock/order-store';
import { useNow, useOrderStore } from '../../mock/useOrderStore';

type ModeFilter = 'ALL' | 'OFFER' | 'OPERATOR';

const EMPTY_FORM = { customerName: '', phone: '', address: '', zoneId: ZONES[0].id, memo: '' };

function clock(value: number | null): string {
  if (value === null) return '—';
  return new Date(value).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * 배송용 배차 — 주문 풀 모델.
 *
 * 운영자는 배정하지 않는다. 주문을 풀에 올리면 배송원이 잡는다.
 * 배송원은 동시에 1건만 잡을 수 있고, 잡은 주문을 풀로 반납할 수 있다
 * (docs/frontend/03-screen-feature-map.md §3.1).
 *
 * mock 모드에서는 배송원 쪽 동작(잡기·반납·완료)도 이 화면에서 눌러볼 수 있다.
 * 실제로는 모바일 앱에서 일어나는 일이라 해당 버튼에 "앱 동작"임을 표시한다.
 */
export function DeliveryDispatchPage() {
  const { orders, lastMessage } = useOrderStore();
  const now = useNow();
  const [modeFilter, setModeFilter] = useState<ModeFilter>('ALL');
  const [form, setForm] = useState(EMPTY_FORM);

  const pool = useMemo(() => poolOrders(orders), [orders]);
  const assigned = useMemo(() => assignedOrders(orders), [orders]);
  const idle = useMemo(() => idleRiders(orders), [orders]);

  const staleCount = pool.filter(
    (order) => waitingMinutes(order, now) >= STALE_ORDER_THRESHOLD_MINUTES,
  ).length;

  const filteredAssigned =
    modeFilter === 'ALL'
      ? assigned
      : assigned.filter((order) => order.assignmentMode === modeFilter);

  const doneCount = orders.filter((order) => order.status === 'DONE').length;
  const withdrawnCount = orders.filter((order) => order.status === 'WITHDRAWN').length;

  return (
    <main className="page-content">
      <div className="page-hero">
        <div className="hero-titles">
          <h1>배차</h1>
          <p>주문을 풀에 올리면 배송원이 잡습니다. 한 번에 한 건씩.</p>
        </div>
        <div className="hero-tools">
          <span className="scope-tag">배송용</span>
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
            onClick={clearMessage}
            style={{ marginLeft: 'auto' }}
          >
            닫기
          </button>
        </p>
      )}

      <div className="page-grid">
        {/* 1. 주문 등록 — 맨 위 */}
        <section className="page-panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">주문 등록</div>
              <p className="panel-sub">등록하면 바로 풀에 올라갑니다.</p>
            </div>
          </div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="o-name">고객명</label>
              <input
                className="control"
                id="o-name"
                placeholder="홍길동"
                value={form.customerName}
                onChange={(event) => setForm({ ...form, customerName: event.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="o-phone">연락처</label>
              <input
                className="control num"
                id="o-phone"
                placeholder="010-0000-0000"
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="o-zone">권역</label>
              <select
                className="control"
                id="o-zone"
                value={form.zoneId}
                onChange={(event) => setForm({ ...form, zoneId: event.target.value })}
              >
                {ZONES.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field is-wide">
              <label htmlFor="o-addr">배송지 주소</label>
              <input
                className="control"
                id="o-addr"
                placeholder="서울 강남구 …"
                value={form.address}
                onChange={(event) => setForm({ ...form, address: event.target.value })}
              />
            </div>
            <div className="field is-wide">
              <label htmlFor="o-memo">메모</label>
              <input
                className="control"
                id="o-memo"
                placeholder="문 앞, 부재 시 경비실 등"
                value={form.memo}
                onChange={(event) => setForm({ ...form, memo: event.target.value })}
              />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn" type="button" onClick={() => setForm(EMPTY_FORM)}>
              지우기
            </button>
            <button
              className="btn is-primary"
              type="button"
              onClick={() => {
                registerOrder(form);
                setForm(EMPTY_FORM);
              }}
            >
              풀에 올리기
            </button>
          </div>
        </section>

        {/* 2. 미배정 주문 풀 */}
        <section className={`page-panel${staleCount > 0 ? ' is-alert' : ''}`}>
          <div className="panel-head">
            <div>
              <div className="panel-title">미배정 주문</div>
              <p className="panel-sub">
                {pool.length}건 · {STALE_ORDER_THRESHOLD_MINUTES}분 초과 {staleCount}건
              </p>
            </div>
            {staleCount > 0 && (
              <span className="chip is-amber">
                <span className="chip-dot" aria-hidden="true" />방치 {staleCount}건
              </span>
            )}
          </div>

          {pool.length === 0 ? (
            <div className="empty-state">
              <b>풀이 비어 있습니다</b>
              위에서 주문을 등록하면 여기에 올라가고, 배송원이 잡을 수 있습니다.
            </div>
          ) : (
            <div className="table-wrap">
              <table className="page-table">
                <thead>
                  <tr>
                    <th scope="col">경과</th>
                    <th scope="col">고객</th>
                    <th scope="col">주소</th>
                    <th scope="col">권역</th>
                    <th scope="col">반납</th>
                    <th scope="col">동작</th>
                  </tr>
                </thead>
                <tbody>
                  {pool.map((order) => (
                    <PoolRow key={order.id} order={order} now={now} />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {staleCount > 0 && (
            <p className="inline-warn">
              <span aria-hidden="true">⚠</span>
              {STALE_ORDER_THRESHOLD_MINUTES}분 넘게 아무도 잡지 않은 주문이 {staleCount}건입니다.
              임계는 설정에서 조정합니다.
            </p>
          )}

          <p className="sub" style={{ marginTop: 10 }}>
            {idle.length > 0
              ? `지금 잡을 수 있는 배송원 ${idle.length}명 — ${idle
                  .map((rider) => `${rider.riderName}(${rider.plateNumber})`)
                  .join(', ')}`
              : '모든 배송원이 주문을 하나씩 잡고 있습니다. 새로 잡을 수 있는 배송원이 없습니다.'}
          </p>
        </section>

        {/* 3. 잡힌 주문 — 배송원당 1건이므로 행 하나가 배송원 하나 */}
        <section className="page-panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">잡힌 주문</div>
              <p className="panel-sub">
                진행 중 {assigned.length}건 · 배송원당 1건 · 전체 배송원 {RIDER_FLEET.length}명
              </p>
            </div>
            <div className="seg" role="group" aria-label="잡은 경로 필터">
              {(
                [
                  ['ALL', '전체'],
                  ['OFFER', '배송원이 잡음'],
                  ['OPERATOR', '운영자 지정'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={modeFilter === value}
                  onClick={() => setModeFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {filteredAssigned.length === 0 ? (
            <div className="empty-state">
              <b>{assigned.length === 0 ? '진행 중인 주문이 없습니다' : '해당하는 주문이 없습니다'}</b>
              {assigned.length === 0
                ? '풀에서 배송원이 주문을 잡으면 여기에 나타납니다.'
                : `필터를 전체로 바꾸면 진행 중인 ${assigned.length}건을 볼 수 있습니다.`}
            </div>
          ) : (
            <div className="table-wrap">
              <table className="page-table" style={{ minWidth: 760 }}>
                <thead>
                  <tr>
                    <th scope="col">잡은 시각</th>
                    <th scope="col">풀 대기</th>
                    <th scope="col">차량</th>
                    <th scope="col">배송원</th>
                    <th scope="col">주소</th>
                    <th scope="col">경로</th>
                    <th scope="col">반납</th>
                    <th scope="col">앱 동작</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssigned.map((order) => {
                    const rider = RIDER_FLEET.find(
                      (candidate) => candidate.bikeId === order.assignedBikeId,
                    );
                    const wait = poolWaitMinutes(order);
                    return (
                      <tr key={order.id}>
                        <td className="num">{clock(order.claimedAt)}</td>
                        <td
                          className={`num${wait >= STALE_ORDER_THRESHOLD_MINUTES ? ' delta-late' : ''}`}
                        >
                          {wait}분
                        </td>
                        <td className="plate">{rider?.plateNumber ?? '—'}</td>
                        <td>{rider?.riderName ?? '—'}</td>
                        <td>{order.address}</td>
                        <td>
                          <span
                            className={`chip is-mini ${order.assignmentMode === 'OFFER' ? 'is-blue' : 'is-gray'}`}
                          >
                            {order.assignmentMode === 'OFFER' ? '배송원' : '운영자'}
                          </span>
                        </td>
                        <td>
                          {order.returnCount > 0 ? (
                            <span className="chip is-amber is-mini num">{order.returnCount}회</span>
                          ) : (
                            <span className="sub">—</span>
                          )}
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button
                            className="btn is-small"
                            type="button"
                            onClick={() => returnOrder(order.id)}
                          >
                            반납
                          </button>{' '}
                          <button
                            className="btn is-small"
                            type="button"
                            onClick={() => completeOrder(order.id)}
                          >
                            완료
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <p className="sub" style={{ marginTop: 10 }}>
            반납·완료는 실제로는 모바일 앱에서 배송원이 하는 동작입니다. mock 모드에서 흐름을
            눌러볼 수 있도록 여기에 뒀습니다. 반납하면 풀로 돌아가고 경과 시간이 0분부터 다시
            셉니다.
          </p>
          {(doneCount > 0 || withdrawnCount > 0) && (
            <p className="sub" style={{ marginTop: 6 }}>
              이번 세션에서 완료 {doneCount}건 · 회수 {withdrawnCount}건. 완료 건은 이력 화면에서
              봅니다.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

/**
 * 풀 한 행. 유휴 배송원 목록은 스토어에서 직접 읽는다.
 * 같은 값을 prop 과 스토어 두 곳에서 받으면 렌더 시점에 따라 어긋난다.
 */
function PoolRow({ order, now }: { order: Order; now: number }) {
  const [target, setTarget] = useState('');
  const { orders } = useOrderStore();
  const idle = idleRiders(orders);
  const waiting = waitingMinutes(order, now);
  const stale = waiting >= STALE_ORDER_THRESHOLD_MINUTES;
  const zoneName = ZONES.find((zone) => zone.id === order.zoneId)?.name ?? '미지정';

  return (
    <tr className={stale ? 'is-stale' : undefined}>
      <td className={`num${stale ? ' delta-late' : ''}`}>{waiting}분</td>
      <td>{order.customerName}</td>
      <td>{order.address}</td>
      <td>{zoneName}</td>
      <td>
        {order.returnCount > 0 ? (
          <span className="chip is-amber is-mini num">{order.returnCount}회</span>
        ) : (
          <span className="sub">—</span>
        )}
      </td>
      <td style={{ whiteSpace: 'nowrap' }}>
        <select
          className="control is-auto"
          aria-label={`${order.customerName} 주문을 배정할 배송원`}
          value={target}
          onChange={(event) => setTarget(event.target.value)}
          style={{ minHeight: 'var(--control-height-small)', fontSize: 12, marginRight: 6 }}
          disabled={idle.length === 0}
        >
          <option value="">배송원 선택</option>
          {idle.map((rider) => (
            <option key={rider.bikeId} value={rider.bikeId}>
              {rider.riderName}
            </option>
          ))}
        </select>
        <button
          className="btn is-small"
          type="button"
          disabled={!target}
          title={target ? undefined : '배송원을 먼저 고르세요'}
          onClick={() => {
            // 방치 주문은 운영자 지정, 그 외는 배송원이 스스로 잡은 것으로 기록한다.
            claimOrder(order.id, target, stale ? 'OPERATOR' : 'OFFER');
            setTarget('');
          }}
        >
          {stale ? '직접 배정' : '잡기'}
        </button>{' '}
        <button className="btn is-small" type="button" onClick={() => withdrawOrder(order.id)}>
          회수
        </button>
      </td>
    </tr>
  );
}
