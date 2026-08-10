import { useMemo, useState } from 'react';
import {
  ASSIGNED_ORDERS,
  IDLE_RIDERS,
  STALE_ORDER_THRESHOLD_MINUTES,
  UNASSIGNED_ORDERS,
  ZONES,
  type UnassignedOrder,
} from '../../mock/delivery-control';

type ModeFilter = 'ALL' | 'OFFER' | 'OPERATOR';

/**
 * 배송용 배차 — 주문 풀 모델.
 *
 * 운영자는 배정하지 않는다. 주문을 풀에 올리면 배송원이 잡는다.
 * 배송원은 동시에 1건만 잡을 수 있고, 잡은 주문을 풀로 반납할 수 있다
 * (docs/frontend/03-screen-feature-map.md §3.1).
 *
 * 주문 등록이 맨 위다. 운영자의 주 동작이 주문을 올리는 것이므로 등록 폼이
 * 아래 있으면 매번 스크롤해야 한다.
 */
export function DeliveryDispatchPage() {
  const [modeFilter, setModeFilter] = useState<ModeFilter>('ALL');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>('ord-1');

  const staleOrders = useMemo(
    () => UNASSIGNED_ORDERS.filter((order) => order.waitingMinutes >= STALE_ORDER_THRESHOLD_MINUTES),
    [],
  );

  const assigned = useMemo(
    () =>
      modeFilter === 'ALL'
        ? ASSIGNED_ORDERS
        : ASSIGNED_ORDERS.filter((row) => row.assignmentMode === modeFilter),
    [modeFilter],
  );

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
              <input className="control" id="o-name" placeholder="홍길동" />
            </div>
            <div className="field">
              <label htmlFor="o-phone">연락처</label>
              <input className="control num" id="o-phone" placeholder="010-0000-0000" />
            </div>
            <div className="field">
              <label htmlFor="o-zone">권역</label>
              <select className="control" id="o-zone" defaultValue={ZONES[0].name}>
                {ZONES.map((zone) => (
                  <option key={zone.id}>{zone.name}</option>
                ))}
              </select>
            </div>
            <div className="field is-wide">
              <label htmlFor="o-addr">배송지 주소</label>
              <input className="control" id="o-addr" placeholder="주소 검색" />
            </div>
            <div className="field is-wide">
              <label htmlFor="o-memo">메모</label>
              <input className="control" id="o-memo" placeholder="문 앞, 부재 시 경비실 등" />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn" type="button">
              지우기
            </button>
            <button className="btn is-primary" type="button">
              풀에 올리기
            </button>
          </div>
        </section>

        {/* 2. 미배정 주문 풀 */}
        <section className={`page-panel${staleOrders.length > 0 ? ' is-alert' : ''}`}>
          <div className="panel-head">
            <div>
              <div className="panel-title">미배정 주문</div>
              <p className="panel-sub">
                {UNASSIGNED_ORDERS.length}건 · {STALE_ORDER_THRESHOLD_MINUTES}분 초과{' '}
                {staleOrders.length}건
              </p>
            </div>
            {staleOrders.length > 0 && (
              <span className="chip is-amber">
                <span className="chip-dot" aria-hidden="true" />방치 {staleOrders.length}건
              </span>
            )}
          </div>
          <div className="table-wrap">
            <table className="page-table">
              <thead>
                <tr>
                  <th scope="col">경과</th>
                  <th scope="col">고객</th>
                  <th scope="col">주소</th>
                  <th scope="col">권역</th>
                  <th scope="col">반납</th>
                  <th scope="col" />
                </tr>
              </thead>
              <tbody>
                {UNASSIGNED_ORDERS.map((order) => (
                  <PoolRow
                    key={order.id}
                    order={order}
                    selected={order.id === selectedOrderId}
                    onSelect={() => setSelectedOrderId(order.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
          {staleOrders.length > 0 && (
            <p className="inline-warn">
              <span aria-hidden="true">⚠</span>
              {STALE_ORDER_THRESHOLD_MINUTES}분 넘게 아무도 잡지 않은 주문이 {staleOrders.length}
              건입니다. 임계는 설정에서 조정합니다.
            </p>
          )}
          {IDLE_RIDERS.length > 0 ? (
            <p className="sub" style={{ marginTop: 10 }}>
              지금 잡을 수 있는 배송원 {IDLE_RIDERS.length}명 —{' '}
              {IDLE_RIDERS.map((rider) => `${rider.riderName}(${rider.plateNumber})`).join(', ')}
            </p>
          ) : (
            <p className="sub" style={{ marginTop: 10 }}>
              모든 배송원이 주문을 하나씩 잡고 있습니다. 직접 배정할 대상이 없습니다.
            </p>
          )}
        </section>

        {/* 3. 잡힌 주문 — 배송원당 1건이므로 행 하나가 배송원 하나 */}
        <section className="page-panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">잡힌 주문</div>
              <p className="panel-sub">
                진행 중 {ASSIGNED_ORDERS.length}건 · 배송원당 1건
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
          <div className="table-wrap">
            <table className="page-table">
              <thead>
                <tr>
                  <th scope="col">잡은 시각</th>
                  <th scope="col">풀 대기</th>
                  <th scope="col">차량</th>
                  <th scope="col">배송원</th>
                  <th scope="col">주소</th>
                  <th scope="col">경로</th>
                  <th scope="col">반납</th>
                </tr>
              </thead>
              <tbody>
                {assigned.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="empty-state">
                        <b>해당하는 주문이 없습니다</b>
                        필터를 전체로 바꾸면 진행 중인 {ASSIGNED_ORDERS.length}건을 볼 수 있습니다.
                      </div>
                    </td>
                  </tr>
                ) : (
                  assigned.map((row) => (
                    <tr key={row.orderId}>
                      <td className="num">{row.claimedAt}</td>
                      <td className={`num${row.poolWaitMinutes >= STALE_ORDER_THRESHOLD_MINUTES ? ' delta-late' : ''}`}>
                        {row.poolWaitMinutes}분
                      </td>
                      <td className="plate">{row.plateNumber}</td>
                      <td>{row.riderName}</td>
                      <td>{row.address}</td>
                      <td>
                        <span
                          className={`chip is-mini ${row.assignmentMode === 'OFFER' ? 'is-blue' : 'is-gray'}`}
                        >
                          {row.assignmentMode === 'OFFER' ? '배송원' : '운영자'}
                        </span>
                      </td>
                      <td>
                        {row.returnCount > 0 ? (
                          <span className="chip is-amber is-mini num">{row.returnCount}회</span>
                        ) : (
                          <span className="sub">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="sub" style={{ marginTop: 10 }}>
            배송원이 잡은 주문을 반납하면 이 표에서 사라지고 미배정 주문으로 돌아갑니다. 경과
            시간은 최초 등록이 아니라 마지막 반납 시각부터 다시 셉니다.
          </p>
        </section>
      </div>
    </main>
  );
}

function PoolRow({
  order,
  selected,
  onSelect,
}: {
  order: UnassignedOrder;
  selected: boolean;
  onSelect: () => void;
}) {
  const stale = order.waitingMinutes >= STALE_ORDER_THRESHOLD_MINUTES;
  const zoneName = ZONES.find((zone) => zone.id === order.zoneId)?.name ?? '미지정';
  const canAssign = IDLE_RIDERS.length > 0;

  return (
    <tr
      className={`is-selectable${stale ? ' is-stale' : ''}`}
      aria-selected={selected}
      onClick={onSelect}
    >
      <td className={`num${stale ? ' delta-late' : ''}`}>{order.waitingMinutes}분</td>
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
      <td style={{ textAlign: 'right' }}>
        {stale ? (
          <button
            className="btn is-small"
            type="button"
            disabled={!canAssign}
            title={canAssign ? undefined : '잡을 수 있는 배송원이 없습니다'}
            onClick={(event) => event.stopPropagation()}
          >
            직접 배정
          </button>
        ) : (
          <button
            className="btn is-small"
            type="button"
            onClick={(event) => event.stopPropagation()}
          >
            회수
          </button>
        )}
      </td>
    </tr>
  );
}
