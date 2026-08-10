import { useMemo, useState } from 'react';
import { PURPOSE_LABEL, type Purpose } from '../../mock/fleet-store';
import { summarizeVehicle } from '../../mock/maintenance-store';
import { useFleetStore } from '../../mock/useFleetStore';
import { useMaintenanceStore } from '../../mock/useMaintenanceStore';

type PurposeFilter = 'ALL' | Purpose;

function stamp(value: number): string {
  return new Date(value).toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * 정비 이력 — 전 차량의 정비 실시 기록.
 *
 * 차량 상세(관리 모드)에서도 그 차량의 이력을 볼 수 있다. 맥락 내 조회와
 * 전체 조회는 다른 작업이므로 양쪽에 둔다 (§12).
 */
export function MaintenanceRecordsPage() {
  const fleet = useFleetStore();
  const { items, records } = useMaintenanceStore();
  const [purposeFilter, setPurposeFilter] = useState<PurposeFilter>('ALL');
  const [actorFilter, setActorFilter] = useState('ALL');

  const vehicleById = useMemo(
    () => new Map(fleet.vehicles.map((vehicle) => [vehicle.id, vehicle])),
    [fleet.vehicles],
  );
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  const actors = useMemo(
    () => [...new Set(records.map((record) => record.actor))].sort(),
    [records],
  );

  const rows = useMemo(
    () =>
      records
        .slice()
        .sort((a, b) => b.performedAt - a.performedAt)
        .filter((record) => {
          const vehicle = vehicleById.get(record.bikeId);
          if (!vehicle) return false;
          if (purposeFilter !== 'ALL' && vehicle.purpose !== purposeFilter) return false;
          if (actorFilter !== 'ALL' && record.actor !== actorFilter) return false;
          return true;
        }),
    [records, vehicleById, purposeFilter, actorFilter],
  );

  /** 현재 초과·임박은 기록이 아니라 지금 상태에서 나온다. */
  const current = useMemo(() => {
    let overdue = 0;
    let soon = 0;
    let unknown = 0;
    for (const vehicle of fleet.vehicles) {
      const summary = summarizeVehicle(vehicle, items, records);
      overdue += summary.overdue;
      soon += summary.soon;
      unknown += summary.unknown;
    }
    return { overdue, soon, unknown };
  }, [fleet.vehicles, items, records]);

  const targetVehicleCount = new Set(rows.map((record) => record.bikeId)).size;

  return (
    <main className="page-content">
      <div className="page-hero">
        <div className="hero-titles">
          <h1>이력</h1>
          <p>전 차량의 정비 실시 기록입니다.</p>
        </div>
        <div className="hero-tools">
          <span className="scope-tag is-neutral">전 차량</span>
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
              <p className="panel-sub">기록은 누적, 초과·임박은 현재 상태</p>
            </div>
          </div>
          <dl className="kpi-row">
            <div className="kpi-item">
              <dt>실시 건수</dt>
              <dd>{rows.length}</dd>
            </div>
            <div className="kpi-item">
              <dt>대상 차량</dt>
              <dd>{targetVehicleCount}</dd>
            </div>
            <div className="kpi-item">
              <dt>현재 초과</dt>
              <dd className={current.overdue > 0 ? 'delta-late' : ''}>
                {current.overdue}
                <small>건</small>
              </dd>
            </div>
            <div className="kpi-item">
              <dt>현재 임박</dt>
              <dd style={current.soon > 0 ? { color: 'var(--color-warning)' } : undefined}>
                {current.soon}
                <small>건</small>
              </dd>
            </div>
            <div className="kpi-item">
              <dt>미점검</dt>
              <dd style={current.unknown > 0 ? { color: 'var(--color-primary)' } : undefined}>
                {current.unknown}
                <small>건</small>
              </dd>
            </div>
          </dl>
          <p className="sub" style={{ marginTop: 12 }}>
            초과·임박은 이 표의 기록 수와 무관합니다. 지금 각 차량의 주기 소진율에서 계산합니다 —
            정비를 많이 했어도 주기가 지났으면 초과입니다. 미점검은 기록이 없어 판정할 수 없는 품목이며
            초과와 다릅니다.
          </p>
        </section>

        <section className="page-panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">정비 기록</div>
              <p className="panel-sub">{rows.length}건</p>
            </div>
            <div className="panel-tools">
              <div className="seg" role="group" aria-label="용도 필터">
                {(
                  [
                    ['ALL', '전체'],
                    ['DELIVERY', '배송용'],
                    ['CLEANING', '클린'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={purposeFilter === value}
                    onClick={() => setPurposeFilter(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <select
                className="control is-auto"
                aria-label="담당자"
                value={actorFilter}
                onChange={(event) => setActorFilter(event.target.value)}
              >
                <option value="ALL">전체 담당자</option>
                {actors.map((actor) => (
                  <option key={actor} value={actor}>
                    {actor}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="empty-state">
              <b>해당하는 기록이 없습니다</b>
              필터를 전체로 바꾸거나 정비 화면에서 체크하세요.
            </div>
          ) : (
            <div className="table-wrap">
              <table className="page-table" style={{ minWidth: 700 }}>
                <thead>
                  <tr>
                    <th scope="col">실시</th>
                    <th scope="col">차량</th>
                    <th scope="col">용도</th>
                    <th scope="col">품목</th>
                    <th scope="col">주행거리</th>
                    <th scope="col">담당자</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((record) => {
                    const vehicle = vehicleById.get(record.bikeId);
                    const item = itemById.get(record.itemId);
                    return (
                      <tr key={record.id}>
                        <td className="num">{stamp(record.performedAt)}</td>
                        <td className="plate">{vehicle?.plateNumber ?? '—'}</td>
                        <td>
                          {vehicle && (
                            <span
                              className={`purpose-chip ${vehicle.purpose === 'DELIVERY' ? 'is-delivery' : 'is-cleaning'}`}
                            >
                              {vehicle.purpose === 'DELIVERY' ? '배송용' : '클린'}
                            </span>
                          )}
                        </td>
                        <td>{item?.name ?? '삭제된 품목'}</td>
                        <td className="num">{record.odometerKm.toLocaleString('ko-KR')} km</td>
                        <td>{record.actor}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="sub" style={{ marginTop: 10 }}>
            용도로 나눌 수 있지만 기본은 전체입니다. 정비 담당자는 용도로 나뉘지 않은 전체 차량을
            봅니다. 배송용 {PURPOSE_LABEL.DELIVERY} · 클린 {PURPOSE_LABEL.CLEANING} 은 차량의
            소속일 뿐입니다.
          </p>
        </section>
      </div>
    </main>
  );
}
