import { useMemo, useState } from 'react';
import { MapCanvas, type MapMarkerSpec } from '../../components/MapCanvas';
import { PHASE_LABEL } from '../../features/control/fleet-simulation';
import { simulationEnabled, useFleetSimulation } from '../../features/control/useFleetSimulation';
import { vehicleMarkerColor } from '../../features/control/vehicle-colors';
import {
  STALE_ORDER_THRESHOLD_MINUTES,
  STALE_TELEMETRY_BIKE_IDS,
  STATIONS,
  ZONES,
  zoneById,
} from '../../mock/delivery-control';
import { heldOrderOf, poolOrders, waitingMinutes } from '../../mock/order-store';
import { useNow, useOrderStore } from '../../mock/useOrderStore';

const SEOUL_CENTER = { lat: 37.5326, lng: 127.0246 };

/**
 * 배송용 관제.
 *
 * 위치가 핵심이고 순서 개념이 없다. 차량이 잡은 주문은 순서 번호 없이
 * 잡은 시각순으로만 보여준다. 아직 아무도 안 잡은 주문은 지도에 별도 핀으로
 * 띄우고 경과 시간을 붙인다.
 */
export function DeliveryControlPage() {
  const { fleet, running } = useFleetSimulation();
  // 주문 상태는 배차 화면과 같은 스토어를 본다. 여기서 잡거나 완료하지 않는다.
  const { orders } = useOrderStore();
  const now = useNow();
  const pool = useMemo(() => poolOrders(orders), [orders]);
  const [activeZones, setActiveZones] = useState<readonly string[]>(() =>
    ZONES.map((zone) => zone.id),
  );
  const [selectedId, setSelectedId] = useState<string>('bike-1');

  const visibleFleet = useMemo(
    () => fleet.filter((vehicle) => activeZones.includes(vehicle.zoneId)),
    [fleet, activeZones],
  );

  const visibleOrders = useMemo(
    () => pool.filter((order) => activeZones.includes(order.zoneId)),
    [pool, activeZones],
  );

  const markers = useMemo<MapMarkerSpec[]>(() => {
    // 차량 색은 DSV 와 같이 차량 ID 해시로 고정 배정한다. 잡은 주문이 없으면 회색.
    // 미수신 차량만 예외로 위험색을 쓴다 — 지도에서 가장 먼저 눈에 들어와야 한다.
    const vehiclePins: MapMarkerSpec[] = visibleFleet.map((vehicle) => ({
      id: vehicle.id,
      lat: vehicle.position.lat,
      lng: vehicle.position.lng,
      label: vehicle.plateNumber,
      color: STALE_TELEMETRY_BIKE_IDS.includes(vehicle.id)
        ? 'var(--color-risk)'
        : vehicleMarkerColor(vehicle.id, heldOrderOf(orders, vehicle.id) ? 1 : 0),
      kind: 'vehicle',
      selected: vehicle.id === selectedId,
    }));

    const stationPins: MapMarkerSpec[] = STATIONS.map((station) => ({
      id: station.id,
      lat: station.position.lat,
      lng: station.position.lng,
      badge: String(station.batteryCount),
      label: station.name,
      color: 'var(--color-departure)',
      kind: 'station',
    }));

    const orderPins: MapMarkerSpec[] = visibleOrders.map((order) => ({
      id: order.id,
      lat: order.position.lat,
      lng: order.position.lng,
      label: `미배정 · ${waitingMinutes(order, now)}분`,
      color: 'var(--color-warning)',
      kind: 'order',
    }));

    return [...stationPins, ...orderPins, ...vehiclePins];
  }, [visibleFleet, visibleOrders, selectedId, orders, now]);

  const selected = fleet.find((vehicle) => vehicle.id === selectedId) ?? fleet[0];
  const selectedStale = selected ? STALE_TELEMETRY_BIKE_IDS.includes(selected.id) : false;
  // 배송원당 최대 1건이다 (§3.1). 목록이 아니라 단건이다.
  const heldOrder = selected ? heldOrderOf(orders, selected.id) : null;
  const staleOrderCount = visibleOrders.filter(
    (order) => waitingMinutes(order, now) >= STALE_ORDER_THRESHOLD_MINUTES,
  ).length;

  function toggleZone(zoneId: string) {
    setActiveZones((current) =>
      current.includes(zoneId)
        ? current.filter((candidate) => candidate !== zoneId)
        : [...current, zoneId],
    );
  }

  return (
    <main className="page-content is-map">
      <div className="map-card">
        <MapCanvas
          markers={markers}
          center={SEOUL_CENTER}
          onSelectMarker={(id) => {
            if (fleet.some((vehicle) => vehicle.id === id)) setSelectedId(id);
          }}
        />

        <dl className="control-kpis">
          <div className="control-kpi">
            <dt>차량</dt>
            <dd>{fleet.length}</dd>
          </div>
          <div className="control-kpi">
            <dt>운행 중</dt>
            <dd>{fleet.filter((vehicle) => vehicle.phase !== 'IDLE').length}</dd>
          </div>
          <div className="control-kpi">
            <dt>미배정 주문</dt>
            <dd style={{ color: 'var(--color-warning)' }}>{pool.length}</dd>
          </div>
          <div className="control-kpi">
            <dt>미수신</dt>
            <dd style={{ color: 'var(--color-risk)' }}>{STALE_TELEMETRY_BIKE_IDS.length}</dd>
          </div>
        </dl>

        {running && (
          <span className="sim-badge">
            <span className="chip-dot" aria-hidden="true" />
            시뮬레이션 — 실차량 데이터가 아닙니다
          </span>
        )}

        <div className="control-filters" role="group" aria-label="권역 필터">
          {ZONES.map((zone) => (
            <button
              key={zone.id}
              className="zone-chip"
              type="button"
              aria-pressed={activeZones.includes(zone.id)}
              onClick={() => toggleZone(zone.id)}
            >
              <span className="zone-swatch" style={{ background: zone.color }} aria-hidden="true" />
              {zone.name}
            </button>
          ))}
        </div>

        {selected && (
          <aside className="control-panel" aria-label="차량 상세">
            <div className="control-panel-head">
              <div className="control-panel-title-row">
                <span className="control-panel-title plate">{selected.plateNumber}</span>
                {selectedStale ? (
                  <span className="chip is-risk">
                    <span className="chip-dot" aria-hidden="true" />
                    미수신
                  </span>
                ) : (
                  <span className={`chip ${selected.phase === 'IDLE' ? 'is-gray' : 'is-green'}`}>
                    <span className="chip-dot" aria-hidden="true" />
                    {PHASE_LABEL[selected.phase]}
                  </span>
                )}
              </div>
              <p className="sub" style={{ marginTop: 4 }}>
                {zoneById(selected.zoneId)?.name ?? '미지정'}
                {selected.riderName ? ` · ${selected.riderName}` : ' · 배정 없음'}
              </p>
            </div>

            <div className="control-panel-body">
              <dl className="detail-list">
                <div className="detail-row">
                  <dt>배터리</dt>
                  <dd className="num">{selected.batteryPercent.toFixed(0)}%</dd>
                </div>
                <div className="detail-row">
                  <dt>엔진</dt>
                  <dd>전기</dd>
                </div>
                <div className="detail-row">
                  <dt>함체</dt>
                  <dd>정상 · 2026-05-12 점검</dd>
                </div>
                <div className="detail-row">
                  <dt>정비</dt>
                  <dd>
                    <span className="chip is-amber is-mini">임박 2건</span>
                  </dd>
                </div>
              </dl>

              <div>
                <div className="panel-head" style={{ marginBottom: 8 }}>
                  <span className="panel-title">잡은 주문</span>
                  <span className="chip is-gray is-mini">최대 1건</span>
                </div>
                {!heldOrder ? (
                  <div className="empty-state">
                    <b>지금 잡은 주문이 없습니다</b>
                    이 배송원은 새 주문을 잡을 수 있습니다. 배차 화면의 풀에서 배정합니다.
                  </div>
                ) : (
                  <div className="held-order">
                    <div className="held-order-name">
                      {heldOrder.address}
                      <span className="chip is-blue is-mini">배송 중</span>
                    </div>
                    <div className="held-order-meta num">
                      {new Date(heldOrder.claimedAt ?? 0).toLocaleTimeString('ko-KR', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                      })}{' '}
                      잡음 · 풀 대기{' '}
                      {Math.max(
                        0,
                        Math.floor(((heldOrder.claimedAt ?? 0) - heldOrder.poolSince) / 60_000),
                      )}
                      분
                    </div>
                  </div>
                )}
              </div>

              {staleOrderCount > 0 && (
                <p className="inline-warn" style={{ marginTop: 0 }}>
                  <span aria-hidden="true">⚠</span>
                  10분 넘게 아무도 잡지 않은 주문이 {staleOrderCount}건입니다.
                </p>
              )}

              <div className="control-panel-actions">
                <button className="btn is-small" type="button">
                  경로 재생
                </button>
                <button className="btn is-small is-danger" type="button">
                  시동 차단
                </button>
              </div>
            </div>
          </aside>
        )}
      </div>

      {!simulationEnabled && (
        <p className="visually-hidden">
          시뮬레이션이 꺼져 있어 차량 핀이 움직이지 않습니다.
        </p>
      )}
    </main>
  );
}
