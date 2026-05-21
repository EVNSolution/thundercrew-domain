"use client";

import { useEffect, useState, useTransition } from "react";

import { setVehicleIgnitionBlockFromMonitoringAction } from "@/app/monitoring/actions";
import type { BikeCurrentStateResult } from "@/lib/services/bike-current-state-data";
import type { BikeSnapshotResult } from "@/lib/services/dashboard-bike-snapshot-data";
import type { FrontendDashboardBikePin } from "@/lib/services/service-ops-api";

export interface BikeDetailPanelProps {
  pin: FrontendDashboardBikePin;
  onClose: () => void;
}

type FetchOutcome<T> =
  | { phase: "idle" }
  | { phase: "loaded"; result: T }
  | { phase: "error" };

/**
 * Right-edge floating panel that opens when an operator clicks a bike marker.
 * The pin from the polling map-state already carries label/plate/active rider
 * info, so the panel renders immediately. Two parallel fetches enrich it:
 *
 * 1. Single-bike telemetry (`/api/dashboard/bike-current-state/{id}`) fills
 *    the connection / driving / battery / lastReceivedAt rows.
 * 2. Bike snapshot (`/api/dashboard/bike-snapshot/{id}`) fills the rider /
 *    contract / insurance / equipment sections with one backend call (the
 *    backend already joined those four tables in a single read tx).
 */
export function BikeDetailPanel({ pin, onClose }: BikeDetailPanelProps) {
  const [telemetry, setTelemetry] = useState<{
    bikeId: string;
    data: FetchOutcome<BikeCurrentStateResult>;
  }>({ bikeId: pin.bikeId, data: { phase: "idle" } });
  const [snapshot, setSnapshot] = useState<{
    bikeId: string;
    data: FetchOutcome<BikeSnapshotResult>;
  }>({ bikeId: pin.bikeId, data: { phase: "idle" } });

  const isTelemetryFresh = telemetry.bikeId === pin.bikeId;
  const isSnapshotFresh = snapshot.bikeId === pin.bikeId;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/dashboard/bike-current-state/${encodeURIComponent(pin.bikeId)}`, {
      cache: "no-store",
      credentials: "same-origin"
    })
      .then(async (response) => (response.ok ? ((await response.json()) as BikeCurrentStateResult) : null))
      .then((next) => {
        if (cancelled) return;
        setTelemetry({
          bikeId: pin.bikeId,
          data: next ? { phase: "loaded", result: next } : { phase: "error" }
        });
      })
      .catch(() => {
        if (cancelled) return;
        setTelemetry({ bikeId: pin.bikeId, data: { phase: "error" } });
      });
    return () => {
      cancelled = true;
    };
  }, [pin.bikeId]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/dashboard/bike-snapshot/${encodeURIComponent(pin.bikeId)}`, {
      cache: "no-store",
      credentials: "same-origin"
    })
      .then(async (response) => (response.ok ? ((await response.json()) as BikeSnapshotResult) : null))
      .then((next) => {
        if (cancelled) return;
        setSnapshot({
          bikeId: pin.bikeId,
          data: next ? { phase: "loaded", result: next } : { phase: "error" }
        });
      })
      .catch(() => {
        if (cancelled) return;
        setSnapshot({ bikeId: pin.bikeId, data: { phase: "error" } });
      });
    return () => {
      cancelled = true;
    };
  }, [pin.bikeId]);

  const telemetryResult =
    isTelemetryFresh && telemetry.data.phase === "loaded" ? telemetry.data.result : null;
  const telemetryLoading = !isTelemetryFresh || telemetry.data.phase === "idle";
  const live = telemetryResult?.data;

  const snapshotResult =
    isSnapshotFresh && snapshot.data.phase === "loaded" ? snapshot.data.result : null;
  const snapshotLoading = !isSnapshotFresh || snapshot.data.phase === "idle";
  const snap = snapshotResult?.data;

  // 시동 제어 토글 — 라이더 상세 다이얼로그의 토글과 같은 패턴.
  // optimistic state 로 즉시 시각 반영, server action 이 끝나면 다음
  // 폴링/리렌더에서 진실값이 들어와 자동으로 정정된다. 다른 차량을
  // 클릭했을 때 이전 차량의 optimistic 이 남지 않도록 부모(DashboardCanvas)
  // 가 `key={pin.bikeId}` 로 컴포넌트를 재마운트시켜 useState 가 자연스럽게
  // 리셋되도록 한다 (effect 안에서 setState 하는 패턴 회피).
  const [ignitionPending, startIgnitionTransition] = useTransition();
  const [ignitionBlockedOptimistic, setIgnitionBlockedOptimistic] = useState<boolean | null>(null);

  const ignitionBlockedFromServer = snapshotResult?.ignitionBlocked ?? false;
  const effectiveIgnitionBlocked = ignitionBlockedOptimistic ?? ignitionBlockedFromServer;

  const handleIgnitionToggle = () => {
    if (ignitionPending) return;
    const next = !effectiveIgnitionBlocked;
    setIgnitionBlockedOptimistic(next);
    const fd = new FormData();
    fd.append("blocked", next ? "true" : "false");
    startIgnitionTransition(() => {
      void setVehicleIgnitionBlockFromMonitoringAction(pin.bikeId, fd);
    });
  };

  // Telemetry derived values (snapshot does not bundle telemetry — see PR #133).
  const lastReceivedAt = live?.lastReceivedAt ?? pin.lastReceivedAt;
  const connectionStatus = live?.connectionStatus ?? pin.connectionStatus;
  const batteryStatus = live?.batteryStatus ?? pin.batteryStatus;
  const batteryPercent = live?.batteryPercent ?? pin.batteryPercent;
  const speedKph = live?.speedKph ?? pin.speedKph;
  const ignitionStatus = live?.ignitionStatus ?? pin.ignitionStatus;
  const latitude = live?.latitude ?? pin.latitude;
  const longitude = live?.longitude ?? pin.longitude;
  const telemetrySource = live?.telemetrySource ?? pin.telemetrySource;

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
        {/* 헤더 오른쪽: 시동 제어 토글 + 닫기 버튼. 라이더 상세 다이얼로그의
            토글과 동일. 라벨은 항상 "방지" 고정이고 켜짐/꺼짐은 `.is-on` 클래스
            (mint vs 회색 배경) 으로 전달한다 — "방지가 켜져 있다" 라는 한
            개념을 두 단어("방지"/"허용") 로 분기시키지 않고 색만 보면 알 수
            있게. 스크린리더는 aria-checked 로 상태를 받는다. */}
        <div className="bike-detail-panel-controls">
          <div className="detail-field bike-detail-panel-ignition">
            <span className="detail-field-label">시동 제어</span>
            <button
              type="button"
              className={`toggle-switch${effectiveIgnitionBlocked ? " is-on" : ""}`}
              role="switch"
              aria-checked={effectiveIgnitionBlocked}
              aria-label="시동 제어 토글"
              disabled={ignitionPending}
              onClick={handleIgnitionToggle}
            >
              <span className="toggle-switch-thumb" aria-hidden="true" />
              <span className="toggle-switch-text">방지</span>
            </button>
          </div>
          <button
            type="button"
            className="bike-detail-panel-close"
            onClick={onClose}
            aria-label="닫기"
          >
            ✕
          </button>
        </div>
      </header>

      <Section title="텔레메트리">
        <DetailRow label="연결 상태" value={connectionStatus} />
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
        <DetailRow label="텔레메트리 출처" value={telemetrySource} />
        {telemetryLoading ? (
          <p className="bike-detail-panel-status">텔레메트리 조회 중…</p>
        ) : null}
        {!telemetryLoading && telemetryResult?.notice ? (
          <p className="bike-detail-panel-status">{telemetryResult.notice}</p>
        ) : null}
      </Section>

      <Section title="라이더">
        {snap?.rider ? (
          <RiderSection rider={snap.rider} />
        ) : (
          <EmptySectionMessage
            loading={snapshotLoading}
            notice={snapshotResult?.notice}
            empty="활성 계약 라이더 없음"
          />
        )}
      </Section>

      <Section title="활성 계약">
        {snap?.activeContract ? (
          <ContractSection contract={snap.activeContract} />
        ) : (
          <EmptySectionMessage
            loading={snapshotLoading}
            notice={snapshotResult?.notice}
            empty="활성 계약 없음"
          />
        )}
      </Section>

      <Section title="보험">
        {snap?.insurances && snap.insurances.length > 0 ? (
          <InsuranceList insurances={snap.insurances} />
        ) : (
          <EmptySectionMessage
            loading={snapshotLoading}
            notice={snapshotResult?.notice}
            empty="활성 보험 없음"
          />
        )}
      </Section>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bike-detail-panel-section">
      <h3 className="bike-detail-panel-section-title">{title}</h3>
      <dl className="bike-detail-panel-body">{children}</dl>
    </section>
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

