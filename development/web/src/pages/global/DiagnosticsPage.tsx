import { useMemo, useState } from 'react';
import {
  DEVICE_SYNC_LOGS,
  INGESTION_ERRORS,
  REIGNITION_NOTIFICATIONS,
  STAGE_LABEL,
  TELEMETRY_SIGNALS,
  referenceChecks,
  worstSeverity,
  type CheckSeverity,
} from '../../mock/diagnostics';
import { PURPOSE_LABEL, type Purpose } from '../../mock/fleet-store';
import { useCleaningStore } from '../../mock/useCleaningStore';
import { useFleetStore } from '../../mock/useFleetStore';
import { useMaintenanceStore } from '../../mock/useMaintenanceStore';
import { useNow, useOrderStore } from '../../mock/useOrderStore';
import { useSettingsStore } from '../../mock/useSettingsStore';

type PurposeFilter = 'ALL' | Purpose;

const SEVERITY_LABEL: Record<CheckSeverity, string> = {
  OK: '통과',
  WARN: '확인',
  FAIL: '실패',
};

function severityChip(severity: CheckSeverity): string {
  if (severity === 'FAIL') return 'is-risk';
  if (severity === 'WARN') return 'is-amber';
  return 'is-green';
}

function stamp(value: number): string {
  return new Date(value).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function elapsed(value: number, now: number): number {
  return Math.max(0, Math.floor((now - value) / 60_000));
}

/**
 * 진단 — 시스템이 제대로 도는가.
 *
 * 무결성 점검은 시드가 아니라 **지금 스토어를 훑어서** 계산한다. 미수신 판정도
 * 설정의 임계와 마지막 수신 시각을 비교해서 낸다 — 목록을 박아두면 설정에서
 * 임계를 바꿔도 결과가 그대로여서 화면이 거짓말을 한다 (§14).
 */
export function DiagnosticsPage() {
  const fleet = useFleetStore();
  const { orders } = useOrderStore();
  const { reservations } = useCleaningStore();
  const { items, records } = useMaintenanceStore();
  const { settings } = useSettingsStore();
  const now = useNow(20_000);
  const [purposeFilter, setPurposeFilter] = useState<PurposeFilter>('ALL');
  const [onlyProblems, setOnlyProblems] = useState(true);

  const checks = useMemo(
    () =>
      referenceChecks({
        vehicles: fleet.vehicles,
        riders: fleet.riders,
        contracts: fleet.contracts,
        orders,
        reservations,
        items,
        records,
      }),
    [fleet.vehicles, fleet.riders, fleet.contracts, orders, reservations, items, records],
  );

  const overall = worstSeverity(checks);
  const failCount = checks.filter((check) => check.severity === 'FAIL').length;
  const warnCount = checks.filter((check) => check.severity === 'WARN').length;
  const visibleChecks = onlyProblems ? checks.filter((check) => check.severity !== 'OK') : checks;

  const staleVehicles = useMemo(() => {
    const vehicleById = new Map(fleet.vehicles.map((vehicle) => [vehicle.id, vehicle]));
    return TELEMETRY_SIGNALS.map((signal) => ({
      signal,
      vehicle: vehicleById.get(signal.bikeId),
      minutes: elapsed(signal.lastSeenAt, now),
    }))
      .filter((row) => row.vehicle !== undefined)
      .filter((row) => row.minutes >= settings.telemetryStaleMinutes)
      .filter((row) => purposeFilter === 'ALL' || row.vehicle?.purpose === purposeFilter)
      .sort((a, b) => b.minutes - a.minutes);
  }, [fleet.vehicles, now, settings.telemetryStaleMinutes, purposeFilter]);

  const plateOf = (bikeId: string) =>
    fleet.vehicles.find((vehicle) => vehicle.id === bikeId)?.plateNumber ?? bikeId;

  const syncFailures = DEVICE_SYNC_LOGS.filter((log) => !log.ok).length;
  const unacknowledged = REIGNITION_NOTIFICATIONS.filter(
    (entry) => entry.acknowledgedAt === null,
  ).length;

  return (
    <main className="page-content">
      <div className="page-hero">
        <div className="hero-titles">
          <h1>진단</h1>
          <p>단말 연동과 데이터 정합성 상태를 확인합니다.</p>
        </div>
        <div className="hero-tools">
          <span className={`scope-tag ${overall === 'OK' ? 'is-neutral' : ''}`}>
            {overall === 'OK' ? '이상 없음' : `점검 ${failCount + warnCount}건`}
          </span>
          {!settings.telemetryEnabled && (
            <span className="chip is-risk">텔레메트리 수집 중지</span>
          )}
        </div>
      </div>

      {!settings.telemetryEnabled && (
        <p className="error-state" role="alert" style={{ marginTop: 0 }}>
          <b>텔레메트리 수집이 꺼져 있습니다</b>
          설정에서 수집을 중지했으므로 아래 미수신 목록과 수집 오류는 새로 쌓이지 않습니다. 관제
          위치도 갱신되지 않습니다.
        </p>
      )}

      <div className="page-grid">
        <section className="page-panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">상태</div>
              <p className="panel-sub">지금 계산한 값입니다</p>
            </div>
          </div>
          <dl className="kpi-row">
            <div className="kpi-item">
              <dt>점검 실패</dt>
              <dd className={failCount > 0 ? 'delta-late' : ''}>
                {failCount}
                <small>건</small>
              </dd>
            </div>
            <div className="kpi-item">
              <dt>점검 확인</dt>
              <dd style={warnCount > 0 ? { color: 'var(--color-warning)' } : undefined}>
                {warnCount}
                <small>건</small>
              </dd>
            </div>
            <div className="kpi-item">
              <dt>미수신 차량</dt>
              <dd className={staleVehicles.length > 0 ? 'delta-late' : ''}>
                {staleVehicles.length}
                <small>대</small>
              </dd>
            </div>
            <div className="kpi-item">
              <dt>동기화 실패</dt>
              <dd style={syncFailures > 0 ? { color: 'var(--color-warning)' } : undefined}>
                {syncFailures}
                <small>건</small>
              </dd>
            </div>
            <div className="kpi-item">
              <dt>미확인 재시동</dt>
              <dd className={unacknowledged > 0 ? 'delta-late' : ''}>
                {unacknowledged}
                <small>건</small>
              </dd>
            </div>
          </dl>
          <p className="sub" style={{ marginTop: 12 }}>
            미수신 기준은 설정의 <b>{settings.telemetryStaleMinutes}분</b>입니다. 수집 주기는{' '}
            {settings.telemetryIntervalSeconds}초입니다.
          </p>
        </section>

        <section className="page-panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">무결성 점검</div>
              <p className="panel-sub">
                {checks.length}개 점검 · 실패 {failCount} · 확인 {warnCount}
              </p>
            </div>
            <div className="seg" role="group" aria-label="표시 범위">
              <button type="button" aria-pressed={onlyProblems} onClick={() => setOnlyProblems(true)}>
                걸린 것만
              </button>
              <button
                type="button"
                aria-pressed={!onlyProblems}
                onClick={() => setOnlyProblems(false)}
              >
                전체
              </button>
            </div>
          </div>

          {visibleChecks.length === 0 ? (
            <div className="empty-state">
              <b>걸린 점검이 없습니다</b>
              {checks.length}개 점검을 모두 통과했습니다. 전체를 눌러 목록을 볼 수 있습니다.
            </div>
          ) : (
            <div className="check-list">
              {visibleChecks.map((check) => (
                <div className="check-row is-static" key={check.id}>
                  <span
                    className={`check-badge ${severityChip(check.severity)}`}
                    aria-hidden="true"
                  >
                    {SEVERITY_LABEL[check.severity]}
                  </span>
                  <div>
                    <div className="check-name">{check.name}</div>
                    <div className="check-meta">{check.detail}</div>
                    {check.findings.length > 0 && (
                      <ul className="finding-list">
                        {check.findings.map((finding) => (
                          <li key={finding}>{finding}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <span className={`chip is-mini ${severityChip(check.severity)}`}>
                    {check.findings.length === 0 ? '0' : `${check.findings.length}건`}
                  </span>
                </div>
              ))}
            </div>
          )}
          <p className="sub" style={{ marginTop: 10 }}>
            실패와 확인을 구분합니다. 없는 차량을 가리키는 주문은 고장이지만, 함체 없는 배송용
            차량은 등록 순서상 잠시 그럴 수 있습니다. 같은 색으로 칠하면 급한 것을 골라낼 수
            없습니다.
          </p>
        </section>

        <section className="page-panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">미수신 차량</div>
              <p className="panel-sub">
                {settings.telemetryStaleMinutes}분 이상 수신 없음 · {staleVehicles.length}대
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

          {staleVehicles.length === 0 ? (
            <div className="empty-state">
              <b>미수신 차량이 없습니다</b>
              모든 차량이 {settings.telemetryStaleMinutes}분 안에 신호를 보냈습니다.
            </div>
          ) : (
            <div className="table-wrap">
              <table className="page-table" style={{ minWidth: 560 }}>
                <thead>
                  <tr>
                    <th scope="col">경과</th>
                    <th scope="col">차량</th>
                    <th scope="col">용도</th>
                    <th scope="col">단말</th>
                    <th scope="col">마지막 수신</th>
                  </tr>
                </thead>
                <tbody>
                  {staleVehicles.map(({ signal, vehicle, minutes }) => (
                    <tr className="is-stale" key={signal.bikeId}>
                      <td className="num delta-late">{minutes}분</td>
                      <td className="plate">{vehicle?.plateNumber}</td>
                      <td>
                        <span
                          className={`purpose-chip ${vehicle?.purpose === 'DELIVERY' ? 'is-delivery' : 'is-cleaning'}`}
                        >
                          {vehicle?.purpose === 'DELIVERY' ? '배송용' : '클린'}
                        </span>
                      </td>
                      <td className="sub">{vehicle?.deviceUid ?? '단말 없음'}</td>
                      <td className="num">{stamp(signal.lastSeenAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="sub" style={{ marginTop: 10 }}>
            차량 단위라 용도 구분은 되지만 시스템 관점의 화면이므로 전역에 둡니다. 용도별 관제에서
            같은 차량이 미수신으로 표시됩니다.
          </p>
        </section>

        <section className="page-panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">단말 동기화 로그</div>
              <p className="panel-sub">
                {DEVICE_SYNC_LOGS.length}건 · 실패 {syncFailures}건
              </p>
            </div>
            <span className={`chip is-mini ${settings.deviceObserverEnabled ? 'is-green' : 'is-gray'}`}>
              observer {settings.deviceObserverEnabled ? '사용' : '중지'}
            </span>
          </div>
          <div className="table-wrap">
            <table className="page-table" style={{ minWidth: 620 }}>
              <thead>
                <tr>
                  <th scope="col">시각</th>
                  <th scope="col">엔드포인트</th>
                  <th scope="col">결과</th>
                  <th scope="col">건수</th>
                  <th scope="col">메시지</th>
                </tr>
              </thead>
              <tbody>
                {DEVICE_SYNC_LOGS.map((log) => (
                  <tr key={log.id}>
                    <td className="num">{stamp(log.at)}</td>
                    <td className="sub">{log.endpoint}</td>
                    <td>
                      <span className={`chip is-mini ${log.ok ? 'is-green' : 'is-risk'}`}>
                        {log.ok ? '성공' : '실패'}
                      </span>
                    </td>
                    <td className="num">{log.count.toLocaleString('ko-KR')}</td>
                    <td className="sub">{log.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="page-panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">텔레메트리 수집 오류</div>
              <p className="panel-sub">{INGESTION_ERRORS.length}건 · 실패 원인과 단계</p>
            </div>
          </div>
          <div className="table-wrap">
            <table className="page-table" style={{ minWidth: 560 }}>
              <thead>
                <tr>
                  <th scope="col">시각</th>
                  <th scope="col">차량</th>
                  <th scope="col">단계</th>
                  <th scope="col">원인</th>
                </tr>
              </thead>
              <tbody>
                {INGESTION_ERRORS.map((error) => (
                  <tr key={error.id}>
                    <td className="num">{stamp(error.at)}</td>
                    <td className="plate">{plateOf(error.bikeId)}</td>
                    <td>
                      <span className="chip is-gray is-mini">{STAGE_LABEL[error.stage]}</span>
                    </td>
                    <td className="sub">{error.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="sub" style={{ marginTop: 10 }}>
            같은 차량이 같은 단계에서 반복 실패하면 단말 쪽 문제입니다. 단계가 흩어져 있으면
            수집 파이프라인을 봐야 합니다.
          </p>
        </section>

        <section className="page-panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">재시동 알림 이력</div>
              <p className="panel-sub">
                {REIGNITION_NOTIFICATIONS.length}건 · 미확인 {unacknowledged}건
              </p>
            </div>
          </div>
          <div className="table-wrap">
            <table className="page-table" style={{ minWidth: 560 }}>
              <thead>
                <tr>
                  <th scope="col">발생</th>
                  <th scope="col">차량</th>
                  <th scope="col">확인</th>
                  <th scope="col">확인자</th>
                </tr>
              </thead>
              <tbody>
                {REIGNITION_NOTIFICATIONS.map((entry) => (
                  <tr
                    className={entry.acknowledgedAt === null ? 'is-stale' : undefined}
                    key={entry.id}
                  >
                    <td className="num">{stamp(entry.at)}</td>
                    <td className="plate">{plateOf(entry.bikeId)}</td>
                    <td className="num">
                      {entry.acknowledgedAt === null ? (
                        <span className="chip is-risk is-mini">미확인</span>
                      ) : (
                        stamp(entry.acknowledgedAt)
                      )}
                    </td>
                    <td>{entry.acknowledgedBy ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <p className="sub" style={{ marginTop: 'var(--space-4)' }}>
        전 차량을 봅니다 — 배송용 {PURPOSE_LABEL.DELIVERY} {fleet.vehicles.filter((v) => v.purpose === 'DELIVERY').length}대, 클린{' '}
        {fleet.vehicles.filter((v) => v.purpose === 'CLEANING').length}대. 진단은 시스템 관점이라
        용도로 나누지 않고, 미수신 목록만 차량 단위라서 용도 필터를 둡니다.
      </p>
    </main>
  );
}
