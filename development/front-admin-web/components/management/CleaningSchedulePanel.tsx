// development/front-admin-web/components/management/CleaningSchedulePanel.tsx
"use client";

import { useEffect, useState } from "react";
import {
  createCleaningSchedule,
  fetchCleaningSchedules,
  type CleaningSchedule,
} from "@/lib/services/cleaning-schedule-api";
import { useNotifications } from "@/components/layout/NotificationContext";

interface CleaningSchedulePanelProps {
  bikeId: string;         // UUID string
  bikePlateNumber: string;
}

export function CleaningSchedulePanel({ bikeId, bikePlateNumber }: CleaningSchedulePanelProps) {
  const { addNotification } = useNotifications();
  const [schedules, setSchedules] = useState<CleaningSchedule[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSchedules([]);
    fetchCleaningSchedules(bikeId)
      .then(setSchedules)
      .catch((err) => console.error("Failed to load schedules:", err));
  }, [bikeId]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const date = String(fd.get("date") ?? "").trim();
    const time = String(fd.get("time") ?? "").trim();
    const address = String(fd.get("address") ?? "").trim();
    const memo = String(fd.get("memo") ?? "").trim() || undefined;
    if (!date || !time || !address) return;

    const scheduledAt = `${date}T${time}:00`;
    setSubmitting(true);
    try {
      const created = await createCleaningSchedule({ bikeId, scheduledAt, address, memo });
      setSchedules((prev) =>
        [...prev, created].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
      );
      addNotification({ bikePlateNumber, scheduledAt, address });
      (e.target as HTMLFormElement).reset();
      setFormOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "발송 실패");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <aside className="cleaning-schedule-panel" aria-label="클리닝 일정">
      <div className="cleaning-schedule-panel-header">
        <span className="cleaning-schedule-panel-title">📅 클리닝 일정</span>
        <span className="cleaning-schedule-panel-plate">{bikePlateNumber}</span>
        <button
          type="button"
          className="cleaning-schedule-add-btn"
          onClick={() => { setFormOpen((v) => !v); setError(null); }}
        >
          {formOpen ? "취소" : "+ 일정 추가"}
        </button>
      </div>

      {formOpen && (
        <form className="cleaning-schedule-form" onSubmit={handleSubmit}>
          <div className="cleaning-schedule-form-row">
            <input
              type="date"
              name="date"
              required
              className="cleaning-schedule-input"
              aria-label="날짜"
            />
            <input
              type="time"
              name="time"
              required
              className="cleaning-schedule-input"
              aria-label="시간"
            />
          </div>
          <input
            type="text"
            name="address"
            placeholder="주소"
            required
            className="cleaning-schedule-input cleaning-schedule-input--full"
            aria-label="주소"
          />
          <input
            type="text"
            name="memo"
            placeholder="메모 (선택)"
            className="cleaning-schedule-input cleaning-schedule-input--full"
            aria-label="메모"
          />
          {error && <p className="cleaning-schedule-error">{error}</p>}
          <button
            type="submit"
            className="cleaning-schedule-submit-btn"
            disabled={submitting}
          >
            {submitting ? "발송 중..." : "콜 발송"}
          </button>
        </form>
      )}

      <div className="cleaning-schedule-list">
        {schedules.length === 0 ? (
          <div className="cleaning-schedule-empty">등록된 일정 없음</div>
        ) : (
          schedules.map((s) => (
            <div key={s.id} className="cleaning-schedule-item">
              <div className="cleaning-schedule-item-time">
                {formatScheduledAt(s.scheduledAt)}
              </div>
              <div className="cleaning-schedule-item-address">{s.address}</div>
              {s.memo && (
                <div className="cleaning-schedule-item-memo">{s.memo}</div>
              )}
            </div>
          ))
        )}
      </div>
    </aside>
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