function EmptySectionMessage({
  loading,
  notice,
  empty
}: {
  loading: boolean;
  notice: string | undefined;
  empty: string;
}) {
  if (loading) {
    return <p className="bike-detail-panel-status">조회 중…</p>;
  }
  if (notice) {
    return <p className="bike-detail-panel-status">{notice}</p>;
  }
  return <p className="bike-detail-panel-empty">{empty}</p>;
}

function RiderSection({ rider }: { rider: NonNullable<NonNullable<BikeSnapshotResult["data"]>["rider"]> }) {
  return (
    <>
      <DetailRow label="이름" value={rider.name} />
      <DetailRow label="연락처" value={rider.phoneNumber} />
      <DetailRow label="앱 계정" value={rider.appLinkStatus} />
      <DetailRow label="교육 상태" value={rider.latestEducationType ?? "—"} />
    </>
  );
}

function ContractSection({
  contract
}: {
  contract: NonNullable<NonNullable<BikeSnapshotResult["data"]>["activeContract"]>;
}) {
  const periodLabel = `${formatDate(contract.startAt)} ~ ${
    contract.endAt ? formatDate(contract.endAt) : "무기한"
  }`;
  return (
    <>
      <DetailRow label="템플릿" value={contract.templateName} />
      <DetailRow label="시작/종료" value={periodLabel} />
      <DetailRow
        label="보험 포함"
        value={contract.templateIncludesInsurance ? "예" : "아니오"}
      />
    </>
  );
}

function InsuranceList({
  insurances
}: {
  insurances: NonNullable<BikeSnapshotResult["data"]>["insurances"];
}) {
  return (
    <div className="bike-detail-panel-list">
      {insurances.map((row) => {
        const period = row.startsAt
          ? `${formatDate(row.startsAt)} ~ ${row.endsAt ? formatDate(row.endsAt) : "기한 없음"}`
          : "기간 미지정";
        return (
          <div key={row.id} className="bike-detail-panel-list-item">
            <div className="bike-detail-panel-list-title">{row.itemName}</div>
            <div className="bike-detail-panel-list-meta">
              {row.category}
              {row.coverageType ? ` · ${row.coverageType}` : ""}
            </div>
            <div className="bike-detail-panel-list-meta">{period}</div>
          </div>
        );
      })}
    </div>
  );
}



function formatDate(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return iso;
  return new Date(ts).toLocaleDateString("ko-KR");
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
