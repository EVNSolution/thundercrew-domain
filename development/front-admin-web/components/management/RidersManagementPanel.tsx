"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

import { ExcelImportButton } from "./ExcelImportButton";
import {
  bulkPreviewRidersAction,
  bulkApplyRidersAction,
  getRidersExportUrl,
  listRidersAction
} from "@/app/management/riders/actions";
import type { FrontendRider } from "@/lib/services/service-ops-api";

/**
 * 라이더 관리 페이지 패널.
 * DB 라이더 목록 테이블 + Excel 내려받기 / 업로드 버튼을 제공한다.
 */
export function RidersManagementPanel() {
  const router = useRouter();
  const [riders, setRiders] = useState<FrontendRider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await listRidersAction();
      setRiders(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "라이더 목록 조회 실패");
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

  const exportUrl = getRidersExportUrl();

  return (
    <div className="management-panel">
      <div style={{ display: "flex", gap: "8px", marginBottom: "12px", alignItems: "center" }}>
        <a href={exportUrl} target="_blank" rel="noreferrer">
          <button type="button">Excel 내려받기</button>
        </a>
        <ExcelImportButton
          onPreview={bulkPreviewRidersAction}
          onApply={bulkApplyRidersAction}
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
              <th>이름</th>
              <th>연락처</th>
              <th>팀</th>
              <th>지역</th>
              <th>상태</th>
              <th>가입일</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="table-empty-cell">
                  불러오는 중…
                </td>
              </tr>
            ) : riders.length === 0 ? (
              <tr>
                <td colSpan={6} className="table-empty-cell">
                  라이더 없음
                </td>
              </tr>
            ) : (
              riders.map((r) => (
                <tr key={r.slug}>
                  <td>{r.name}</td>
                  <td>{r.phone}</td>
                  <td>{r.team}</td>
                  <td>{r.area}</td>
                  <td>{r.status}</td>
                  <td>{r.joinedAt}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
