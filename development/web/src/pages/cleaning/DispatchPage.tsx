import { useMemo, useState } from 'react';
import { ZONES } from '../../mock/delivery-control';
import {
  bySchedule,
  clearCleaningMessage,
  clockOf,
  CLEANING_FLEET,
  completeReservation,
  deviationMinutes,
  findConflicts,
  isDelayed,
  markArrived,
  METHOD_LABEL,
  notifyCustomer,
  registerSequential,
  ROUND_STAGE_LABEL,
  shiftSchedule,
  visitOrder,
  type Reservation,
  type StopInput,
} from '../../mock/cleaning-store';
import { useCleaningStore } from '../../mock/useCleaningStore';
import { useNow } from '../../mock/useOrderStore';

const EMPTY_STOP: StopInput = { time: '', estimatedMinutes: 40, address: '' };

/**
 * 클리닝 배차 — 시간 예약.
 *
 * 배송과 다르다. 운영자가 예정 시각을 지정하고, **예정 시각순이 방문 순서**다.
 * 순서를 손으로 매기지 않으므로 순서 칸은 읽기 전용 표시다 (§7.1).
 * 같은 차량의 시간 구간이 겹치면 차단하지 않고 경고한다 (§7.3).
 */
export function CleaningDispatchPage() {
  const { reservations, lastMessage } = useCleaningStore();
  const now = useNow();
  const [bikeId, setBikeId] = useState(CLEANING_FLEET[0].bikeId);
  const [customerName, setCustomerName] = useState('');
  const [zoneId, setZoneId] = useState(ZONES[0].id);
  const [notify, setNotify] = useState(true);
  const [stops, setStops] = useState<StopInput[]>([{ ...EMPTY_STOP, time: '15:00' }]);

  const today = useMemo(() => bySchedule(reservations), [reservations]);
  const delayedCount = today.filter((entry) => isDelayed(entry, now)).length;

  // 입력 중인 지점들을 예정 시각순으로 미리 정렬해 순서를 보여준다.
  const previewOrder = useMemo(() => {
    return stops
      .map((stop, index) => ({ stop, index }))
      .filter((entry) => entry.stop.time)
      .sort((a, b) => a.stop.time.localeCompare(b.stop.time))
      .reduce<Record<number, number>>((acc, entry, position) => {
        acc[entry.index] = position + 1;
        return acc;
      }, {});
  }, [stops]);

  // 입력 중인 지점들의 충돌을 미리 계산한다.
  const stopConflicts = useMemo(() => {
    return stops.map((stop) => {
      if (!stop.time || !stop.address.trim()) return [];
      const [hour, minute] = stop.time.split(':').map((part) => Number.parseInt(part, 10));
      const date = new Date();
      date.setHours(hour, minute, 0, 0);
      return findConflicts(reservations, {
        bikeId,
        scheduledAt: date.getTime(),
        estimatedMinutes: stop.estimatedMinutes,
      });
    });
  }, [stops, reservations, bikeId]);

  const conflictCount = stopConflicts.reduce((sum, list) => sum + list.length, 0);

  return (
    <main className="page-content">
      <div className="page-hero">
        <div className="hero-titles">
          <h1>배차</h1>
          <p>서비스 시각을 예약합니다. 예정 시각순이 방문 순서입니다.</p>
        </div>
        <div className="hero-tools">
          <span className="scope-tag">클린차량</span>
          <input
            className="control num is-auto"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            aria-label="예약 날짜"
          />
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
            onClick={clearCleaningMessage}
            style={{ marginLeft: 'auto' }}
          >
            닫기
          </button>
        </p>
      )}

      <div className="page-grid">
        {/* 순차 등록 — 시각이 순서를 정한다 */}
        <section className="page-panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">순차 등록</div>
              <p className="panel-sub">
                예정 시각순이 방문 순서가 됩니다. 순서를 따로 매기지 않습니다.
              </p>
            </div>
          </div>

          <div className="form-grid">
            <div className="field">
              <label htmlFor="c-bike">차량</label>
              <select
                className="control"
                id="c-bike"
                value={bikeId}
                onChange={(event) => setBikeId(event.target.value)}
              >
                {CLEANING_FLEET.map((entry) => (
                  <option key={entry.bikeId} value={entry.bikeId}>
                    {entry.plateNumber} · {entry.cleanerName}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="c-customer">고객</label>
              <input
                className="control"
                id="c-customer"
                placeholder="○○ 어린이집"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="c-zone">권역</label>
              <select
                className="control"
                id="c-zone"
                value={zoneId}
                onChange={(event) => setZoneId(event.target.value)}
              >
                {ZONES.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="c-notify">고객 알림</label>
              <select
                className="control"
                id="c-notify"
                value={notify ? 'on' : 'off'}
                onChange={(event) => setNotify(event.target.value === 'on')}
              >
                <option value="on">사이트 알람</option>
                <option value="off">발송 안 함</option>
              </select>
            </div>
          </div>

          <div className="panel-head" style={{ margin: 'var(--space-5) 0 8px' }}>
            <span className="panel-title">서비스 지점</span>
            <span className="sub">시각을 넣으면 자동으로 그 순서로 정렬됩니다</span>
          </div>

          <div className="slot-legend" aria-hidden="true">
            <span>순서</span>
            <span>예정 시각</span>
            <span>소요(분)</span>
            <span>서비스 지점 주소</span>
            <span />
          </div>
          <div className="slot-list">
            {stops.map((stop, index) => {
              const conflicts = stopConflicts[index] ?? [];
              return (
                <div key={index}>
                  <div className={`slot-row${conflicts.length > 0 ? ' is-conflict' : ''}`}>
                    <span className="slot-seq">{previewOrder[index] ?? '·'}</span>
                    <input
                      className="control num"
                      type="time"
                      value={stop.time}
                      aria-label={`${index + 1}번 예정 시각`}
                      onChange={(event) =>
                        setStops(
                          stops.map((entry, i) =>
                            i === index ? { ...entry, time: event.target.value } : entry,
                          ),
                        )
                      }
                    />
                    <input
                      className="control num"
                      type="number"
                      min={5}
                      step={5}
                      value={stop.estimatedMinutes}
                      aria-label={`${index + 1}번 예상 소요 분`}
                      onChange={(event) =>
                        setStops(
                          stops.map((entry, i) =>
                            i === index
                              ? {
                                  ...entry,
                                  estimatedMinutes: Number.parseInt(event.target.value, 10) || 5,
                                }
                              : entry,
                          ),
                        )
                      }
                    />
                    <input
                      className="control"
                      value={stop.address}
                      placeholder="서울 송파구 …"
                      aria-label={`${index + 1}번 서비스 지점 주소`}
                      onChange={(event) =>
                        setStops(
                          stops.map((entry, i) =>
                            i === index ? { ...entry, address: event.target.value } : entry,
                          ),
                        )
                      }
                    />
                    <button
                      className="btn is-small"
                      type="button"
                      aria-label={`${index + 1}번 지점 삭제`}
                      disabled={stops.length === 1}
                      onClick={() => setStops(stops.filter((_, i) => i !== index))}
                    >
                      삭제
                    </button>
                  </div>
                  {conflicts.map((conflict) => (
                    <p key={conflict.withId} className="inline-warn" style={{ marginTop: 4 }}>
                      <span aria-hidden="true">⚠</span>
                      {conflict.text}
                    </p>
                  ))}
                </div>
              );
            })}
          </div>

          <button
            className="btn is-small"
            type="button"
            style={{ marginTop: 10 }}
            onClick={() => setStops([...stops, { ...EMPTY_STOP }])}
          >
            지점 추가
          </button>

          {conflictCount > 0 && (
            <p className="inline-warn">
              <span aria-hidden="true">⚠</span>
              시간이 겹치는 지점이 {conflictCount}건입니다. 막지는 않으니 확인하고 등록하세요.
            </p>
          )}

          <div className="form-actions">
            <button
              className="btn"
              type="button"
              onClick={() => setStops([{ ...EMPTY_STOP, time: '15:00' }])}
            >
              지우기
            </button>
            <button
              className="btn is-primary"
              type="button"
              onClick={() => {
                registerSequential({ bikeId, customerName, zoneId, notify, stops });
                setStops([{ ...EMPTY_STOP, time: '15:00' }]);
                setCustomerName('');
              }}
            >
              순차 등록
            </button>
          </div>
        </section>

        {/* 오늘 예약 — 시간순 */}
        <section className={`page-panel${delayedCount > 0 ? ' is-alert' : ''}`}>
          <div className="panel-head">
            <div>
              <div className="panel-title">오늘 예약</div>
              <p className="panel-sub">
                {today.length}건 · 지연 {delayedCount}건
              </p>
            </div>
            {delayedCount > 0 && (
              <span className="chip is-risk">
                <span className="chip-dot" aria-hidden="true" />
                지연 {delayedCount}건
              </span>
            )}
          </div>

          {today.length === 0 ? (
            <div className="empty-state">
              <b>예약이 없습니다</b>
              위에서 지점과 시각을 넣어 예약하세요.
            </div>
          ) : (
            <div className="table-wrap">
              <table className="page-table" style={{ minWidth: 820 }}>
                <thead>
                  <tr>
                    <th scope="col">순서</th>
                    <th scope="col">예정</th>
                    <th scope="col">소요</th>
                    <th scope="col">차량</th>
                    <th scope="col">클리너</th>
                    <th scope="col">방식</th>
                    <th scope="col">서비스 지점</th>
                    <th scope="col">상태</th>
                    <th scope="col">앱 동작</th>
                  </tr>
                </thead>
                <tbody>
                  {today.map((entry) => (
                    <ReservationRow
                      key={entry.id}
                      reservation={entry}
                      reservations={reservations}
                      now={now}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="sub" style={{ marginTop: 10 }}>
            도착·완료는 실제로는 모바일 앱에서 클리너가 하는 동작입니다. 왕복은 수거를 완료하면
            배송 단계로 넘어갑니다. 지연이 뒤 예약을 밀어야 하면 "30분 미룸"으로 조정합니다.
          </p>
        </section>
      </div>
    </main>
  );
}

function ReservationRow({
  reservation,
  reservations,
  now,
}: {
  reservation: Reservation;
  reservations: readonly Reservation[];
  now: number;
}) {
  const order = visitOrder(reservations, reservation);
  const delayed = isDelayed(reservation, now);
  const deviation = deviationMinutes(reservation, now);
  const plate =
    CLEANING_FLEET.find((entry) => entry.bikeId === reservation.bikeId)?.plateNumber ?? '—';

  return (
    <tr className={delayed ? 'is-stale' : undefined}>
      <td>
        <span className="slot-seq">{order}</span>
      </td>
      <td className="num">{clockOf(reservation.scheduledAt)}</td>
      <td className="num">{reservation.estimatedMinutes}분</td>
      <td className="plate">{plate}</td>
      <td>{reservation.cleanerName}</td>
      <td>
        {METHOD_LABEL[reservation.method]}
        {reservation.roundStage && (
          <span className="chip is-mini is-gray" style={{ marginLeft: 4 }}>
            {ROUND_STAGE_LABEL[reservation.roundStage]}
          </span>
        )}
      </td>
      <td>
        {reservation.address}
        <div className="sub">{reservation.customerName}</div>
      </td>
      <td>
        {reservation.status === 'DONE' ? (
          <span className="chip is-gray">완료</span>
        ) : delayed ? (
          <span className="chip is-risk">
            <span className="chip-dot" aria-hidden="true" />
            {deviation}분 지연
          </span>
        ) : reservation.status === 'ACTIVE' ? (
          <span className="chip is-green">
            <span className="chip-dot" aria-hidden="true" />
            진행 중
          </span>
        ) : (
          <span className="chip is-blue">예약</span>
        )}
        {reservation.notifiedAt === null && reservation.status !== 'DONE' && (
          <div className="sub">알림 미발송</div>
        )}
      </td>
      <td style={{ whiteSpace: 'nowrap' }}>
        {reservation.status !== 'DONE' && reservation.arrivedAt === null && (
          <>
            <button
              className="btn is-small"
              type="button"
              onClick={() => markArrived(reservation.id)}
            >
              도착
            </button>{' '}
            <button
              className="btn is-small"
              type="button"
              onClick={() => shiftSchedule(reservation.id, 30)}
            >
              30분 미룸
            </button>
          </>
        )}
        {reservation.arrivedAt !== null && reservation.status !== 'DONE' && (
          <button
            className="btn is-small"
            type="button"
            onClick={() => completeReservation(reservation.id)}
          >
            {reservation.method === 'ROUND' && reservation.roundStage === 'COLLECT'
              ? '수거 완료'
              : '완료'}
          </button>
        )}
        {reservation.notifiedAt === null && reservation.status !== 'DONE' && (
          <>
            {' '}
            <button
              className="btn is-small"
              type="button"
              onClick={() => notifyCustomer(reservation.id)}
            >
              알림
            </button>
          </>
        )}
      </td>
    </tr>
  );
}
