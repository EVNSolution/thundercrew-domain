"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

import { ExcelImportButton } from "./ExcelImportButton";
import {
  bulkPreviewVehiclesAction,
  bulkApplyVehiclesAction,
  getVehiclesExportUrl,
  listVehiclesAction
} from "@/app/management/vehicles/actions";
import type { FrontendVehicle } from "@/lib/services/service-ops-api";

/**
 * 차량 관리 페이지 패널.
 * DB 차량 목록 테이블 + Excel 내려받기 / 업로드 버튼을 제공한다.
 */
export function VehiclesManagementPanel() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<FrontendVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await listVehiclesAction();
      setVehicles(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "차량 목록 조회 실패");
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

  const exportUrl = getVehiclesExportUrl();

  return (
    <div className="vehicles-panel">
      <div style={{ display: "flex", gap: "8px", marginBottom: "12px", alignItems: "center" }}>
        <a href={exportUrl} target="_blank" rel="noreferrer">
          <button type="button">Excel 내려받기</button>
        </a>
        <ExcelImportButton
          onPreview={bulkPreviewVehiclesAction}
          onApply={bulkApplyVehiclesAction}
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
              <th>차량번호</th>
              <th>모델</th>
              <th>구분</th>
              <th>운영 상태</th>
              <th>메모</th>
              <th>생성일</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="table-empty-cell">
                  불러오는 중…
                </td>
              </tr>
            ) : vehicles.length === 0 ? (
              <tr>
                <td colSpan={6} className="table-empty-cell">
                  차량 없음
                </td>
              </tr>
            ) : (
              vehicles.map((v) => (
                <tr key={v.slug}>
                  <td>{v.plateNumber}</td>
                  <td>{v.model}</td>
                  <td>{v.engineType ?? "—"}</td>
                  <td>{v.status}</td>
                  <td>{v.memo ?? <span className="muted">—</span>}</td>
                  <td>{v.createdAt ? v.createdAt.slice(0, 10) : <span className="muted">—</span>}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
