"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

import { ExcelImportButton } from "./ExcelImportButton";
import {
  bulkPreviewMatchingAction,
  bulkApplyMatchingAction,
  getMatchingExportUrl,
  listMatchingAction
} from "@/app/management/matching/actions";
import type { ServiceOpsRiderBikeContract } from "@/lib/services/service-ops-api";

/**
 * 매칭(계약) 관리 페이지 패널.
 * DB 라이더-차량 계약 목록 테이블 + Excel 내려받기 / 업로드 버튼을 제공한다.
 */
export function MatchingManagementPanel() {
  const router = useRouter();
  const [contracts, setContracts] = useState<ServiceOpsRiderBikeContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await listMatchingAction();
      setContracts(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "계약 목록 조회 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSuccess = () => {
    router.refresh();
    void load();
  };

  const exportUrl = getMatchingExportUrl();

  return (
    <div className="vehicles-panel">
      <div style={{ display: "flex", gap: "8px", marginBottom: "12px", alignItems: "center" }}>
        <a href={exportUrl} target="_blank" rel="noreferrer">
          <button type="button">Excel 내려받기</button>
        </a>
        <ExcelImportButton
          onPreview={bulkPreviewMatchingAction}
          onApply={bulkApplyMatchingAction}
          onSuccess={handleSuccess}
          label="Excel 업로드"
        />
      </div>

      {error ? (
        <p role="alert" style={{ color: "red" }}>
          {error}
        </p>
      ) : null}

      <div className="table-card">
        <table className="table" style={{ tableLayout: "fixed" }}>
          <thead>
            <tr>
              <th>라이더 ID</th>
              <th>차량 ID</th>
              <th>템플릿 ID</th>
              <th>시작일</th>
              <th>종료일</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="table-empty-cell">
                  불러오는 중…
                </td>
              </tr>
            ) : contracts.length === 0 ? (
              <tr>
                <td colSpan={6} className="table-empty-cell">
                  계약 없음
                </td>
              </tr>
            ) : (
              contracts.map((c) => (
                <tr key={c.id}>
                  <td>{c.riderId}</td>
                  <td>{c.bikeId}</td>
                  <td>{c.contractTemplateId}</td>
                  <td>{c.startAt.slice(0, 10)}</td>
                  <td>{c.endAt ? c.endAt.slice(0, 10) : <span className="muted">—</span>}</td>
                  <td>
                    {c.terminatedAt ? (
                      <span className="muted">종료</span>
                    ) : (
                      <span>진행 중</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
