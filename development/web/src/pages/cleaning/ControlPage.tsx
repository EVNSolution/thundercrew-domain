import { useMemo, useState } from 'react';
import { MapCanvas, type MapMarkerSpec } from '../../components/MapCanvas';
import { STATIONS, ZONES, zoneById } from '../../mock/delivery-control';
import {
  bySchedule,
  CLEANING_FLEET,
  clockOf,
  completeReservation,
  deviationMinutes,
  isDelayed,
  markArrived,
  METHOD_LABEL,
  notifyCustomer,
  reservationsOfBike,
  ROUND_STAGE_LABEL,
  serviceMinutes,
  shiftSchedule,
  visitOrder,
  type Reservation,
} from '../../mock/cleaning-store';
import { useCleaningStore } from '../../mock/useCleaningStore';
import { useNow } from '../../mock/useOrderStore';

const SEOUL_CENTER = { lat: 37.5326, lng: 127.0246 };

/** 타임라인이 덮는 시간 범위. 현재 ±3시간 또는 오늘 전체. */
const RANGES = {
  NEAR: { label: '현재 ±3시간', beforeHours: 3, afterHours: 3 },
  DAY: { label: '오늘 전체', beforeHours: 0, afterHours: 0 },
} as const;
type RangeKey = keyof typeof RANGES;

function hourFloor(value: number): number {
  const date = new Date(value);
  date.setMinutes(0, 0, 0);
  return date.getTime();
}

/**
 * 클리닝 관제.
 *
 * 배송과 주 표현이 다르다. 배송은 위치가 핵심이라 지도가 주지만, 클리닝은
 * **예정 시각**이 핵심이라 타임라인이 주다 (§7). 15:30 예약 5건 중 어디가
 * 지연되는지가 차량 위치보다 먼저 읽혀야 한다.
 */
