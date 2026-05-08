"use client";

import { useEffect, useState } from "react";

import type { BatteryStationDetailResult } from "@/lib/services/battery-station-detail-data";
import type { FrontendDashboardStationPin } from "@/lib/services/service-ops-api";

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

  const isFresh = outcome.stationId === pin.stationId;

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
  const live = result?.data;

  // Prefer freshly-fetched single state; fall back to map-state pin.
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
    </aside>
  );
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
