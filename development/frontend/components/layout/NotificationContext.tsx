"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { listReignitionNotificationsAction } from "@/app/dispatch/actions";
import { acknowledgeNotificationAction, listNotificationsAction } from "@/app/actions";

export type IgnitionNotification = {
  id: string;
  plateNumber: string;
  startedAt: number;
  /** CLEANING 차량 출발 시 현재 배차(dispatch) 고객명. 없으면 "출발"만 표시. */
  customerName?: string;
  /** CLEANING 차량 출발 시 현재 배차 주소. 벨 항목에 괄호로 표기. */
  address?: string;
  /** @deprecated C3 이후 미사용 — 과거 next-customer 알림 호환용. */
  customerPhone?: string;
  /** 유모차 라운드: 현재 태스크 종류. 벨에 수거/배송 라벨로 표시. */
  kind?: "PICKUP" | "DELIVERY";
};

/**
 * 통합 알림 모델 — re-ignition 과 서버 generic notification 을 단일 목록으로 합친다.
 */
export type UnifiedNotification = {
  id: string;
  type: "MAINTENANCE_ALARM" | "REIGNITION" | "TIP_SUBMISSION" | string;
  title: string;
  body: string | null;
  occurredAt: number; // ms since epoch
  acknowledged: boolean;
  refBikeId?: string | null;
  /** 팁 제출 알림의 팁 ID 등 참조 엔티티 ID. */
  refEntityId?: string | null;
};

type NotificationContextValue = {
  notifications: IgnitionNotification[];
  unifiedNotifications: UnifiedNotification[];
  unreadCount: number;
  addNotification: (n: Omit<IgnitionNotification, "id">) => void;
  markAllRead: () => void;
  acknowledge: (id: string) => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<IgnitionNotification[]>([]);
  const [readCount, setReadCount] = useState(0);
  const [genericNotifications, setGenericNotifications] = useState<UnifiedNotification[]>([]);

  // 앱 로드 시 re-ignition 알림을 가져와 벨을 초기화한다.
  useEffect(() => {
    listReignitionNotificationsAction().then((records) => {
      if (records.length === 0) return;
      const seeded: IgnitionNotification[] = records.map((r) => ({
        id: r.id,
        plateNumber: r.plateNumber,
        startedAt: new Date(r.occurredAt).getTime(),
        customerName: r.nextCustomerName ?? undefined,
        address: r.nextAddress ?? undefined,
      }));
      setNotifications((prev) => {
        if (prev.length > 0) return prev;
        const combined = [...seeded].reverse();
        return combined.length > 20 ? combined.slice(-20) : combined;
      });
      setReadCount(0);
    }).catch(() => undefined);
  }, []);

  // 서버 generic notifications — 로드 시 1회 + 60초 폴링. 클리닝 임박/지연
  // 알림은 화면이 열려 있는 동안 백엔드 스케줄러가 만들어내므로, 폴링이
  // 없으면 새 알림이 새로고침 전까지 벨에 보이지 않는다.
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      listNotificationsAction().then((records) => {
        if (cancelled) return;
        const mapped: UnifiedNotification[] = records.map((r) => ({
          id: r.id,
          type: r.type,
          title: r.title,
          body: r.body,
          occurredAt: new Date(r.occurredAt).getTime(),
          acknowledged: r.acknowledgedAt != null,
          refBikeId: r.refBikeId,
          refEntityId: r.refEntityId,
        }));
        // newest-first already from server; keep that order.
        // 낙관적 ack(acknowledge)가 서버 반영 전 폴링에 뒤집히지 않도록,
        // 이미 로컬에서 ack 된 항목은 ack 상태를 유지한다.
        setGenericNotifications((prev) => {
          const ackedLocally = new Set(prev.filter((n) => n.acknowledged).map((n) => n.id));
          return mapped.map((n) => (ackedLocally.has(n.id) ? { ...n, acknowledged: true } : n));
        });
      }).catch(() => undefined);
    };
    load();
    const timer = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const addNotification = useCallback((n: Omit<IgnitionNotification, "id">) => {
    const id = `${n.plateNumber}-${n.startedAt}-${Math.random().toString(36).slice(2, 7)}`;
    setNotifications((prev) => {
      const next = [...prev, { ...n, id }];
      return next.length > 20 ? next.slice(-20) : next;
    });
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((notifs) => {
      setReadCount(notifs.length);
      return notifs;
    });
  }, []);

  const acknowledge = useCallback((id: string) => {
    // Optimistic local update
    setGenericNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, acknowledged: true } : n))
    );
    // Fire-and-forget server call
    acknowledgeNotificationAction(id).catch(() => undefined);
  }, []);

  // Build unified list from reignition + generic notifications, sorted by occurredAt desc
  const reignitionAsUnified: UnifiedNotification[] = notifications.map((n) => ({
    id: n.id,
    type: "REIGNITION" as const,
    title: `${n.plateNumber}${n.kind === "PICKUP" ? " 수거" : n.kind === "DELIVERY" ? " 배송" : ""} 출발${n.customerName ? ` → ${n.customerName}` : ""}`,
    body: n.address ?? null,
    occurredAt: n.startedAt,
    acknowledged: true, // reignition items have no server-side ack; treat as always-seen
    refBikeId: null,
  }));

  const unifiedNotifications: UnifiedNotification[] = [
    ...reignitionAsUnified,
    ...genericNotifications,
  ].sort((a, b) => b.occurredAt - a.occurredAt);

  // unreadCount = reignition unread + unacknowledged generic
  const reignitionUnread = Math.max(0, notifications.length - readCount);
  const genericUnread = genericNotifications.filter((n) => !n.acknowledged).length;
  const unreadCount = reignitionUnread + genericUnread;

  return (
    <NotificationContext.Provider
      value={{ notifications, unifiedNotifications, unreadCount, addNotification, markAllRead, acknowledge }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}
