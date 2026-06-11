"use client";

import { useEffect, useRef, useState } from "react";
import { useNotifications } from "@/components/layout/NotificationContext";

function formatRelativeTime(startedAt: number): string {
  const diffMs = Date.now() - startedAt;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "방금";
  if (diffMin < 60) return `${diffMin}분 전`;
  return `${Math.floor(diffMin / 60)}시간 전`;
}

export function NotificationBell() {
  const { notifications, unreadCount, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next) markAllRead();
  }

  return (
    <div className="notif-bell-wrapper" ref={wrapperRef}>
      <button
        type="button"
        className="notif-bell-btn"
        onClick={handleToggle}
        aria-label={`알림${unreadCount > 0 ? ` (읽지 않은 알림 ${unreadCount}건)` : ""}`}
      >
        🔔
        {unreadCount > 0 && (
          <span className="notif-badge" aria-hidden="true">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="notif-dropdown" role="list" aria-label="이동 알림 이력">
          {notifications.length === 0 ? (
            <div className="notif-empty">알림 없음</div>
          ) : (
            [...notifications].reverse().map((n) => (
              <div key={n.id} className="notif-item" role="listitem">
                <span className="notif-item-text">
                  {(() => {
                    const kindLabel = n.kind === "PICKUP" ? "수거" : n.kind === "DELIVERY" ? "배송" : "";
                    return <>🔑 {n.plateNumber}{kindLabel ? ` ${kindLabel}` : ""} 출발{n.customerName ? ` → ${n.customerName}` : ""}{n.address ? ` (${n.address})` : ""}</>;
                  })()}
                </span>
                <span className="notif-item-time">{formatRelativeTime(n.startedAt)}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
