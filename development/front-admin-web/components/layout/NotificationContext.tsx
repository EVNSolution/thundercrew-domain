"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

export type IgnitionNotification = {
  id: string;
  plateNumber: string;
  startedAt: number;
  /** CLEANING 차량 시동 ON 시 설정. 없으면 기존 "이동 시작" 알림 표시. */
  customerName?: string;
  customerPhone?: string;
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
