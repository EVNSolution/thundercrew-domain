"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  startTelemetryReceiveAction,
  stopTelemetryReceiveAction
} from "@/app/management/telemetry/actions";

/**
 * 자원관리 페이지 상단의 "단말 데이터 수신" 제어 카드.
 *
 * 시작 버튼은 백엔드가 OTOPLUG NT observer(driving · drivingDetail)를 등록해
 * 단말 텔레메트리가 유입되게 하고, 중지 버튼은 observer 를 해제한다. 초기
 * 상태는 server component 가 `initialActive` 로 내려준다.
 */
export function TelemetryReceiveControl({ initialActive }: { initialActive: boolean }) {
  const router = useRouter();
  const [active, setActive] = useState(initialActive);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleStart = () => {
    if (active || pending) return;
    setActionError(null);
    startTransition(async () => {
      const result = await startTelemetryReceiveAction();
      if (result.ok) {
        setActive(true);
        router.refresh();
      } else {
        setActionError(result.message ?? "수신 시작 실패 — OTOPLUG 설정을 확인하세요.");
      }
    });
  };

  const handleStop = () => {
    if (!active || pending) return;
    if (!window.confirm("단말 데이터 수신을 중지할까요? OTOPLUG observer가 해제됩니다.")) return;
    setActionError(null);
    startTransition(async () => {
      const result = await stopTelemetryReceiveAction();
      if (result.ok) {
        setActive(false);
        router.refresh();
      } else {
        setActionError(result.message ?? "수신 중지 실패.");
      }
    });
  };

  return (
    <div className="management-panel">
      <div className="mgmt-panel-header">
        <div className="mgmt-panel-header-left">
          <span className="mgmt-panel-title">단말 데이터 수신</span>
          {active ? (
            <span className="status-badge status-badge-green">수신 중</span>
          ) : (
            <span className="status-badge status-badge-gray">중지됨</span>
          )}
        </div>
        <div className="mgmt-panel-header-actions">
          <button
            type="button"
            className="button-primary"
            onClick={handleStart}
            disabled={active || pending}
          >
            단말 데이터 수신 시작
          </button>
          <button
            type="button"
            className="button-secondary"
            onClick={handleStop}
            disabled={!active || pending}
          >
            수신 중지
          </button>
        </div>
      </div>

      {actionError ? (
        <p role="alert" style={{ color: "red", marginBottom: 8 }}>
          {actionError}
        </p>
      ) : null}

      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        OTOPLUG NT observer(driving · drivingDetail) 등록/해제
      </p>
    </div>
  );
}
