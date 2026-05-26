// development/front-admin-web/components/layout/NotificationBell.tsx
"use client";

import { useState } from "react";
import { useNotifications } from "@/components/layout/NotificationContext";

export function NotificationBell() {
  const { notifications, unreadCount, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);

  function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next) markAllRead();
  }

  return (
    <div className="notif-bell-wrap">
      <button
        type="button"
        className="notif-bell-btn"
        onClick={handleToggle}
        aria-label={`알림${unreadCount > 0 ? ` (${unreadCount}개 미읽음)` : ""}`}
      >
        🔔
        {unreadCount > 0 && (
          <span className="notif-bell-badge" aria-hidden="true">
            {unreadCount}
          </span>
        )}
      </button>
      {open && (
        <>
          {/* 드롭다운 외부 클릭 닫기 */}
          <div
            className="notif-backdrop"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="notif-dropdown" role="list" aria-label="알림 목록">
            <div className="notif-dropdown-header">알림</div>
            {notifications.length === 0 ? (
              <div className="notif-empty">알림 없음</div>
            ) : (
              notifications.slice(0, 20).map((n) => (
                <div key={n.id} className="notif-item" role="listitem">
                  <div className="notif-item-title">🔔 콜 발송됨</div>
                  <div className="notif-item-body">
                    {n.bikePlateNumber} → {n.address}
                  </div>
                  <div className="notif-item-time">
                    {formatScheduledAt(n.scheduledAt)}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

function formatScheduledAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
