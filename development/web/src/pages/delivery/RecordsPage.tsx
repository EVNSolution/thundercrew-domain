import { useMemo, useState } from 'react';
import { STALE_ORDER_THRESHOLD_MINUTES, ZONES } from '../../mock/delivery-control';
import {
  deliveryMinutes,
  doneOrders,
  findOrder,
  poolWaitMinutes,
  poolWaitStats,
  RIDER_FLEET,
  withdrawnOrders,
  type Order,
} from '../../mock/order-store';
import { useOrderStore } from '../../mock/useOrderStore';

type Tab = 'DONE' | 'WITHDRAWN';

function clock(value: number | null): string {
  if (value === null) return '—';
  return new Date(value).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function riderOf(order: Order) {
  return RIDER_FLEET.find((rider) => rider.bikeId === order.assignedBikeId);
}

/**
 * 배송용 이력.
 *
 * 순서 컬럼이 없다. 대신 **등록 → 잡힘 → 완료** 세 시각과 그 간격이 운영
 * 지표가 된다 (docs/frontend/03-screen-feature-map.md §4).
 *
 * 풀 대기 시간(등록 또는 마지막 반납 → 잡힘)이 풀 모델의 핵심 지표다.
 * 이 값이 크면 배송원이 부족하거나 주문이 몰린 것이다.
 */
export function DeliveryRecordsPage() {
  const { orders } = useOrderStore();
  const [tab, setTab] = useState<Tab>('DONE');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const done = useMemo(() => doneOrders(orders), [orders]);
  const withdrawn = useMemo(() => withdrawnOrders(orders), [orders]);
  const stats = useMemo(
    () => poolWaitStats(orders, STALE_ORDER_THRESHOLD_MINUTES),
    [orders],
  );

  const rows = tab === 'DONE' ? done : withdrawn;
  const selected = findOrder(orders, selectedId) ?? rows[0] ?? null;

  return (
    <main className="page-content">
      <div className="page-hero">
        <div className="hero-titles">
          <h1>이력</h1>
          <p>완료된 배송과 증빙을 확인합니다.</p>
        </div>
        <div className="hero-tools">
          <span className="scope-tag">배송용</span>
          <button className="btn" type="button">
            내보내기
          </button>
        </div>
      </div>

      <div className="page-grid">
        {/* 풀 대기 지표 — 풀 모델의 핵심 */}
        <section className="page-panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">풀 대기 시간</div>
              <p className="panel-sub">
                등록(또는 마지막 반납)에서 잡힘까지 · 잡힌 이력 {stats.sampleCount}건 기준
              </p>
            </div>
          </div>
          {stats.sampleCount === 0 ? (
            <div className="empty-state">
              <b>아직 잡힌 주문이 없습니다</b>
              배차 화면에서 주문이 잡히면 대기 시간이 집계됩니다.
            </div>
          ) : (
            <dl className="kpi-row">
              <div className="kpi-item">
                <dt>평균 대기</dt>
                <dd>
                  {stats.averageMinutes}
                  <small>분</small>
                </dd>
              </div>
              <div className="kpi-item">
                <dt>최대 대기</dt>
                <dd className={stats.maxMinutes >= STALE_ORDER_THRESHOLD_MINUTES ? 'delta-late' : ''}>
                  {stats.maxMinutes}
                  <small>분</small>
                </dd>
              </div>
              <div className="kpi-item">
                <dt>방치 발생</dt>
                <dd className={stats.staleCount > 0 ? 'delta-late' : ''}>
                  {stats.staleCount}
                  <small>건</small>
                </dd>
              </div>
              <div className="kpi-item">
                <dt>운영자 지정</dt>
                <dd>
                  {stats.operatorAssignedCount}
                  <small>건</small>
                </dd>
              </div>
            </dl>
          )}
          <p className="sub" style={{ marginTop: 12 }}>
            방치 발생과 운영자 지정이 늘면 풀이 스스로 돌지 못한다는 뜻입니다. 배송원 수나 주문
            분포를 봐야 합니다.
          </p>
        </section>

        <div className="master-tabs" role="group" aria-label="이력 종류">
          <button
            className="master-tab"
            type="button"
            aria-pressed={tab === 'DONE'}
            onClick={() => {
              setTab('DONE');
              setSelectedId(null);
            }}
          >
            완료 배송 {done.length}
          </button>
          <button
            className="master-tab"
            type="button"
            aria-pressed={tab === 'WITHDRAWN'}
            onClick={() => {
              setTab('WITHDRAWN');
              setSelectedId(null);
            }}
          >
            회수된 주문 {withdrawn.length}
          </button>
        </div>

        <div className="master-detail-grid">
          <section className="page-panel">
            <div className="panel-head">
              <div>
                <div className="panel-title">{tab === 'DONE' ? '완료 배송' : '회수된 주문'}</div>
                <p className="panel-sub">{rows.length}건</p>
              </div>
            </div>

            {rows.length === 0 ? (
              <div className="empty-state">
                <b>
                  {tab === 'DONE' ? '완료된 배송이 없습니다' : '회수된 주문이 없습니다'}
                </b>
                {tab === 'DONE'
                  ? '배차 화면에서 잡힌 주문을 완료하면 여기에 쌓입니다.'
                  : '풀에 잘못 올린 주문을 회수하면 여기에 남습니다.'}
              </div>
            ) : (
              <div className="table-wrap">
                <table className="page-table" style={{ minWidth: 460 }}>
                  <thead>
                    {tab === 'DONE' ? (
                      <tr>
                        <th scope="col">완료</th>
                        <th scope="col">풀 대기</th>
                        <th scope="col">차량</th>
                        <th scope="col">배송원</th>
                        <th scope="col">주소</th>
                        <th scope="col">증빙</th>
                      </tr>
                    ) : (
                      <tr>
                        <th scope="col">등록</th>
                        <th scope="col">고객</th>
                        <th scope="col">주소</th>
                        <th scope="col">메모</th>
                      </tr>
                    )}
                  </thead>
                  <tbody>
                    {rows.map((order) => {
                      const rider = riderOf(order);
                      const wait = poolWaitMinutes(order);
                      const isSelected = selected?.id === order.id;
                      return (
                        <tr
                          key={order.id}
                          className="is-selectable"
                          aria-selected={isSelected}
                          onClick={() => setSelectedId(order.id)}
                        >
                          {tab === 'DONE' ? (
                            <>
                              <td className="num">{clock(order.completedAt).slice(0, 5)}</td>
                              <td
                                className={`num${wait >= STALE_ORDER_THRESHOLD_MINUTES ? ' delta-late' : ''}`}
                              >
                                {wait}분
                              </td>
                              <td className="plate">{rider?.plateNumber ?? '—'}</td>
                              <td>{rider?.riderName ?? '—'}</td>
                              <td>{order.address}</td>
                              <td>
                                {order.hasProofPhoto ? (
                                  <span className="chip is-green is-mini">사진</span>
                                ) : (
                                  <span className="chip is-gray is-mini">없음</span>
                                )}
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="num">{clock(order.registeredAt).slice(0, 5)}</td>
                              <td>{order.customerName}</td>
                              <td>{order.address}</td>
                              <td className="sub">{order.memo || '—'}</td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="page-panel">
            {!selected ? (
              <div className="empty-state">
                <b>선택된 주문이 없습니다</b>
                왼쪽 목록에서 한 건을 고르면 세 시각과 간격을 봅니다.
              </div>
            ) : (
              <OrderDetail order={selected} />
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function OrderDetail({ order }: { order: Order }) {
  const rider = riderOf(order);
  const zoneName = ZONES.find((zone) => zone.id === order.zoneId)?.name ?? '미지정';
  const wait = poolWaitMinutes(order);
  const delivery = deliveryMinutes(order);
  const total =
    order.completedAt !== null
      ? Math.max(0, Math.floor((order.completedAt - order.registeredAt) / 60_000))
      : null;

  return (
    <>
      <div className="panel-head">
        <div>
          <div className="panel-title">{order.address}</div>
          <p className="panel-sub">
            {order.customerName}
            {order.phone ? ` · ${order.phone}` : ''} · {zoneName}
          </p>
        </div>
        <span className={`chip ${order.status === 'DONE' ? 'is-gray' : 'is-risk'}`}>
          {order.status === 'DONE' ? '완료' : '회수'}
        </span>
      </div>

      {/* 순서가 없으므로 세 시각과 간격이 지표다. */}
      <dl className="detail-list">
        <div className="detail-row">
          <dt>등록</dt>
          <dd className="num">{clock(order.registeredAt)}</dd>
        </div>
        {order.returnCount > 0 && (
          <div className="detail-row">
            <dt>마지막 반납</dt>
            <dd className="num">
              {clock(order.returnedAt)}{' '}
              <span className="chip is-amber is-mini num">{order.returnCount}회</span>
            </dd>
          </div>
        )}
        <div className="detail-row">
          <dt>잡힘</dt>
          <dd className="num">
            {clock(order.claimedAt)}
            {order.claimedAt !== null && (
              <span className={`sub${wait >= STALE_ORDER_THRESHOLD_MINUTES ? ' delta-late' : ''}`}>
                {' '}
                (풀 대기 {wait}분)
              </span>
            )}
          </dd>
        </div>
        <div className="detail-row">
          <dt>완료</dt>
          <dd className="num">
            {clock(order.completedAt)}
            {delivery !== null && <span className="sub"> (배송 {delivery}분)</span>}
          </dd>
        </div>
        {total !== null && (
          <div className="detail-row">
            <dt>총 소요</dt>
            <dd className="num">{total}분</dd>
          </div>
        )}
        <div className="detail-row">
          <dt>차량</dt>
          <dd className="plate">{rider?.plateNumber ?? '—'}</dd>
        </div>
        <div className="detail-row">
          <dt>배송원</dt>
          <dd>{rider?.riderName ?? '—'}</dd>
        </div>
        <div className="detail-row">
          <dt>잡은 경로</dt>
          <dd>
            {order.assignmentMode === null ? (
              <span className="sub">잡히지 않음</span>
            ) : (
              <span
                className={`chip is-mini ${order.assignmentMode === 'OFFER' ? 'is-blue' : 'is-gray'}`}
              >
                {order.assignmentMode === 'OFFER' ? '배송원이 잡음' : '운영자 지정'}
              </span>
            )}
          </dd>
        </div>
        {order.memo && (
          <div className="detail-row">
            <dt>메모</dt>
            <dd>{order.memo}</dd>
          </div>
        )}
      </dl>

      <div className="panel-head" style={{ margin: 'var(--space-4) 0 8px' }}>
        <span className="panel-title">완료 증빙</span>
      </div>
      {order.hasProofPhoto ? (
        <div className="empty-state">
          <b>사진 1장</b>
          mock 모드에서는 이미지를 표시하지 않습니다. remote 모드에서{' '}
          <code>GET /dispatch-orders/{order.id}/completion-photo</code> 로 받습니다.
        </div>
      ) : (
        <div className="empty-state">
          <b>증빙이 없습니다</b>
          {order.status === 'DONE'
            ? '완료 처리는 됐지만 사진이 올라오지 않았습니다. 앱에서 업로드가 실패했을 수 있습니다.'
            : '회수된 주문은 배송되지 않아 증빙이 없습니다.'}
        </div>
      )}
    </>
  );
}
