"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
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
  if (type === "CLEANING_DUE") return "🕐";
  if (type === "CLEANING_DELAYED") return "⏰";
  return "📍";
}

function typeItemClass(type: string): string {
  if (type === "MAINTENANCE_ALARM") return "notif-item notif-item--maintenance";
  if (type === "REIGNITION") return "notif-item notif-item--reignition";
  return "notif-item notif-item--other";
}

/** 토스트 자동 소멸 시간. */
const TOAST_DURATION_MS = 10_000;
const MAX_TOASTS = 3;

type Toast = { id: string; title: string; body: string | null; expiresAt: number };

export function NotificationBell() {
  const { unifiedNotifications, unreadCount, lastSeenAt, markAllRead, acknowledge } = useNotifications();
  const [open, setOpen] = useState(false);
  // Snapshot of Date.now() captured in an effect/handler — never during render (react-hooks/purity)
  const [now, setNow] = useState(0);
  // 패널을 연 순간의 lastSeen 스냅샷 — 열자마자 markAllRead 로 기준이
  // 갱신되므로, 안 읽음/읽음 구분은 이 스냅샷으로 유지한다.
  const [seenSnapshot, setSeenSnapshot] = useState(0);
  // 새 알림 토스트 — 벨 근처에 10초 표시, 클릭하면 알림 창을 연다.
  const [toasts, setToasts] = useState<Toast[]>([]);
  const knownIdsRef = useRef<Set<string> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

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
      const target = e.target as Node;
      // 패널은 portal 로 body 에 렌더되므로 wrapper 포함 여부만으로는
      // 패널 내부 클릭도 "바깥" 으로 판정된다 — 둘 다 검사.
      if (wrapperRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
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
      setSeenSnapshot(lastSeenAt);
      setToasts([]);
      markAllRead();
      setNow(Date.now());
    }
  }

  // 새로 도착한 알림 → 토스트. 초기 fetch(비동기)로 뒤늦게 채워지는 과거
  // 알림이 "새 알림" 으로 뜨지 않도록, 마운트 시각 이후에 발생(occurredAt)한
  // 안 읽은 알림만 토스트 대상으로 삼는다 — id 미등록 여부만으로 판정하면
  // 첫 응답 전체가 fresh 로 오인된다.
  const mountAtRef = useRef(0);
  useEffect(() => {
    if (mountAtRef.current === 0) mountAtRef.current = Date.now();
    if (knownIdsRef.current === null) knownIdsRef.current = new Set();
    const known = knownIdsRef.current;
    const fresh = unifiedNotifications.filter(
      (n) => !known.has(n.id) && n.unread && n.occurredAt > mountAtRef.current
    );
    for (const n of unifiedNotifications) known.add(n.id);
    if (fresh.length === 0) return;
    if (open) return; // 알림 창이 이미 열려 있으면 토스트 불필요
    const expiresAt = Date.now() + TOAST_DURATION_MS;
    setToasts((prev) =>
      [...fresh.map((n) => ({ id: n.id, title: n.title, body: n.body, expiresAt })), ...prev].slice(0, MAX_TOASTS)
    );
  }, [unifiedNotifications, open]);

  // 토스트 자동 소멸 — 각자 등장 10초 뒤. 타이머는 "가장 이른 만료" 까지만
  // 걸어, 새 토스트가 와도 기존 토스트 수명이 연장되지 않는다.
  useEffect(() => {
    if (toasts.length === 0) return;
    const nextExpiry = Math.min(...toasts.map((t) => t.expiresAt));
    const timer = setTimeout(() => {
      const cutoff = Date.now();
      setToasts((prev) => prev.filter((t) => t.expiresAt > cutoff));
    }, Math.max(0, nextExpiry - Date.now()));
    return () => clearTimeout(timer);
  }, [toasts]);

  // 종류 구분 없는 최신순 목록 — 안 읽음(패널 연 시점 기준)과 읽음으로만 나눈다.
  const unreadItems = unifiedNotifications.filter((n) => n.occurredAt > seenSnapshot);
  const readItems = unifiedNotifications.filter((n) => n.occurredAt <= seenSnapshot);

  return (
    <div className="notif-bell-wrapper" ref={wrapperRef}>
      {/* 새 알림 토스트 — 벨 위로 떠서 10초 뒤 사라지고, 누르면 알림 창. */}
      {toasts.length > 0 && !open ? (
        <div className="notif-toast-stack" role="status">
          {toasts.map((t) => (
            <button
              key={t.id}
              type="button"
              className="notif-toast"
              onClick={() => {
                setToasts([]);
                setSeenSnapshot(lastSeenAt);
                markAllRead();
                setNow(Date.now());
                setOpen(true);
              }}
            >
              <span className="notif-toast-title">{t.title}</span>
              {t.body ? <span className="notif-toast-body">{t.body}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
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

      {/* Right-side slide panel — body portal. 벨이 지도 하단 패널처럼
          transform 을 가진 조상 안에 있으면 position:fixed 의 기준이 그
          조상으로 바뀌어 화면 밖으로 밀려난다. portal 이면 항상 뷰포트
          오른쪽 사이드에 붙는다. */}
      {open && createPortal(
        <div
          ref={panelRef}
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
              <>
                {unreadItems.length > 0 ? (
                  <div className="notif-group-header">
                    <span className="notif-group-label">안 읽음</span>
                    <span className="notif-group-count">{unreadItems.length}</span>
                  </div>
                ) : null}
                {unreadItems.map((n) => (
                  <NotifRow key={n.id} n={n} unread now={now} onAcknowledge={acknowledge} />
                ))}
                {readItems.length > 0 ? (
                  <div className="notif-group-header">
                    <span className="notif-group-label">읽음</span>
                    <span className="notif-group-count">{readItems.length}</span>
                  </div>
                ) : null}
                {readItems.map((n) => (
                  <NotifRow key={n.id} n={n} unread={false} now={now} onAcknowledge={acknowledge} />
                ))}
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function NotifRow({
  n,
  unread,
  now,
  onAcknowledge
}: {
  n: UnifiedNotification;
  unread: boolean;
  now: number;
  onAcknowledge: (id: string) => void;
}) {
  return (
    <div
      className={`${typeItemClass(n.type)}${unread ? " notif-item--unread" : ""}`}
      role="listitem"
    >
      <div className="notif-item-content">
        <span className="notif-item-text">
          <span className="notif-group-icon">{typeIcon(n.type)}</span> {n.title}
        </span>
        {n.body && <span className="notif-item-body">{n.body}</span>}
      </div>
      <div className="notif-item-meta">
        <span className="notif-item-time">{now > 0 ? formatRelativeTime(n.occurredAt, now) : ""}</span>
        {n.type !== "REIGNITION" && !n.acknowledged ? (
          <button type="button" className="notif-ack-btn" onClick={() => onAcknowledge(n.id)}>
            확인
          </button>
        ) : null}
      </div>
    </div>
  );
}
