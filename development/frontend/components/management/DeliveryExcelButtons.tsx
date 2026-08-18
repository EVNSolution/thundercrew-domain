"use client";

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  applyDispatchAction,
  previewDispatchAction,
  type DispatchPreviewRow
} from "@/app/dispatch/actions";
import type { DispatchBulkApplyRow, DispatchBulkSummary } from "@/lib/services/service-ops-api";
import "./BulkPreviewModal.css";

/**
 * 배송 배차 엑셀 내려받기/업로드 — 구 "단일 배차" 패널에서 이식.
 * 플로우는 HYBRID: 파일 → 서버 파싱+지오코딩 미리보기 → NEW 행만 JSON apply.
 * 배송 배차 섹션 헤더에 끼워 넣는 버튼 묶음이라 표는 없다 — 업로드 결과는
 * 사이드 배차 이력 리스트에서 확인한다.
 */
export function DeliveryExcelButtons({
  exportUrl,
  onApplied
}: {
  exportUrl: string;
  /** 적용 완료 후 목록 갱신 트리거 (사이드 이력 재조회). */
  onApplied?: () => void;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ rows: DispatchPreviewRow[]; summary: DispatchBulkSummary } | null>(null);
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
          r.status === "NEW" && r.bikeId != null && r.latitude != null && r.longitude != null
      )
      .map((r) => ({
        bikeId: r.bikeId,
        customerName: r.customerName,
        customerPhone: r.customerPhone,
        address: r.address,
        latitude: r.latitude,
        longitude: r.longitude,
        originAddress: r.originAddress ?? null,
        originLatitude: r.originLatitude ?? null,
        originLongitude: r.originLongitude ?? null
      }));

    setLoading(true);
    try {
      const result = await applyDispatchAction(applyRows);
      if (result.ok) {
        setPreview(null);
        setNotice(`배차 ${result.applied}건 적용 완료`);
        router.refresh();
        onApplied?.();
      } else {
        setError(result.error);
      }
    } finally {
      setLoading(false);
    }
  };

  const applicableCount = preview ? preview.rows.filter((r) => r.status === "NEW").length : 0;

  return (
    <>
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
        className="button-secondary"
        onClick={() => fileInputRef.current?.click()}
        disabled={loading}
      >
        {loading ? "처리 중..." : "업로드"}
      </button>
      {error ? <p role="alert" className="baemin-call-error">{error}</p> : null}
      {notice ? <p role="status" className="baemin-call-notice">{notice}</p> : null}

      {preview ? (
        <div className="bulk-preview-overlay">
          <div className="bulk-preview-modal">
            <h2 className="bulk-preview-title">배송 배차 업로드 미리보기</h2>
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
              <button onClick={() => { setPreview(null); setError(null); }} disabled={loading} className="button-neutral">
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
    </>
  );
}
