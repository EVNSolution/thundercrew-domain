"use client";

import { useEffect, useState } from "react";
import type { ServiceOpsDispatchOrder } from "@/lib/services/service-ops-api";
import { cancelDispatchOrderAction } from "@/app/dispatch/actions";
import { DispatchOrderEditDialog } from "@/components/management/DispatchOrderEditDialog";

/**
 * 활성(ASSIGNED) + 당일 완료(COMPLETED) 배차를 차량별로 보여주는 모니터 테이블.
 *
 * - ASSIGNED 행: 수정/취소 버튼 표시.
 * - COMPLETED 행: opacity 0.5로 muted 표시, 작업 버튼 없음.
 * - 정렬: 차량번호 → 상태(ASSIGNED 먼저) → 순번.
 * - 15초마다 onRefresh 자동 호출(폴링).
 */
export function DispatchMonitorTable({
  orders,
  plateById,
  vehicles,
  onRefresh,
  refreshing = false
}: {
  orders: ServiceOpsDispatchOrder[];
  plateById: Record<string, string>;
  vehicles: { id: string; plateNumber: string }[];
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const [editing, setEditing] = useState<ServiceOpsDispatchOrder | null>(null);

  // 15초 자동 새로고침
  useEffect(() => {
    if (!onRefresh) return;
    const timer = setInterval(() => onRefresh(), 15000);
    return () => clearInterval(timer);
  }, [onRefresh]);

  const plateFor = (bikeId: string | null): string => {
    if (!bikeId) return "—";
    return plateById[bikeId] ?? bikeId.slice(0, 8);
  };

  const statusOrder = (s: ServiceOpsDispatchOrder["status"]) =>
    s === "ASSIGNED" ? 0 : 1;

  const sorted = [...orders].sort((a, b) => {
    const pa = plateFor(a.bikeId);
    const pb = plateFor(b.bikeId);
    if (pa !== pb) return pa.localeCompare(pb, "ko");
    if (statusOrder(a.status) !== statusOrder(b.status))
      return statusOrder(a.status) - statusOrder(b.status);
    return a.sequence - b.sequence;
  });

  const total = sorted.length;
  const completed = sorted.filter((o) => o.status === "COMPLETED").length;

  async function handleCancel(id: string) {
    if (!window.confirm("이 배차 주문을 취소하시겠어요?")) return;
    const result = await cancelDispatchOrderAction(id);
    if (!result.ok) {
      window.alert(result.error);
      return;
    }
    onRefresh?.();
  }

  return (
    <div className="dispatch-monitor">
      <div className="dispatch-monitor-toolbar">
        <span className="dispatch-monitor-count">
          활성/당일 배차 {total}건 · 완료 {completed}/{total}
        </span>
        {onRefresh ? (
          <button
            type="button"
            className="button-secondary"
            onClick={onRefresh}
            disabled={refreshing}
          >
            {refreshing ? "새로고침 중..." : "새로고침"}
          </button>
        ) : null}
      </div>
      <div className="table-card">
        <table className="table" style={{ tableLayout: "fixed" }}>
          <thead>
            <tr>
              <th>차량</th>
              <th>고객명</th>
              <th>연락처</th>
              <th>배송지주소</th>
              <th>순번</th>
              <th>상태</th>
              <th>작업</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={7} className="table-empty-cell">
                  현재 활성 배차가 없습니다. 업로드하면 차량별로 여기에 표시됩니다.
                </td>
              </tr>
            ) : (
              sorted.map((order) => {
                const done = order.status === "COMPLETED";
                return (
                  <tr key={order.id} style={done ? { opacity: 0.5 } : undefined}>
                    <td>{plateFor(order.bikeId)}</td>
                    <td>{order.customerName}</td>
                    <td>{order.customerPhone}</td>
                    <td>{order.address}</td>
                    <td>{order.sequence}</td>
                    <td>{done ? "완료" : "진행중"}</td>
                    <td>
                      {done ? (
                        "—"
                      ) : (
                        <>
                          <button
                            type="button"
                            className="button-secondary"
                            onClick={() => setEditing(order)}
                          >
                            수정
                          </button>
                          {" "}
                          <button
                            type="button"
                            className="button-secondary"
                            onClick={() => handleCancel(order.id)}
                          >
                            취소
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {editing ? (
        <DispatchOrderEditDialog
          order={editing}
          vehicles={vehicles}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onRefresh?.();
          }}
        />
      ) : null}
    </div>
  );
}
