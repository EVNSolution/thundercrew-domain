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

type NotificationContextValue = {
  notifications: IgnitionNotification[];
  unreadCount: number;
  addNotification: (n: Omit<IgnitionNotification, "id">) => void;
  markAllRead: () => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<IgnitionNotification[]>([]);
  const [readCount, setReadCount] = useState(0);

  // 앱 로드 시 서버에서 최근 re-ignition 알림을 가져와 벨을 초기화한다.
  // 서버 레코드 id 는 클라이언트 생성 id 와 충돌하지 않으므로 dedup 불필요.
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
      // newest-first — server returns newest first, so reverse for oldest-first
      // then cap to 20 via the same logic as addNotification.
      setNotifications((prev) => {
        if (prev.length > 0) return prev; // already has live notifications, skip seed
        const combined = [...seeded].reverse(); // convert newest-first → oldest-first
        return combined.length > 20 ? combined.slice(-20) : combined;
      });
      setReadCount(0);
    }).catch(() => undefined);
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

  const unreadCount = Math.max(0, notifications.length - readCount);

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, addNotification, markAllRead }}
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
