"use client";

import React, { useRef, useState, useTransition } from "react";

import {
  previewDispatchAction,
  getActiveRoundAction,
  createRoundAction,
  startDeliveryAction,
  type DispatchPreviewRow
} from "@/app/dispatch/actions";
import type {
  DispatchBulkApplyRow,
  DispatchBulkSummary,
  ServiceOpsDispatchRound
} from "@/lib/services/service-ops-api";
import "./BulkPreviewModal.css";

/**
 * /management 유모차 라운드 섹션.
 *
 * 업로드 플로우는 DispatchPanel 과 동일하게 HYBRID 다:
 *   파일 선택 → `previewDispatchAction`(서버에서 파싱 + 지오코딩) → 미리보기
 *   모달 → 확인 시 NEW 행만 `createRoundAction(rows)` 로 라운드 생성.
 *
 * 라운드 상태에 따라 stage badge + 진행도를 표시하고,
 * 수거 완료 시 "배송 시작" 버튼을 통해 `startDeliveryAction` 을 호출한다.
 *
 * Props:
 *   initialRound — 서버 페이지에서 `getActiveRoundAction()` 결과를 넘겨받는다.
 *                  null 이면 진행 라운드 없음 상태로 시작.
 */

interface DispatchPreviewState {
  rows: DispatchPreviewRow[];
  summary: DispatchBulkSummary;
}

function roundStatusLabel(status: ServiceOpsDispatchRound["status"] | undefined): string {
  if (!status) return "진행 라운드 없음";
  switch (status) {
    case "COLLECTING":
      return "수거 중";
    case "DELIVERING":
      return "배송 중";
    case "DONE":
      return "완료됨";
    default:
      return "진행 라운드 없음";
  }
}

export function StrollerRoundPanel({
  initialRound
}: {
  initialRound: ServiceOpsDispatchRound | null;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [round, setRound] = useState<ServiceOpsDispatchRound | null>(initialRound);
  const [preview, setPreview] = useState<DispatchPreviewState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  /** 활성 라운드를 서버에서 다시 조회해 state 에 반영. */
  const reloadRound = async () => {
    const next = await getActiveRoundAction();
    setRound(next);
  };

  // 라운드가 활성 상태인 경우 업로드를 비활성화한다.
  const isRoundActive = round != null && round.status !== "DONE";

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const result = await previewDispatchAction(fd);
      if (result.ok) {
        setPreview({ rows: result.rows, summary: result.summary });
      } else {
        setError(result.error);
      }
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleConfirm = async () => {
    if (!preview) return;
    const applyRows: DispatchBulkApplyRow[] = preview.rows
      .filter(
        (r): r is DispatchPreviewRow & { bikeId: string; latitude: number; longitude: number } =>
          r.status === "NEW" &&
          r.bikeId != null &&
          r.latitude != null &&
          r.longitude != null
      )
      .map((r) => ({
        bikeId: r.bikeId,
        customerName: r.customerName,
        customerPhone: r.customerPhone,
        address: r.address,
        latitude: r.latitude,
        longitude: r.longitude
      }));

    setLoading(true);
    try {
      const result = await createRoundAction(applyRows);
      if (result.ok) {
        setPreview(null);
        setNotice("유모차 라운드가 생성되었습니다.");
        await reloadRound();
      } else {
        setError(result.error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setPreview(null);
    setError(null);
  };

  const handleStartDelivery = () => {
    if (!round) return;
    const batchId = round.batchId;
    startTransition(async () => {
      setError(null);
      const result = await startDeliveryAction(batchId);
      if (result.ok) {
        setNotice("배송이 시작되었습니다.");
        await reloadRound();
      } else {
        setError(result.error);
      }
    });
  };

  const applicableCount = preview
    ? preview.rows.filter((r) => r.status === "NEW").length
    : 0;

  const canStartDelivery =
    round?.status === "COLLECTING" &&
    round.pickupTotal > 0 &&
    round.pickupDone === round.pickupTotal;

  const statusLabel = round ? roundStatusLabel(round.status) : "진행 라운드 없음";
  const statusVariant =
    round?.status === "COLLECTING"
      ? "collecting"
      : round?.status === "DELIVERING"
        ? "delivering"
        : round?.status === "DONE"
          ? "done"
          : "none";

  return (
    <div className="management-panel">
      <div className="mgmt-panel-header">
        <div className="mgmt-panel-header-left">
          <span className="mgmt-panel-title">유모차 라운드</span>
          <span className={`stroller-round-status-badge stroller-round-status-badge--${statusVariant}`}>
            {statusLabel}
          </span>
        </div>
        <div className="mgmt-panel-header-actions">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
          <button
            type="button"
            className="button-primary"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || isRoundActive}
            title={isRoundActive ? "진행 중인 라운드가 있습니다. 완료 후 업로드하세요." : undefined}
          >
            {loading ? "처리 중..." : "업로드"}
          </button>
          <button
            type="button"
            className="button-primary"
            onClick={handleStartDelivery}
            disabled={!canStartDelivery || isPending}
            title={canStartDelivery ? "수거 완료 — 배송 시작" : "수거가 모두 완료돼야 배송을 시작할 수 있습니다."}
          >
            {isPending ? "처리 중..." : "배송 시작"}
          </button>
        </div>
      </div>

      {error ? (
        <p role="alert" style={{ color: "red", marginBottom: 8 }}>
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" style={{ color: "#166534", marginBottom: 8 }}>
          {notice}
        </p>
      ) : null}

      {round && round.status !== "DONE" ? (
        <div className="stroller-round-progress">
          <span className="stroller-round-progress-item">
            수거 {round.pickupDone}/{round.pickupTotal}
          </span>
          <span className="stroller-round-progress-sep" aria-hidden="true">·</span>
          <span className="stroller-round-progress-item">
            배송 {round.deliveryDone}/{round.deliveryTotal}
          </span>
        </div>
      ) : null}

      {preview ? (
        <div className="bulk-preview-overlay">
          <div className="bulk-preview-modal">
            <h2 className="bulk-preview-title">유모차 라운드 업로드 미리보기</h2>

            <div className="bulk-preview-summary">
              <span className="bulk-preview-summary-new">신규 {preview.summary.new}</span>
              <span className="bulk-preview-summary-error">오류 {preview.summary.error}</span>
              <span className="bulk-preview-summary-total">합계 {preview.summary.total}</span>
            </div>

            <div className="bulk-preview-table-wrapper">
              <table className="bulk-preview-table">
                <thead>
                  <tr>
                    <th>행</th>
                    <th>상태</th>
                    <th>차량번호</th>
                    <th>고객명</th>
                    <th>연락처</th>
                    <th>배송지주소</th>
                    <th>좌표</th>
                    <th>비고</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row) => (
                    <tr key={row.rowNumber} className={`bulk-preview-row-${row.status}`}>
                      <td>{row.rowNumber}</td>
                      <td>{row.status === "NEW" ? "신규" : "오류"}</td>
                      <td>{row.plateNumber}</td>
                      <td>{row.customerName}</td>
                      <td>{row.customerPhone}</td>
                      <td>{row.address}</td>
                      <td>
                        {row.latitude != null && row.longitude != null
                          ? `${row.latitude.toFixed(5)}, ${row.longitude.toFixed(5)}`
                          : ""}
                      </td>
                      <td>{row.message ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bulk-preview-actions">
              <button onClick={handleCancel} disabled={loading} className="button-neutral">
                취소
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading || applicableCount === 0}
                className="button-primary"
              >
                {loading ? "저장 중..." : `${applicableCount}건 라운드 생성`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
