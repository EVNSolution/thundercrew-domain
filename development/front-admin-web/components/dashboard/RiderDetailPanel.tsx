"use client";

import Link from "next/link";
import { useState } from "react";
import {
  PanelInfoSection,
  type PanelInfoSectionRow,
} from "@/components/dashboard/PanelInfoSection";
import type { ControlMapRider } from "@/lib/services/dashboard-map-data";

interface RiderDetailPanelProps {
  rider: ControlMapRider | null;
  onClose: () => void;
}

// designs/rider-position-monitor.pen Component/{Light,Dark}/RiderDetailPanel
// names the action set explicitly — they fire local feedback only until the
// service-ops command path is wired up.
const RIDER_ACTIONS = [
  { id: "lock", label: "Lock" },
  { id: "ignition", label: "시동" },
  { id: "horn", label: "Horn" },
  { id: "hazard", label: "Hazard", emphasis: true },
  { id: "highbeam", label: "상향등" },
] as const;

const PLACEHOLDER = "—";

function formatBatteryAndSpeed(rider: ControlMapRider): PanelInfoSectionRow[] {
  const battery = rider.vehicleBatteryPercent;
  const batteryLabel = typeof battery === "number" ? `${battery}%` : PLACEHOLDER;
  return [
    { label: "배터리", value: batteryLabel },
    { label: "속도", value: PLACEHOLDER },
  ];
}

function formatStatusAndLocation(rider: ControlMapRider): PanelInfoSectionRow[] {
  return [
    { label: "운행 상태", value: rider.vehicleStatus ?? PLACEHOLDER },
    { label: "위치", value: rider.area || PLACEHOLDER },
    { label: "도착 예정", value: PLACEHOLDER },
  ];
}

export function RiderDetailPanel({ rider, onClose }: RiderDetailPanelProps) {
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!rider) return null;

  const subtitle = rider.connectionStatus
    ? `라이더 상태 / ${rider.connectionStatus}`
    : "라이더 상태 / 업데이트";

  function handleAction(label: string) {
    const ts = new Date().toLocaleTimeString();
    setFeedback(`${label} 명령이 ${ts}에 로컬 검증으로 처리됐습니다.`);
  }

  return (
    <aside className="rm-rider-detail-panel" aria-label={`${rider.name} 라이더 상세`}>
      <header className="rm-rider-detail-panel-header">
        <div className="rm-rider-detail-panel-headline">
          <h2 className="rm-rider-detail-panel-title">{rider.name}</h2>
          <p className="rm-rider-detail-panel-subtitle">{subtitle}</p>
        </div>
        <button
          type="button"
          className="rm-rider-detail-panel-close"
          aria-label="라이더 상세 닫기"
          onClick={onClose}
        >
          ×
        </button>
      </header>

      <div className="rm-rider-detail-panel-sections">
        <PanelInfoSection rows={formatBatteryAndSpeed(rider)} />
        <PanelInfoSection rows={formatStatusAndLocation(rider)} />
      </div>

      <section className="rm-rider-detail-panel-actions" aria-label="라이더 원격 명령">
        <p className="rm-rider-detail-panel-actions-label">Action</p>
        <div className="rm-rider-detail-panel-actions-grid">
          {RIDER_ACTIONS.map((action) => (
            <button
              key={action.id}
              type="button"
              className={
                "rm-action-button" + ("emphasis" in action ? " is-emphasis" : "")
              }
              onClick={() => handleAction(action.label)}
            >
              {action.label}
            </button>
          ))}
        </div>
        {feedback ? (
          <p className="rm-rider-detail-panel-feedback" role="status">{feedback}</p>
        ) : null}
      </section>

      {rider.detailHref ? (
        <div className="rm-rider-detail-panel-footer">
          <Link className="rm-rider-detail-panel-link" href={rider.detailHref}>
            라이더 상세로 이동 →
          </Link>
        </div>
      ) : null}
    </aside>
  );
}
