"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  cancelDispatchOrderAction,
  completeDispatchManualAction,
  listDispatchMonitorAction,
  revertDispatchCompletionAction
} from "@/app/dispatch/actions";
import { DispatchOrderEditDialog } from "@/components/management/DispatchOrderEditDialog";
import type { ServiceOpsDispatchOrder, ServiceOpsBikePurpose } from "@/lib/services/service-ops-api";

/**
 * 배차 이력 사이드 패널 — 구 "배차 모니터" 표를 대체한다. 알림처럼 화면
 * 우측에 떠서 진행 중·당일 완료 배차를 리스트로 보여주고, 행에서 바로
 * 완료/되돌리기/수정/취소한다. 15초 폴링.
 *
 * 업무 관리의 용도 필터(전체/배송/클리닝)를 그대로 따른다 — 차량의 용도로
 * 거른다 (미배정 OFFERED 콜은 bikeId 가 없어 항상 표시).
 */
export function DispatchHistoryPanel({
  purposeFilter,
  plateById,
  purposeByBikeId,
  reassignVehicles,
  reloadTick
}: {
  purposeFilter: ServiceOpsBikePurpose | "ALL";
  plateById: Record<string, string>;
  purposeByBikeId: Record<string, ServiceOpsBikePurpose>;
  reassignVehicles: { id: string; plateNumber: string }[];
  /** 등록/업로드 등 외부 변경 후 재조회 트리거. */
  reloadTick: number;
}) {
  const router = useRouter();
  const [orders, setOrders] = useState<ServiceOpsDispatchOrder[]>([]);
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState<ServiceOpsDispatchOrder | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setOrders(await listDispatchMonitorAction());
    } catch {
      /* 다음 폴링에서 재시도 */
    }
  }, []);

  useEffect(() => {
    // 첫 조회는 rAF 콜백에서 — effect 본문 동기 setState 를 피한다 (리포 관용구).
    const handle = window.requestAnimationFrame(() => void refresh());
    const timer = setInterval(() => void refresh(), 15_000);
    return () => {
      window.cancelAnimationFrame(handle);
      clearInterval(timer);
    };
  }, [refresh, reloadTick]);

  const visible = orders.filter((o) => {
    if (purposeFilter === "ALL") return true;
    if (!o.bikeId) return true; // 미배정 콜은 용도 판정 불가 — 항상 표시
    return (purposeByBikeId[o.bikeId] ?? "DELIVERY") === purposeFilter;
  });

  const active = visible.filter((o) => o.status === "ASSIGNED");
  const completed = visible.filter((o) => o.status === "COMPLETED");

  function completionLabel(order: ServiceOpsDispatchOrder): string {
    if (order.status === "COMPLETED") {
      return order.completedSource === "AUTO" ? "완료(자동)" : "완료(수동)";
    }
    return order.arrivalDetectedAt ? "도착 감지" : "이동 중";
  }

  const runAction = async (fn: () => Promise<{ ok: boolean; message?: string } | { ok: boolean; error?: string }>) => {
    setBusy(true);
    try {
      const res = await fn();
      if (!res.ok) {
        const message = "message" in res ? res.message : "error" in res ? res.error : undefined;
        window.alert(message ?? "처리 실패");
      }
      await refresh();
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className={`dispatch-history-panel${open ? "" : " dispatch-history-panel--closed"}`} aria-label="배차 이력">
      <button
        type="button"
        className="dispatch-history-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        배차 이력 <span className="dispatch-history-count">{active.length}</span>
        <span aria-hidden="true">{open ? "▸" : "◂"}</span>
      </button>
      {open ? (
        <div className="dispatch-history-body">
          {visible.length === 0 ? (
            <p className="muted dispatch-history-empty">진행 중·당일 완료 배차가 없습니다.</p>
          ) : (
            <ul className="dispatch-history-list">
              {[...active, ...completed].map((order) => {
                const done = order.status === "COMPLETED";
                return (
                  <li key={order.id} className={`dispatch-history-row${done ? " is-done" : ""}`}>
                    <div className="dispatch-history-row-head">
                      <span className="dispatch-history-plate">
                        {order.bikeId ? plateById[order.bikeId] ?? "—" : "미배정"}
                      </span>
                      <span className={`dispatch-history-state${done ? " is-done" : ""}`}>
                        {completionLabel(order)}
                      </span>
                    </div>
                    <div className="dispatch-history-row-main">
                      <span>{order.customerName}</span>
                      <span className="muted">{order.address}</span>
                      {order.scheduledAt ? (
                        <span className="muted">
                          예정 {new Date(new Date(order.scheduledAt).getTime() + 9 * 3600_000).toISOString().slice(11, 16)}
                        </span>
                      ) : null}
                    </div>
                    <div className="dispatch-history-actions">
                      {done ? (
                        <button
                          type="button"
                          className="dispatch-history-action"
                          disabled={busy}
                          onClick={() => {
                            if (!window.confirm("완료를 되돌리시겠어요?")) return;
                            void runAction(() => revertDispatchCompletionAction(order.id));
                          }}
                        >
                          되돌리기
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="dispatch-history-action"
                            disabled={busy}
                            onClick={() => setEditing(order)}
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            className="dispatch-history-action"
                            disabled={busy}
                            onClick={() => {
                              if (!window.confirm("이 배차를 완료 처리하시겠어요? (사진 없이 수동 완료)")) return;
                              void runAction(() => completeDispatchManualAction(order.id));
                            }}
                          >
                            완료
                          </button>
                          <button
                            type="button"
                            className="dispatch-history-action"
                            disabled={busy}
                            onClick={() => {
                              if (!window.confirm("이 배차 주문을 취소하시겠어요?")) return;
                              void runAction(() => cancelDispatchOrderAction(order.id));
                            }}
                          >
                            취소
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
      {editing ? (
        <DispatchOrderEditDialog
          order={editing}
          vehicles={reassignVehicles}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void refresh();
          }}
        />
      ) : null}
    </aside>
  );
}
