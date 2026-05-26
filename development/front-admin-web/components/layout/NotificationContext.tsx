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
    setNotifications((prev) => {
      const next = [
        ...prev,
        { ...n, id: `${n.plateNumber}-${n.startedAt}-${Math.random().toString(36).slice(2, 7)}` },
      ];
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
