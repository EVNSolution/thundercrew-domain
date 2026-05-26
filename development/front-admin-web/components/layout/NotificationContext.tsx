// development/front-admin-web/components/layout/NotificationContext.tsx
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode
} from "react";

export interface AppNotification {
  id: string;
  bikePlateNumber: string;
  scheduledAt: string;  // ISO-8601
  address: string;
  createdAt: number;    // Date.now()
}

interface NotificationContextValue {
  notifications: ReadonlyArray<AppNotification>;
  unreadCount: number;
  addNotification: (n: Omit<AppNotification, "id" | "createdAt">) => void;
  markAllRead: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [readCount, setReadCount] = useState(0);

  const addNotification = useCallback(
    (n: Omit<AppNotification, "id" | "createdAt">) => {
      setNotifications((prev) => [
        { ...n, id: crypto.randomUUID(), createdAt: Date.now() },
        ...prev,
      ]);
    },
    []
  );

  const markAllRead = useCallback(() => {
    setReadCount(notifications.length);
  }, [notifications.length]);

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
