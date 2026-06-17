"use client";

import { useEffect, useRef, useState } from "react";
import { useNotifications, type UnifiedNotification } from "@/components/layout/NotificationContext";

function formatRelativeTime(occurredAt: number, now: number): string {
  const diffMs = now - occurredAt;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "방금";
  if (diffMin < 60) return `${diffMin}분 전`;
  return `${Math.floor(diffMin / 60)}시간 전`;
}

function typeIcon(type: string): string {
  if (type === "MAINTENANCE_ALARM") return "⚙️";
  if (type === "REIGNITION") return "🔑";
  return "📍";
}

function typeLabel(type: string): string {
  if (type === "MAINTENANCE_ALARM") return "정비 알람";
  if (type === "REIGNITION") return "시동 알림";
  return "알림";
}

function typeItemClass(type: string): string {
  if (type === "MAINTENANCE_ALARM") return "notif-item notif-item--maintenance";
  if (type === "REIGNITION") return "notif-item notif-item--reignition";
  return "notif-item notif-item--other";
}

function groupByType(items: UnifiedNotification[]): Map<string, UnifiedNotification[]> {
  const map = new Map<string, UnifiedNotification[]>();
  for (const item of items) {
    const arr = map.get(item.type) ?? [];
    arr.push(item);
    map.set(item.type, arr);
  }
  return map;
}

// Type display order
const TYPE_ORDER = ["MAINTENANCE_ALARM", "REIGNITION"];

function sortedTypes(types: string[]): string[] {
  const ordered = TYPE_ORDER.filter((t) => types.includes(t));
  const rest = types.filter((t) => !TYPE_ORDER.includes(t)).sort();
  return [...ordered, ...rest];
}

export function NotificationBell() {
  const { unifiedNotifications, unreadCount, markAllRead, acknowledge } = useNotifications();
  const [open, setOpen] = useState(false);
  // Snapshot of Date.now() captured in an effect/handler — never during render (react-hooks/purity)
  const [now, setNow] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Update "now" every 30s while panel is open.
  // The first tick fires at 0 ms (asynchronous, not synchronous in effect body).
  useEffect(() => {
    if (!open) return;
    const tick = () => setNow(Date.now());
    const t0 = setTimeout(tick, 0);
    const interval = setInterval(tick, 30_000);
    return () => {
      clearTimeout(t0);
      clearInterval(interval);
    };
  }, [open]);

  // Close on outside click
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

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      markAllRead();
      setNow(Date.now());
    }
  }

  // Un-acknowledged generic items first, then rest — within each type already sorted by occurredAt desc
  const unacknowledged = unifiedNotifications.filter((n) => !n.acknowledged);
  const acknowledged = unifiedNotifications.filter((n) => n.acknowledged);
  const sorted = [...unacknowledged, ...acknowledged];

  const grouped = groupByType(sorted);
  const types = sortedTypes([...grouped.keys()]);

  return (
    <div className="notif-bell-wrapper" ref={wrapperRef}>
      <button
        type="button"
        className="notif-bell-btn"
        onClick={handleToggle}
        aria-label={`알림${unreadCount > 0 ? ` (읽지 않은 알림 ${unreadCount}건)` : ""}`}
        aria-expanded={open}
      >
        🔔
        {unreadCount > 0 && (
          <span className="notif-badge" aria-hidden="true">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Right-side slide panel */}
      {open && (
        <div
          className="notif-panel"
          role="dialog"
          aria-label="알림 센터"
        >
          <div className="notif-panel-header">
            <span className="notif-panel-title">알림 센터</span>
            <button
              type="button"
              className="notif-panel-close"
              aria-label="닫기"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </div>

          <div className="notif-panel-body">
            {unifiedNotifications.length === 0 ? (
              <div className="notif-empty">알림 없음</div>
            ) : (
              types.map((type) => {
                const items = grouped.get(type) ?? [];
                return (
                  <section key={type} className="notif-group">
                    <div className="notif-group-header">
                      <span className="notif-group-icon">{typeIcon(type)}</span>
                      <span className="notif-group-label">{typeLabel(type)}</span>
                      <span className="notif-group-count">{items.length}</span>
                    </div>
                    {items.map((n) => (
                      <div
                        key={n.id}
                        className={`${typeItemClass(n.type)}${!n.acknowledged ? " notif-item--unread" : ""}`}
                        role="listitem"
                      >
                        <div className="notif-item-content">
                          <span className="notif-item-text">{n.title}</span>
                          {n.body && <span className="notif-item-body">{n.body}</span>}
                        </div>
                        <div className="notif-item-meta">
                          <span className="notif-item-time">
                            {now > 0 ? formatRelativeTime(n.occurredAt, now) : ""}
                          </span>
                          {n.type !== "REIGNITION" && !n.acknowledged && (
                            <button
                              type="button"
                              className="notif-ack-btn"
                              onClick={() => acknowledge(n.id)}
                            >
                              확인
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </section>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
