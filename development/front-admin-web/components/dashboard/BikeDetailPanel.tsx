"use client";

import { useEffect, useState } from "react";

import type { BikeCurrentStateResult } from "@/lib/services/bike-current-state-data";
import type { FrontendDashboardBikePin } from "@/lib/services/service-ops-api";

export interface BikeDetailPanelProps {
  pin: FrontendDashboardBikePin;
  onClose: () => void;
}

type FetchOutcome =
  | { phase: "idle" }
  | { phase: "loaded"; result: BikeCurrentStateResult }
  | { phase: "error" };

/**
 * Right-edge floating panel that opens when an operator clicks a bike marker.
 * The pin from the polling map-state already carries label/plate/active rider
 * info, so the panel renders immediately. The single-bike telemetry endpoint
 * is fetched in parallel and fills the connection / driving / battery /
 * lastReceivedAt rows when it returns.
 */
export function BikeDetailPanel({ pin, onClose }: BikeDetailPanelProps) {
  // Keyed on bikeId so a click that swaps the panel to a different bike
  // resets the fetch outcome on the next render rather than via a synchronous
  // setState inside useEffect (the lint rule that bans the latter).
  const [outcome, setOutcome] = useState<{ bikeId: string; data: FetchOutcome }>({
    bikeId: pin.bikeId,
    data: { phase: "idle" }
  });

  const isFresh = outcome.bikeId === pin.bikeId;

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/dashboard/bike-current-state/${encodeURIComponent(pin.bikeId)}`, {
      cache: "no-store",
      credentials: "same-origin"
    })
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }
        return (await response.json()) as BikeCurrentStateResult;
      })
      .then((next) => {
        if (cancelled) return;
        setOutcome({
          bikeId: pin.bikeId,
          data: next ? { phase: "loaded", result: next } : { phase: "error" }
        });
      })
      .catch(() => {
        if (cancelled) return;
        setOutcome({ bikeId: pin.bikeId, data: { phase: "error" } });
      });

    return () => {
      cancelled = true;
    };
  }, [pin.bikeId]);

  const result =
    isFresh && outcome.data.phase === "loaded" ? outcome.data.result : null;
  const loading = !isFresh || outcome.data.phase === "idle";
  const live = result?.data;

  // Prefer the freshly-fetched single state; fall back to map-state pin which
  // is at most one polling cycle (10s) stale.
  const lastReceivedAt = live?.lastReceivedAt ?? pin.lastReceivedAt;
  const connectionStatus = live?.connectionStatus ?? pin.connectionStatus;
  const drivingStatus = live?.drivingStatus ?? pin.drivingStatus;
  const batteryStatus = live?.batteryStatus ?? pin.batteryStatus;
  const batteryPercent = live?.batteryPercent ?? pin.batteryPercent;
  const speedKph = live?.speedKph ?? pin.speedKph;
  const ignitionStatus = live?.ignitionStatus ?? pin.ignitionStatus;
  const latitude = live?.latitude ?? pin.latitude;
  const longitude = live?.longitude ?? pin.longitude;

  return (
    <aside
      className="bike-detail-panel"
      role="complementary"
      aria-label={`차량 ${pin.plateNumber} 상세`}
    >
      <header className="bike-detail-panel-header">
        <div>
          <span className="bike-detail-panel-eyebrow">차량 상세</span>
          <h2>{pin.plateNumber}</h2>
          <p>{pin.modelName ?? "모델 미지정"}</p>
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
        <DetailRow label="활성 라이더" value={pin.activeRiderLabel ?? "미배정"} />
        <DetailRow label="연결 상태" value={connectionStatus} />
        <DetailRow label="주행 상태" value={drivingStatus} />
        <DetailRow label="시동" value={ignitionStatus} />
        <DetailRow
          label="속도"
          value={speedKph != null ? `${speedKph.toFixed(1)} km/h` : "—"}
        />
        <DetailRow
          label="배터리"
          value={
            batteryPercent != null
              ? `${batteryPercent.toFixed(0)}% · ${batteryStatus}`
              : batteryStatus
          }
        />
        <DetailRow
          label="위치"
          value={`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`}
        />
        <DetailRow label="마지막 수신" value={formatRelative(lastReceivedAt)} />
        <DetailRow label="텔레메트리 출처" value={live?.telemetrySource ?? pin.telemetrySource} />
      </dl>

      {loading ? (
        <p className="bike-detail-panel-status" role="status">단일 차량 텔레메트리 조회 중…</p>
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

function formatRelative(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return iso;
  const ageMs = Date.now() - ts;
  if (ageMs < 60_000) return `${Math.max(1, Math.round(ageMs / 1000))}초 전`;
  if (ageMs < 3_600_000) return `${Math.round(ageMs / 60_000)}분 전`;
  if (ageMs < 86_400_000) return `${Math.round(ageMs / 3_600_000)}시간 전`;
  return new Date(ts).toLocaleString("ko-KR");
}
