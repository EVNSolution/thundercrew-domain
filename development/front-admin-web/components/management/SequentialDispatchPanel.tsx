"use client";

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  previewSequentialDispatchAction,
  applySequentialDispatchAction,
  type DispatchPreviewRow
} from "@/app/dispatch/actions";
import type { DispatchBulkApplyRow, DispatchBulkSummary } from "@/lib/services/service-ops-api";
import "./BulkPreviewModal.css";

/**
 * /management 순차 배차 섹션. 업로드 플로우는 HYBRID 다:
 *   파일 선택 → `previewSequentialDispatchAction`(서버에서 파싱 + 지오코딩) → 미리보기
 *   모달 → 확인 시 NEW 행만 `applySequentialDispatchAction(rows)`(JSON).
 *
 * 단일 배차(DispatchPanel)와 동일한 플로우지만 엑셀에 순번(sequence) 컬럼이
 * 포함되어 있으며, apply 시 sequence 를 함께 전달한다.
 *
 * 지오코딩이 server action 안에서 끝나므로 이 client component 는 좌표를 만지지
 * 않고 받은 행을 그대로 표시/전달만 한다. apply 는 excel 재업로드가 아니라 좌표
 * 포함 JSON 이라 공용 `ExcelImportButton`/`BulkPreviewModal` 대신 전용 모달을 쓴다.
 */

interface DispatchPreviewState {
  rows: DispatchPreviewRow[];
  summary: DispatchBulkSummary;
}

export function SequentialDispatchPanel({ exportUrl }: { exportUrl: string }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<DispatchPreviewState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const result = await previewSequentialDispatchAction(fd);
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
    // NEW 행만 — 좌표가 붙어있는 행만 apply 로 전달. ERROR 행은 제외.
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
        longitude: r.longitude,
        sequence: r.sequence ?? undefined,
        originAddress: r.originAddress ?? null,
        originLatitude: r.originLatitude ?? null,
        originLongitude: r.originLongitude ?? null
      }));

    setLoading(true);
    try {
      const result = await applySequentialDispatchAction(applyRows);
      if (result.ok) {
        setPreview(null);
        setNotice(`배차 ${result.applied}건 적용 완료`);
        router.refresh();
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

  const applicableCount = preview
    ? preview.rows.filter((r) => r.status === "NEW").length
    : 0;

  return (
    <div className="management-panel">
      <div className="mgmt-panel-header">
        <div className="mgmt-panel-header-left">
          <span className="mgmt-panel-title">순차 배차</span>
        </div>
        <div className="mgmt-panel-header-actions">
          <a href={exportUrl} target="_blank" rel="noreferrer">
            <button type="button" className="button-secondary">내려받기</button>
          </a>
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
            disabled={loading}
          >
            {loading ? "처리 중..." : "업로드"}
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

      <div className="table-card">
        <table className="table" style={{ tableLayout: "fixed" }}>
          <thead>
            <tr>
              <th>차량</th>
              <th>고객명</th>
              <th>연락처</th>
              <th>배송지주소</th>
              <th>순번</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={5} className="table-empty-cell">
                업로드한 배차는 라이더 앱 / 대시보드에서 확인하세요. (엑셀에 순번 컬럼 포함 — 차량별 방문 순서)
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {preview ? (
        <div className="bulk-preview-overlay">
          <div className="bulk-preview-modal">
            <h2 className="bulk-preview-title">순차 배차 업로드 미리보기</h2>

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
                    <th>순번</th>
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
                      <td>{row.sequence ?? "—"}</td>
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
                {loading ? "저장 중..." : `${applicableCount}건 적용`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
