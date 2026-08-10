import { useMemo, useState } from 'react';
import {
  ENGINE_LABEL,
  PURPOSE_LABEL,
  WHEEL_LABEL,
  type Purpose,
  type Vehicle,
} from '../../mock/fleet-store';
import {
  CATEGORY_LABEL,
  categoryOf,
  clearMaintenanceMessage,
  DUE_LABEL,
  dueInfo,
  itemsForVehicle,
  recordMaintenance,
  summarizeVehicle,
  undoLastRecord,
  type DueStatus,
} from '../../mock/maintenance-store';
import { useFleetStore } from '../../mock/useFleetStore';
import { useMaintenanceStore } from '../../mock/useMaintenanceStore';

type PurposeFilter = 'ALL' | Purpose;

function dueChipClass(status: DueStatus): string {
  if (status === 'OVERDUE') return 'is-risk';
  if (status === 'SOON') return 'is-amber';
  if (status === 'UNKNOWN') return 'is-blue';
  return 'is-gray';
}

function dateOf(value: number | null): string {
  if (value === null) return '기록 없음';
  return new Date(value).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/**
 * 정비 — 차량별 체크.
 *
 * 배송용과 클린차량이 **한 목록에 섞여 있다.** 정비 품목은 (휠 × 엔진) 6분류로
 * 결정되고 용도와 무관하기 때문이다 (§10). 용도는 칩으로 표시하고 필터는
 * 선택적으로 제공하되 기본값은 전체다.
 */
export function MaintenanceVehiclesPage() {
  const fleet = useFleetStore();
  const { items, records, lastMessage } = useMaintenanceStore();
  const [purposeFilter, setPurposeFilter] = useState<PurposeFilter>('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const filtered =
      purposeFilter === 'ALL'
        ? fleet.vehicles
        : fleet.vehicles.filter((vehicle) => vehicle.purpose === purposeFilter);
    return filtered
      .map((vehicle) => ({ vehicle, summary: summarizeVehicle(vehicle, items, records) }))
      // 조치 필요를 위로 올린다. 초과가 임박보다 먼저다.
      .sort(
        (a, b) =>
          b.summary.overdue - a.summary.overdue ||
          b.summary.soon - a.summary.soon ||
          a.vehicle.plateNumber.localeCompare(b.vehicle.plateNumber),
      );
  }, [fleet.vehicles, items, records, purposeFilter]);

  // 미점검은 조치 필요로 세지 않는다. 알 수 없는 것과 주기를 넘긴 것은 다르다.
  const needsAction = rows.filter(
    (row) => row.summary.overdue > 0 || row.summary.soon > 0,
  ).length;
  const unknownVehicles = rows.filter((row) => row.summary.unknown > 0).length;

  const selected = rows.find((row) => row.vehicle.id === selectedId)?.vehicle ?? rows[0]?.vehicle ?? null;

  return (
    <main className="page-content">
      <div className="page-hero">
        <div className="hero-titles">
          <h1>정비</h1>
          <p>차량을 고르고 정비 품목을 체크합니다.</p>
        </div>
        <div className="hero-tools">
          <span className="scope-tag is-neutral">전 차량 {fleet.vehicles.length}대</span>
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
            onClick={clearMaintenanceMessage}
            style={{ marginLeft: 'auto' }}
          >
            닫기
          </button>
        </p>
      )}

      <div className="master-detail-grid">
        <section className="page-panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">차량</div>
              <p className="panel-sub">
                {rows.length}대 · 조치 필요 {needsAction}대 · 미점검 있는 차량{' '}
                {unknownVehicles}대
              </p>
            </div>
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
          </div>

          <div className="table-wrap">
            <table className="page-table" style={{ minWidth: 480 }}>
              <thead>
                <tr>
                  <th scope="col">차량</th>
                  <th scope="col">용도</th>
                  <th scope="col">휠 · 엔진</th>
                  <th scope="col">주행</th>
                  <th scope="col">정비</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ vehicle, summary }) => (
                  <tr
                    key={vehicle.id}
                    className="is-selectable"
                    aria-selected={vehicle.id === selected?.id}
                    onClick={() => setSelectedId(vehicle.id)}
                  >
                    <td className="plate">{vehicle.plateNumber}</td>
                    <td>
                      <span
                        className={`purpose-chip ${vehicle.purpose === 'DELIVERY' ? 'is-delivery' : 'is-cleaning'}`}
                      >
                        {vehicle.purpose === 'DELIVERY' ? '배송용' : '클린'}
                      </span>
                    </td>
                    <td className="sub">
                      {WHEEL_LABEL[vehicle.wheelType]} · {ENGINE_LABEL[vehicle.engineType]}
                    </td>
                    <td className="num">{vehicle.odometerKm.toLocaleString('ko-KR')} km</td>
                    <td>
                      {summary.overdue > 0 ? (
                        <span className="chip is-risk is-mini">초과 {summary.overdue}</span>
                      ) : summary.soon > 0 ? (
                        <span className="chip is-amber is-mini">임박 {summary.soon}</span>
                      ) : summary.unknown > 0 ? (
                        <span className="chip is-blue is-mini">미점검 {summary.unknown}</span>
                      ) : (
                        <span className="chip is-gray is-mini">정상</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="sub" style={{ marginTop: 10 }}>
            배송용과 클린차량이 한 목록에 섞여 있습니다. 정비 품목은 휠·엔진으로 결정되고 용도와
            무관합니다.
          </p>
        </section>

        <section className="page-panel">
          {selected ? (
            <Checklist vehicle={selected} />
          ) : (
            <div className="empty-state">
              <b>해당하는 차량이 없습니다</b>
              용도 필터를 전체로 바꿔 보세요.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Checklist({ vehicle }: { vehicle: Vehicle }) {
  const { items, records } = useMaintenanceStore();
  const [odometer, setOdometer] = useState(String(vehicle.odometerKm));
  const [actor, setActor] = useState('');

  const category = categoryOf(vehicle.wheelType, vehicle.engineType);
  const applicable = itemsForVehicle(vehicle, items);
  const summary = summarizeVehicle(vehicle, items, records);

  return (
    <>
      <div className="panel-head">
        <div>
          <div className="panel-title">{vehicle.plateNumber} 정비 체크</div>
          <p className="panel-sub">
            <span
              className={`purpose-chip ${vehicle.purpose === 'DELIVERY' ? 'is-delivery' : 'is-cleaning'}`}
            >
              {PURPOSE_LABEL[vehicle.purpose]}
            </span>{' '}
            {CATEGORY_LABEL[category]} · 주행 {vehicle.odometerKm.toLocaleString('ko-KR')} km
          </p>
        </div>
        {summary.overdue > 0 ? (
          <span className="chip is-risk">초과 {summary.overdue}건</span>
        ) : summary.soon > 0 ? (
          <span className="chip is-amber">임박 {summary.soon}건</span>
        ) : summary.unknown > 0 ? (
          <span className="chip is-blue">미점검 {summary.unknown}건</span>
        ) : (
          <span className="chip is-gray">정상</span>
        )}
      </div>

      {applicable.length === 0 ? (
        <div className="empty-state">
          <b>이 분류에 해당하는 품목이 없습니다</b>
          {CATEGORY_LABEL[category]} 분류에 적용되는 품목을 품목 화면에서 추가하세요.
        </div>
      ) : (
        <div className="check-list">
          {applicable.map((item) => {
            const info = dueInfo(vehicle, item, records);
            return (
              <div className="check-row is-static" key={item.id}>
                <span className={`check-badge ${dueChipClass(info.status)}`} aria-hidden="true">
                  {info.status === 'UNKNOWN' ? '—' : `${info.percent}%`}
                </span>
                <div>
                  <div className="check-name">{item.name}</div>
                  <div className="check-meta">
                    {info.progress} · 최근 {dateOf(info.lastPerformedAt)}
                    {item.requiresEquipment && ` · ${item.requiresEquipment} 장착 차량만`}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className={`chip is-mini ${dueChipClass(info.status)}`}>
                    {DUE_LABEL[info.status]}
                  </span>
                  <button
                    className="btn is-small"
                    type="button"
                    onClick={() =>
                      recordMaintenance({
                        bikeId: vehicle.id,
                        itemId: item.id,
                        odometerKm: Number.parseInt(odometer.replace(/[^\d]/g, ''), 10) || vehicle.odometerKm,
                        actor,
                        itemName: item.name,
                      })
                    }
                  >
                    체크
                  </button>
                  {info.lastPerformedAt !== null && (
                    <button
                      className="btn is-small"
                      type="button"
                      title="오입력을 되돌립니다"
                      onClick={() => undoLastRecord(vehicle.id, item.id, item.name)}
                    >
                      되돌리기
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="form-grid" style={{ marginTop: 'var(--space-4)' }}>
        <div className="field">
          <label htmlFor="mv-km">체크 시 주행거리 (km)</label>
          <input
            className="control num"
            id="mv-km"
            value={odometer}
            onChange={(event) => setOdometer(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="mv-actor">담당자</label>
          <input
            className="control"
            id="mv-actor"
            placeholder="정비1팀 김수"
            value={actor}
            onChange={(event) => setActor(event.target.value)}
          />
        </div>
      </div>
      <p className="sub" style={{ marginTop: 8 }}>
        주기 계산에 주행거리가 필요하므로 체크할 때 함께 받습니다. km 과 개월을 둘 다 가진 품목은
        먼저 닿는 쪽을 기준으로 판정합니다.
      </p>
    </>
  );
}
