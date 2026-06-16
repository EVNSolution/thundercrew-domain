"use client";

import { useEffect, useMemo, useState } from "react";

import { listActiveDispatchOrdersAction } from "@/app/dispatch/actions";
import type { FrontendVehicle, ServiceOpsDispatchOrder } from "@/lib/services/service-ops-api";

interface DeliveryStatusPanelProps {
  vehicles: ReadonlyArray<FrontendVehicle>;
}

/**
 * 전체화면 지도 하단 패널의 "배송" 탭 콘텐츠.
 *
 * 마운트 시 `listActiveDispatchOrdersAction()` 으로 ASSIGNED 상태의 전체 배차를
 * 받아 bikeId 별로 그룹화한 뒤, 차량번호와 함께 현재 배차 + 대기 목록을 보여준다.
 * 읽기 전용 상태 뷰이므로 완료/취소 버튼은 없다.
 */
export function DeliveryStatusPanel({ vehicles }: DeliveryStatusPanelProps) {
  const [orders, setOrders] = useState<ServiceOpsDispatchOrder[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    listActiveDispatchOrdersAction().then((next) => {
      if (cancelled) return;
      setOrders(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // bikeId → plateNumber 조회 맵 (id 가 있는 차량만).
  const plateByBikeId = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of vehicles) {
      if (v.id) map.set(v.id, v.plateNumber);
    }
    return map;
  }, [vehicles]);

  // bikeId 별 그룹화 및 sequence 정렬.
  const groups = useMemo(() => {
    if (!orders) return null;
    const byBike = new Map<string, ServiceOpsDispatchOrder[]>();
    for (const o of orders) {
      if (!o.bikeId) continue;
      const existing = byBike.get(o.bikeId);
      if (existing) {
        existing.push(o);
      } else {
        byBike.set(o.bikeId, [o]);
      }
    }
    // 각 그룹 내 sequence 오름차순 정렬.
    const result: Array<{ bikeId: string; plate: string; orders: ServiceOpsDispatchOrder[] }> = [];
    for (const [bikeId, groupOrders] of byBike.entries()) {
      const plate = plateByBikeId.get(bikeId) ?? "(미상)";
      result.push({
        bikeId,
        plate,
        orders: [...groupOrders].sort((a, b) => a.sequence - b.sequence)
      });
    }
    // 차량번호 순으로 정렬.
    result.sort((a, b) => a.plate.localeCompare(b.plate, "ko"));
    return result;
  }, [orders, plateByBikeId]);

  if (orders === null) {
    return (
      <div className="delivery-status-panel">
        <p className="muted">불러오는 중…</p>
      </div>
    );
  }

  if (!groups || groups.length === 0) {
    return (
      <div className="delivery-status-panel">
        <div className="bottom-map-panel-placeholder">진행 중인 배송 없음</div>
      </div>
    );
  }

  return (
    <div className="delivery-status-panel">
      {groups.map(({ bikeId, plate, orders: groupOrders }) => {
        const [current, ...waiting] = groupOrders;
        return (
          <div key={bikeId} className="delivery-status-vehicle-group">
            <div className="delivery-status-vehicle-header">{plate}</div>

            {/* 현재 배차 */}
            <div className="dispatch-queue-current">
              <span className="dispatch-queue-tag">현재 배차</span>
              <ReadonlyDispatchOrderRow order={current} />
            </div>

            {/* 대기 목록 */}
            {waiting.length > 0 && (
              <div className="dispatch-queue-waiting">
                <span className="dispatch-queue-tag muted">대기 {waiting.length}건</span>
                <ul className="dispatch-queue-list">
                  {waiting.map((order) => (
                    <li key={order.id} className="dispatch-queue-item">
                      <ReadonlyDispatchOrderRow order={order} compact />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * 읽기 전용 배차 주문 행 — VehicleDetailDialog 의 DispatchOrderRow 와 동일한
 * delivery-meta 마크업을 재사용하되 액션 버튼(완료/취소)을 제외한다.
 * `compact` 가 true 이면 대기 목록용으로 고객명+주소만 간략히 표시한다.
 */
function ReadonlyDispatchOrderRow({
  order,
  compact = false
}: {
  order: ServiceOpsDispatchOrder;
  compact?: boolean;
}) {
  return (
    <div className="dispatch-order-row">
      <dl className="delivery-meta">
        <div className="delivery-meta-row">
          <dt>고객 이름</dt>
          <dd>
            {order.customerName || "—"}
            {order.kind ? (
              <span
                className={`dispatch-kind-badge dispatch-kind-badge--${order.kind === "PICKUP" ? "pickup" : "delivery"}`}
              >
                {order.kind === "PICKUP" ? "수거" : "배송"}
              </span>
            ) : null}
          </dd>
        </div>
        {!compact && (
          <div className="delivery-meta-row">
            <dt>연락처</dt>
            <dd>{order.customerPhone || "—"}</dd>
          </div>
        )}
        {!compact && order.originAddress ? (
          <div className="delivery-meta-row">
            <dt>출발지</dt>
            <dd>{order.originAddress}</dd>
          </div>
        ) : null}
        <div className="delivery-meta-row">
          <dt>주소</dt>
          <dd>{order.address || "—"}</dd>
        </div>
      </dl>
    </div>
  );
}
