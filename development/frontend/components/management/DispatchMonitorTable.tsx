"use client";

import type { ServiceOpsDispatchOrder } from "@/lib/services/service-ops-api";

/**
 * 활성(ASSIGNED) 배차를 차량별로 묶어 보여주는 fleet-wide 읽기 전용 모니터 테이블.
 *
 * 단일·순차 배차는 같은 DispatchOrder 풀이라(업로드 방식만 다르고 저장된 주문을
 * 구분하는 필드가 없다) 한 곳에서 통합 표시한다. 차량번호는 `plateById` 로 해석하고,
 * 각 차량 내에서는 방문 순번(sequence) 오름차순으로 정렬한다.
 *
 * 변경(업로드/완료/취소)은 각 패널·라이더 앱이 담당하고 이 컴포넌트는 현황만 보여준다.
 */
export function DispatchMonitorTable({
  orders,
  plateById,
  onRefresh,
  refreshing = false
}: {
  orders: ServiceOpsDispatchOrder[];
  plateById: Record<string, string>;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const plateFor = (bikeId: string | null): string => {
    if (!bikeId) return "—";
    return plateById[bikeId] ?? bikeId.slice(0, 8);
  };

  // 차량번호 → 순번 순으로 안정 정렬. (bikeId 없는 주문은 목록 뒤로.)
  const sorted = [...orders].sort((a, b) => {
    const pa = plateFor(a.bikeId);
    const pb = plateFor(b.bikeId);
    if (pa !== pb) return pa.localeCompare(pb, "ko");
    return a.sequence - b.sequence;
  });

  return (
    <div className="dispatch-monitor">
      <div className="dispatch-monitor-toolbar">
        <span className="dispatch-monitor-count">활성 배차 {sorted.length}건</span>
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
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={5} className="table-empty-cell">
                  현재 활성 배차가 없습니다. 업로드하면 차량별로 여기에 표시됩니다.
                </td>
              </tr>
            ) : (
              sorted.map((order) => (
                <tr key={order.id}>
                  <td>{plateFor(order.bikeId)}</td>
                  <td>{order.customerName}</td>
                  <td>{order.customerPhone}</td>
                  <td>{order.address}</td>
                  <td>{order.sequence}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
