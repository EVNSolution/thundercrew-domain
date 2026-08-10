import { useMemo, useState } from 'react';
import { zoneById } from '../../mock/delivery-control';
import {
  bySchedule,
  CLEANING_FLEET,
  clockOf,
  METHOD_LABEL,
  punctualityStats,
  ROUND_STAGE_LABEL,
  serviceMinutes,
  type Reservation,
} from '../../mock/cleaning-store';
import { useCleaningStore } from '../../mock/useCleaningStore';

/** 정시로 인정하는 허용 오차(분). 설정으로 올릴 후보다 (§9.1 미결). */
const ON_TIME_TOLERANCE = 5;

function deviationOf(reservation: Reservation): number | null {
  if (reservation.arrivedAt === null) return null;
  return Math.round((reservation.arrivedAt - reservation.scheduledAt) / 60_000);
}

/**
 * 클리닝 이력.
 *
 * 배송 이력과 지표가 다르다. 배송은 완료 시각·증빙이지만 클리닝은
 * **예정 대비 실제**와 소요 시간 편차다 (§9).
 */
export function CleaningRecordsPage() {
  const { reservations } = useCleaningStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const done = useMemo(
    () =>
      bySchedule(reservations.filter((entry) => entry.status === 'DONE'))
        .slice()
        .reverse(),
    [reservations],
  );
  const stats = useMemo(
    () => punctualityStats(reservations, ON_TIME_TOLERANCE),
    [reservations],
  );

  const selected = done.find((entry) => entry.id === selectedId) ?? done[0] ?? null;

  return (
    <main className="page-content">
      <div className="page-hero">
        <div className="hero-titles">
          <h1>이력</h1>
          <p>예정 시각을 얼마나 지켰는지 확인합니다.</p>
        </div>
        <div className="hero-tools">
          <span className="scope-tag">클린차량</span>
          <button className="btn" type="button">
            내보내기
          </button>
        </div>
      </div>

      <div className="page-grid">
        <section className="page-panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">시각 준수</div>
              <p className="panel-sub">
                도착 이력 {stats.sampleCount}건 기준 · 정시 기준 {ON_TIME_TOLERANCE}분 이내
              </p>
            </div>
          </div>
          {stats.sampleCount === 0 ? (
            <div className="empty-state">
              <b>도착 이력이 없습니다</b>
              배차 화면에서 도착 처리하면 편차가 집계됩니다.
            </div>
          ) : (
            <dl className="kpi-row">
              <div className="kpi-item">
                <dt>정시율</dt>
                <dd className={stats.onTimeRate < 80 ? 'delta-late' : ''}>
                  {stats.onTimeRate}
                  <small>%</small>
                </dd>
              </div>
              <div className="kpi-item">
                <dt>평균 편차</dt>
                <dd className={stats.averageDeviation > ON_TIME_TOLERANCE ? 'delta-late' : 'delta-ok'}>
                  {stats.averageDeviation >= 0 ? '+' : ''}
                  {stats.averageDeviation}
                  <small>분</small>
                </dd>
              </div>
              <div className="kpi-item">
                <dt>최대 지연</dt>
                <dd className={stats.maxDelay > ON_TIME_TOLERANCE ? 'delta-late' : ''}>
                  +{stats.maxDelay}
                  <small>분</small>
                </dd>
              </div>
              <div className="kpi-item">
                <dt>평균 소요</dt>
                <dd>
                  {stats.averageServiceMinutes}
                  <small>분</small>
                </dd>
              </div>
            </dl>
          )}
          <p className="sub" style={{ marginTop: 12 }}>
            정시율이 떨어지면 예상 소요를 너무 짧게 잡았거나 이동 시간을 빼먹은 것입니다. 평균 소요와
            예상 소요를 비교해 보세요.
          </p>
        </section>

        <div className="master-detail-grid">
          <section className="page-panel">
            <div className="panel-head">
              <div>
                <div className="panel-title">완료 서비스</div>
                <p className="panel-sub">{done.length}건</p>
              </div>
            </div>
            {done.length === 0 ? (
              <div className="empty-state">
                <b>완료된 서비스가 없습니다</b>
                배차 화면에서 도착 → 완료를 누르면 여기에 쌓입니다.
              </div>
            ) : (
              <div className="table-wrap">
                <table className="page-table" style={{ minWidth: 480 }}>
                  <thead>
                    <tr>
                      <th scope="col">예정</th>
                      <th scope="col">도착</th>
                      <th scope="col">편차</th>
                      <th scope="col">소요</th>
                      <th scope="col">차량</th>
                      <th scope="col">클리너</th>
                    </tr>
                  </thead>
                  <tbody>
                    {done.map((entry) => {
                      const deviation = deviationOf(entry);
                      const service = serviceMinutes(entry);
                      const late = (deviation ?? 0) > ON_TIME_TOLERANCE;
                      const plate =
                        CLEANING_FLEET.find((bike) => bike.bikeId === entry.bikeId)?.plateNumber ??
                        '—';
                      return (
                        <tr
                          key={entry.id}
                          className="is-selectable"
                          aria-selected={selected?.id === entry.id}
                          onClick={() => setSelectedId(entry.id)}
                        >
                          <td className="num">{clockOf(entry.scheduledAt)}</td>
                          <td className="num">{clockOf(entry.arrivedAt)}</td>
                          <td className={`num ${late ? 'delta-late' : 'delta-ok'}`}>
                            {deviation === null
                              ? '—'
                              : `${deviation >= 0 ? '+' : ''}${deviation}분`}
                          </td>
                          <td className="num">{service === null ? '—' : `${service}분`}</td>
                          <td className="plate">{plate}</td>
                          <td>{entry.cleanerName}</td>
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
                <b>선택된 서비스가 없습니다</b>
                왼쪽 목록에서 한 건을 고르면 예정 대비 실제를 봅니다.
              </div>
            ) : (
              <ServiceDetail reservation={selected} />
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function ServiceDetail({ reservation }: { reservation: Reservation }) {
  const deviation = deviationOf(reservation);
  const service = serviceMinutes(reservation);
  const late = (deviation ?? 0) > ON_TIME_TOLERANCE;
  const plate =
    CLEANING_FLEET.find((bike) => bike.bikeId === reservation.bikeId)?.plateNumber ?? '—';
  const overrun =
    service === null ? null : service - reservation.estimatedMinutes;

  return (
    <>
      <div className="panel-head">
        <div>
          <div className="panel-title">{reservation.address}</div>
          <p className="panel-sub">
            {reservation.customerName} · {zoneById(reservation.zoneId)?.name ?? '미지정'} ·{' '}
            {plate}
          </p>
        </div>
        <span className={`chip ${late ? 'is-risk' : 'is-gray'}`}>
          {late ? `${deviation}분 지연` : '정시'}
        </span>
      </div>

      <dl className="detail-list">
        <div className="detail-row">
          <dt>배차 방식</dt>
          <dd>
            {METHOD_LABEL[reservation.method]}
            {reservation.roundStage ? ` · ${ROUND_STAGE_LABEL[reservation.roundStage]}` : ''}
          </dd>
        </div>
        <div className="detail-row">
          <dt>예정 시각</dt>
          <dd className="num">{clockOf(reservation.scheduledAt)}</dd>
        </div>
        <div className="detail-row">
          <dt>실제 도착</dt>
          <dd className={`num ${late ? 'delta-late' : 'delta-ok'}`}>
            {clockOf(reservation.arrivedAt)}
            {deviation !== null && (
              <span className="sub">
                {' '}
                ({deviation >= 0 ? '+' : ''}
                {deviation}분)
              </span>
            )}
          </dd>
        </div>
        <div className="detail-row">
          <dt>예상 소요</dt>
          <dd className="num">{reservation.estimatedMinutes}분</dd>
        </div>
        <div className="detail-row">
          <dt>실제 소요</dt>
          <dd className="num">
            {service === null ? '—' : `${service}분`}
            {overrun !== null && overrun !== 0 && (
              <span className={`sub ${overrun > 0 ? 'delta-late' : 'delta-ok'}`}>
                {' '}
                ({overrun > 0 ? '+' : ''}
                {overrun}분)
              </span>
            )}
          </dd>
        </div>
        <div className="detail-row">
          <dt>완료</dt>
          <dd className="num">{clockOf(reservation.completedAt)}</dd>
        </div>
        <div className="detail-row">
          <dt>클리너</dt>
          <dd>{reservation.cleanerName}</dd>
        </div>
        {reservation.memo && (
          <div className="detail-row">
            <dt>메모</dt>
            <dd>{reservation.memo}</dd>
          </div>
        )}
      </dl>

      <div className="panel-head" style={{ margin: 'var(--space-4) 0 8px' }}>
        <span className="panel-title">고객 알림</span>
      </div>
      {reservation.notifiedAt === null ? (
        <div className="empty-state">
          <b>알림을 보내지 않았습니다</b>
          예약 시 "발송 안 함"을 골랐거나 발송이 실패했습니다.
        </div>
      ) : (
        <div className="table-wrap">
          <table className="page-table" style={{ minWidth: 260 }}>
            <thead>
              <tr>
                <th scope="col">시각</th>
                <th scope="col">종류</th>
                <th scope="col">결과</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="num">{clockOf(reservation.notifiedAt)}</td>
                <td>사이트 알람</td>
                <td>
                  <span className="chip is-green is-mini">성공</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <p className="sub" style={{ marginTop: 10 }}>
        카카오 알림톡은 발신프로필·템플릿 심사가 필요해 후속 범위입니다. 지금은 사내 사이트 알람만
        보냅니다.
      </p>
    </>
  );
}