export function CleaningControlPage() {
  const { reservations } = useCleaningStore();
  const now = useNow(15_000);
  const [rangeKey, setRangeKey] = useState<RangeKey>('NEAR');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const range = RANGES[rangeKey];
  const { start, end, hours } = useMemo(() => {
    if (rangeKey === 'DAY') {
      const dayStart = new Date(now);
      dayStart.setHours(6, 0, 0, 0);
      const dayEnd = new Date(now);
      dayEnd.setHours(22, 0, 0, 0);
      return {
        start: dayStart.getTime(),
        end: dayEnd.getTime(),
        hours: 16,
      };
    }
    const from = hourFloor(now) - range.beforeHours * 3_600_000;
    const to = hourFloor(now) + (range.afterHours + 1) * 3_600_000;
    return { start: from, end: to, hours: range.beforeHours + range.afterHours + 1 };
  }, [now, rangeKey, range]);

  const span = end - start;
  const sorted = useMemo(() => bySchedule(reservations), [reservations]);

  const stats = useMemo(() => {
    const delayed = sorted.filter((entry) => isDelayed(entry, now)).length;
    return {
      total: sorted.length,
      active: sorted.filter((entry) => entry.status === 'ACTIVE').length,
      delayed,
      done: sorted.filter((entry) => entry.status === 'DONE').length,
    };
  }, [sorted, now]);

  const selected =
    sorted.find((entry) => entry.id === selectedId) ??
    sorted.find((entry) => isDelayed(entry, now)) ??
    sorted.find((entry) => entry.status === 'ACTIVE') ??
    sorted[0] ??
    null;

  const markers = useMemo<MapMarkerSpec[]>(() => {
    const vehiclePins: MapMarkerSpec[] = CLEANING_FLEET.map((bike) => {
      const own = reservationsOfBike(reservations, bike.bikeId);
      const current = own.find((entry) => entry.status === 'ACTIVE') ?? own[0];
      const delayed = current ? isDelayed(current, now) : false;
      return {
        id: bike.bikeId,
        lat: current?.position.lat ?? (zoneById(bike.zoneId)?.center.lat ?? SEOUL_CENTER.lat),
        lng: current?.position.lng ?? (zoneById(bike.zoneId)?.center.lng ?? SEOUL_CENTER.lng),
        label: bike.plateNumber,
        // 지연은 위험색. 그 외는 클리닝 보조색으로 배송용과 구분한다.
        color: delayed ? 'var(--color-risk)' : 'var(--color-cleaning)',
        kind: 'vehicle',
        selected: current?.id === selected?.id,
      };
    });

    const stationPins: MapMarkerSpec[] = STATIONS.map((station) => ({
      id: station.id,
      lat: station.position.lat,
      lng: station.position.lng,
      badge: String(station.batteryCount),
      label: station.name,
      color: 'var(--color-departure)',
      kind: 'station',
    }));

    return [...stationPins, ...vehiclePins];
  }, [reservations, now, selected]);

  return (
    <main className="page-content is-map">
      <section className="timeline-shell" aria-label="서비스 예정 타임라인">
        <div className="timeline-head">
          <dl className="kpi-row" style={{ gap: 'var(--space-5)' }}>
            <div className="kpi-item">
              <dt>오늘 예약</dt>
              <dd>{stats.total}</dd>
            </div>
            <div className="kpi-item">
              <dt>진행 중</dt>
              <dd>{stats.active}</dd>
            </div>
            <div className="kpi-item">
              <dt>지연</dt>
              <dd className={stats.delayed > 0 ? 'delta-late' : ''}>{stats.delayed}</dd>
            </div>
            <div className="kpi-item">
              <dt>완료</dt>
              <dd>{stats.done}</dd>
            </div>
          </dl>
          <div className="seg" role="group" aria-label="시간 범위">
            {(Object.keys(RANGES) as RangeKey[]).map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={rangeKey === key}
                onClick={() => setRangeKey(key)}
              >
                {RANGES[key].label}
              </button>
            ))}
          </div>
        </div>

        <div className="timeline-axis">
          <span />
          <div
            className="timeline-hours"
            style={{ gridTemplateColumns: `repeat(${hours}, 1fr)` }}
          >
            {Array.from({ length: hours }, (_, index) => (
              <span key={index}>{new Date(start + index * 3_600_000).getHours()}</span>
            ))}
          </div>
        </div>

        <div className="timeline-rows">
          {CLEANING_FLEET.map((bike) => {
            const own = reservationsOfBike(reservations, bike.bikeId);
            return (
              <div className="timeline-row" key={bike.bikeId}>
                <span className="timeline-name">
                  {bike.plateNumber}
                  <span className="sub"> · {bike.cleanerName}</span>
                </span>
                <div className="timeline-track">
                  {own.map((entry) => {
                    const left = ((entry.scheduledAt - start) / span) * 100;
                    const width = ((entry.estimatedMinutes * 60_000) / span) * 100;
                    if (left > 100 || left + width < 0) return null;
                    const delayed = isDelayed(entry, now);
                    const kind =
                      entry.status === 'DONE'
                        ? 'is-done'
                        : delayed
                          ? 'is-delayed'
                          : entry.status === 'ACTIVE'
                            ? 'is-active'
                            : 'is-reserved';
                    return (
                      <button
                        key={entry.id}
                        className={`timeline-block ${kind}${entry.id === selected?.id ? ' is-selected' : ''}`}
                        type="button"
                        style={{
                          left: `${Math.max(0, left)}%`,
                          width: `${Math.min(100 - Math.max(0, left), width)}%`,
                        }}
                        title={`${clockOf(entry.scheduledAt)} ${entry.address}`}
                        onClick={() => setSelectedId(entry.id)}
                      >
                        {entry.address}
                        {delayed ? ` · ${deviationMinutes(entry, now)}분 지연` : ''}
                      </button>
                    );
                  })}
                  <div
                    className="timeline-now"
                    style={{ left: `${Math.min(100, Math.max(0, ((now - start) / span) * 100))}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="map-card is-lower">
        <MapCanvas
          markers={markers}
          center={SEOUL_CENTER}
          onSelectMarker={(id) => {
            const own = reservationsOfBike(reservations, id);
            const current = own.find((entry) => entry.status === 'ACTIVE') ?? own[0];
            if (current) setSelectedId(current.id);
          }}
        />

        <div className="control-filters" role="group" aria-label="권역 표시">
          {ZONES.map((zone) => (
            <span key={zone.id} className="zone-chip" aria-hidden="true">
              <span className="zone-swatch" style={{ background: zone.color }} />
              {zone.name}
            </span>
          ))}
        </div>

        {selected && (
          <ReservationPanel reservation={selected} reservations={reservations} now={now} />
        )}
      </div>
    </main>
  );
}

function ReservationPanel({
  reservation,
  reservations,
  now,
}: {
  reservation: Reservation;
  reservations: readonly Reservation[];
  now: number;
}) {
  const delayed = isDelayed(reservation, now);
  const deviation = deviationMinutes(reservation, now);
  const plate =
    CLEANING_FLEET.find((entry) => entry.bikeId === reservation.bikeId)?.plateNumber ?? '—';
  const own = reservationsOfBike(reservations, reservation.bikeId);
  const remaining = own.filter((entry) => entry.status !== 'DONE' && entry.id !== reservation.id);
  const service = serviceMinutes(reservation);

  return (
    <aside className="control-panel" aria-label="예약 상세">
      <div className="control-panel-head">
        <div className="control-panel-title-row">
          <span className="control-panel-title plate">{plate}</span>
          {reservation.status === 'DONE' ? (
            <span className="chip is-gray">완료</span>
          ) : delayed ? (
            <span className="chip is-risk">
              <span className="chip-dot" aria-hidden="true" />
              {deviation}분 지연
            </span>
          ) : (
            <span className="chip is-green">
              <span className="chip-dot" aria-hidden="true" />
              {reservation.status === 'ACTIVE' ? '진행 중' : '예약'}
            </span>
          )}
        </div>
        <p className="sub" style={{ marginTop: 4 }}>
          {zoneById(reservation.zoneId)?.name ?? '미지정'} · {reservation.cleanerName} ·{' '}
          {METHOD_LABEL[reservation.method]}
          {reservation.roundStage ? ` (${ROUND_STAGE_LABEL[reservation.roundStage]})` : ''}
        </p>
      </div>

      <div className="control-panel-body">
        <dl className="detail-list">
          <div className="detail-row">
            <dt>방문 순서</dt>
            <dd className="num">
              {visitOrder(reservations, reservation)} / {own.length}
              <span className="sub"> 시각순</span>
            </dd>
          </div>
          <div className="detail-row">
            <dt>서비스 예정</dt>
            <dd className="num">{clockOf(reservation.scheduledAt)}</dd>
          </div>
          <div className="detail-row">
            <dt>실제 도착</dt>
            <dd className={`num${deviation > 5 ? ' delta-late' : ''}`}>
              {reservation.arrivedAt === null
                ? '미도착'
                : `${clockOf(reservation.arrivedAt)} (${deviation >= 0 ? '+' : ''}${deviation}분)`}
            </dd>
          </div>
          <div className="detail-row">
            <dt>예상 소요</dt>
            <dd className="num">{reservation.estimatedMinutes}분</dd>
          </div>
          {service !== null && (
            <div className="detail-row">
              <dt>실제 소요</dt>
              <dd className="num">{service}분</dd>
            </div>
          )}
          <div className="detail-row">
            <dt>고객</dt>
            <dd>{reservation.customerName}</dd>
          </div>
          <div className="detail-row">
            <dt>고객 알림</dt>
            <dd>
              {reservation.notifiedAt === null ? (
                <span className="chip is-gray is-mini">미발송</span>
              ) : (
                <span className="chip is-green is-mini">{clockOf(reservation.notifiedAt)}</span>
              )}
            </dd>
          </div>
        </dl>

        <div>
          <div className="panel-head" style={{ marginBottom: 8 }}>
            <span className="panel-title">남은 예약</span>
            <span className="chip is-gray is-mini num">{remaining.length}건</span>
          </div>
          {remaining.length === 0 ? (
            <div className="empty-state">
              <b>남은 예약이 없습니다</b>이 차량의 오늘 일정이 끝났습니다.
            </div>
          ) : (
            <div className="held-order-list">
              {remaining.map((entry) => (
                <div className="held-order" key={entry.id}>
                  <div className="held-order-name">
                    {entry.address}
                    <span className="num sub">{clockOf(entry.scheduledAt)}</span>
                  </div>
                  <div className="held-order-meta">
                    {entry.estimatedMinutes}분 예상
                    {delayed && ' · 앞 건 지연 영향 검토'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="control-panel-actions">
          {reservation.status !== 'DONE' && reservation.arrivedAt === null && (
            <button
              className="btn is-small"
              type="button"
              onClick={() => markArrived(reservation.id)}
            >
              도착
            </button>
          )}
          {reservation.arrivedAt !== null && reservation.status !== 'DONE' && (
            <button
              className="btn is-small"
              type="button"
              onClick={() => completeReservation(reservation.id)}
            >
              완료
            </button>
          )}
          <button
            className="btn is-small"
            type="button"
            onClick={() => notifyCustomer(reservation.id)}
          >
            고객 재알림
          </button>
          {reservation.status !== 'DONE' && (
            <button
              className="btn is-small"
              type="button"
              onClick={() => shiftSchedule(reservation.id, 30)}
            >
              30분 미룸
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
