"use client";

import { useEffect, useState, type FormEvent } from "react";

import type { BatteryStationDetailResult } from "@/lib/services/battery-station-detail-data";
import type { FrontendBatteryStation, FrontendDashboardStationPin } from "@/lib/services/service-ops-api";

type CountUpdateOutcome =
  | { phase: "idle" }
  | { phase: "submitting" }
  | { phase: "success"; station: FrontendBatteryStation }
  | { phase: "error"; notice: string };

export interface StationDetailPanelProps {
  pin: FrontendDashboardStationPin;
  onClose: () => void;
}

type FetchOutcome =
  | { phase: "idle" }
  | { phase: "loaded"; result: BatteryStationDetailResult }
  | { phase: "error" };

/**
 * Right-edge floating panel that opens when an operator clicks a station
 * marker. Renders immediately from the StationPin (label, lat/lng, available
 * battery count) and enriches with the single-station fetch when it lands.
 *
 * The outcome state is keyed on stationId — a click that swaps the panel to
 * a different station resets the fetch outcome on the next render rather
 * than via a synchronous setState inside useEffect (the React 19 purity
 * lint rule blocks the latter).
 */
export function StationDetailPanel({ pin, onClose }: StationDetailPanelProps) {
  const [outcome, setOutcome] = useState<{ stationId: string; data: FetchOutcome }>({
    stationId: pin.stationId,
    data: { phase: "idle" }
  });
  const [countUpdate, setCountUpdate] = useState<{ stationId: string; outcome: CountUpdateOutcome }>({
    stationId: pin.stationId,
    outcome: { phase: "idle" }
  });

  const isFresh = outcome.stationId === pin.stationId;
  const countUpdateFresh = countUpdate.stationId === pin.stationId;
  const countUpdateOutcome: CountUpdateOutcome = countUpdateFresh ? countUpdate.outcome : { phase: "idle" };

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/dashboard/battery-station/${encodeURIComponent(pin.stationId)}`, {
      cache: "no-store",
      credentials: "same-origin"
    })
      .then(async (response) => (response.ok ? ((await response.json()) as BatteryStationDetailResult) : null))
      .then((next) => {
        if (cancelled) return;
        setOutcome({
          stationId: pin.stationId,
          data: next ? { phase: "loaded", result: next } : { phase: "error" }
        });
      })
      .catch(() => {
        if (cancelled) return;
        setOutcome({ stationId: pin.stationId, data: { phase: "error" } });
      });
    return () => {
      cancelled = true;
    };
  }, [pin.stationId]);

  const result = isFresh && outcome.data.phase === "loaded" ? outcome.data.result : null;
  const loading = !isFresh || outcome.data.phase === "idle";
  // Prefer the freshly-updated station from the inline count edit if it
  // succeeded; otherwise fall back to the single fetch result; finally to
  // the map-state pin.
  const updated = countUpdateOutcome.phase === "success" ? countUpdateOutcome.station : null;
  const live = updated ?? result?.data ?? null;

  const name = live?.name ?? pin.name;
  const address = live?.address ?? pin.address;
  const status = live?.stationStatus ?? pin.status;
  const maxBatteryCapacity = live?.maxBatteryCapacity ?? pin.maxBatteryCapacity;
  const currentBatteryCount = live?.currentBatteryCount ?? pin.currentBatteryCount;
  const availableBatteryCount = live?.availableBatteryCount ?? pin.availableBatteryCount;
  const availableBatteryLabel = live?.availableBatteryLabel ?? pin.availableBatteryLabel;
  const capacityPercentage = live?.capacityPercentage ?? pin.availableBatteryPercentage;
  const latitude = live?.latitude ?? pin.latitude;
  const longitude = live?.longitude ?? pin.longitude;
  const updatedAt = live?.updatedAt ?? null;

  async function handleCountUpdateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const stationId = pin.stationId;
    setCountUpdate({ stationId, outcome: { phase: "submitting" } });
    try {
      const response = await fetch(
        `/api/dashboard/battery-station/${encodeURIComponent(stationId)}/battery-counts`,
        {
          body: JSON.stringify({
            maxBatteryCapacity: numberOrNull(formData.get("maxBatteryCapacity")),
            currentBatteryCount: numberOrNull(formData.get("currentBatteryCount")),
            availableBatteryCount: numberOrNull(formData.get("availableBatteryCount")),
            reason: stringOrNull(formData.get("reason"))
          }),
          cache: "no-store",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          method: "POST"
        }
      );
      const body = (await response.json()) as {
        ok: boolean;
        station: FrontendBatteryStation | null;
        notice?: string;
      };
      if (body.ok && body.station) {
        setCountUpdate({ stationId, outcome: { phase: "success", station: body.station } });
      } else {
        setCountUpdate({
          stationId,
          outcome: { phase: "error", notice: body.notice ?? "카운트 갱신 실패." }
        });
      }
    } catch {
      setCountUpdate({
        stationId,
        outcome: { phase: "error", notice: "네트워크 오류로 카운트 갱신에 실패했습니다." }
      });
    }
  }

  return (
    <aside
      className="bike-detail-panel"
      role="complementary"
      aria-label={`충전소 ${name} 상세`}
    >
      <header className="bike-detail-panel-header">
        <div>
          <span className="bike-detail-panel-eyebrow">충전소 상세</span>
          <h2>{name}</h2>
          <p>{address}</p>
        </div>
        <button
          type="button"
          className="bike-detail-panel-close"
          onClick={onClose}
          aria-label="닫기"
        >
          ✕
        </button>
      </header>

      <dl className="bike-detail-panel-body">
        <DetailRow label="상태" value={statusLabel(status)} />
        <DetailRow label="가용 배터리" value={availableBatteryLabel} />
        <DetailRow label="현재/최대" value={`${currentBatteryCount} / ${maxBatteryCapacity}`} />
        <DetailRow label="가용 수량" value={`${availableBatteryCount}`} />
        <DetailRow label="가용율" value={`${capacityPercentage}%`} />
        <DetailRow label="위치" value={`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`} />
        {updatedAt ? <DetailRow label="마지막 업데이트" value={formatRelative(updatedAt)} /> : null}
      </dl>

      {loading ? (
        <p className="bike-detail-panel-status" role="status">충전소 상세 조회 중…</p>
      ) : null}
      {!loading && result?.notice ? (
        <p className="bike-detail-panel-status" role="status">{result.notice}</p>
      ) : null}

      <form className="station-count-edit" onSubmit={handleCountUpdateSubmit}>
        <h3 className="bike-detail-panel-section-title">배터리 카운트 변경</h3>
        <div className="station-count-edit-grid">
          <label className="station-count-edit-field">
            <span>최대</span>
            <input
              className="input"
              defaultValue={maxBatteryCapacity}
              key={`max-${pin.stationId}-${live?.updatedAt ?? "init"}`}
              min={0}
              name="maxBatteryCapacity"
              required
              type="number"
            />
          </label>
          <label className="station-count-edit-field">
            <span>현재</span>
            <input
              className="input"
              defaultValue={currentBatteryCount}
              key={`current-${pin.stationId}-${live?.updatedAt ?? "init"}`}
              min={0}
              name="currentBatteryCount"
              required
              type="number"
            />
          </label>
          <label className="station-count-edit-field">
            <span>가용</span>
            <input
              className="input"
              defaultValue={availableBatteryCount}
              key={`available-${pin.stationId}-${live?.updatedAt ?? "init"}`}
              min={0}
              name="availableBatteryCount"
              required
              type="number"
            />
          </label>
        </div>
        <label className="station-count-edit-field-wide">
          <span>변경 사유 (선택)</span>
          <input
            className="input"
            maxLength={100}
            name="reason"
            placeholder="예: 배터리 5개 신규 입고"
            type="text"
          />
        </label>
        <div className="station-count-edit-actions">
          <button
            className="button-primary"
            disabled={countUpdateOutcome.phase === "submitting"}
            type="submit"
          >
            {countUpdateOutcome.phase === "submitting" ? "갱신 중…" : "카운트 갱신"}
          </button>
        </div>
        {countUpdateOutcome.phase === "error" ? (
          <p className="action-feedback" role="status">{countUpdateOutcome.notice}</p>
        ) : null}
        {countUpdateOutcome.phase === "success" ? (
          <p className="action-feedback" role="status">카운트가 갱신되었습니다.</p>
        ) : null}
      </form>
    </aside>
  );
}

function numberOrNull(value: FormDataEntryValue | null): number | null {
  if (value === null) return null;
  const text = String(value).trim();
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function stringOrNull(value: FormDataEntryValue | null): string | null {
  if (value === null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="bike-detail-panel-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function statusLabel(status: string): string {
  switch (status) {
    case "ACTIVE":
      return "운영 중";
    case "MAINTENANCE":
      return "점검 중";
    case "INACTIVE":
      return "비활성";
    case "운영":
      return "운영 중";
    case "점검":
      return "점검 중";
    case "비활성":
      return "비활성";
    default:
      return status ?? "—";
  }
}

function formatRelative(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return iso;
  const ageMs = Date.now() - ts;
  if (ageMs < 60_000) return `${Math.max(1, Math.round(ageMs / 1000))}초 전`;
  if (ageMs < 3_600_000) return `${Math.round(ageMs / 60_000)}분 전`;
  if (ageMs < 86_400_000) return `${Math.round(ageMs / 3_600_000)}시간 전`;
  return new Date(ts).toLocaleString("ko-KR");
}
