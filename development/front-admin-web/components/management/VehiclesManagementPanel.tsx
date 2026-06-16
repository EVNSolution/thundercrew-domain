"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ExcelImportButton } from "./ExcelImportButton";
import {
  bulkPreviewVehiclesAction,
  bulkApplyVehiclesAction,
  listVehiclesAction
} from "@/app/management/vehicles/actions";
import type { FrontendVehicle } from "@/lib/services/service-ops-api";

function WheelTypeBadge({ value }: { value?: string | null }) {
  if (!value) return <span className="muted">—</span>;
  return <span>{value === "TWO_WHEEL" ? "2륜" : "4륜"}</span>;
}

function EngineTypeBadge({ value }: { value?: string | null }) {
  if (!value) return <span className="muted">—</span>;
  return <span>{value === "ELECTRIC" ? "전기" : "내연"}</span>;
}

export function VehiclesManagementPanel({ exportUrl }: { exportUrl: string }) {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<FrontendVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    listVehiclesAction()
      .then(items => { if (active) { setVehicles(items); setError(null); setLoading(false); } })
      .catch(err => { if (active) { setError(err instanceof Error ? err.message : "차량 목록 조회 실패"); setLoading(false); } });
    return () => { active = false; };
  }, [refreshKey]);

  const handleSuccess = () => {
    router.refresh();
    setLoading(true);
    setRefreshKey(k => k + 1);
  };

  return (
    <div className="management-panel">
      <div className="mgmt-panel-header">
        <div className="mgmt-panel-header-left">
          <span className="mgmt-panel-title">차량</span>
          <span className="mgmt-panel-count">{loading ? "…" : vehicles.length}</span>
        </div>
        <div className="mgmt-panel-header-actions">
          <a href={exportUrl} target="_blank" rel="noreferrer">
            <button type="button" className="button-secondary">내려받기</button>
          </a>
          <ExcelImportButton
            onPreview={bulkPreviewVehiclesAction}
            onApply={bulkApplyVehiclesAction}
            onSuccess={handleSuccess}
            label="업로드"
            className="button-primary"
          />
        </div>
      </div>

      {error ? (
        <p role="alert" style={{ color: "red", marginBottom: 8 }}>
          {error}
        </p>
      ) : null}

      <div className="table-card">
        <table className="table" style={{ tableLayout: "fixed" }}>
          <thead>
            <tr>
              <th>차량번호</th>
              <th>구분</th>
              <th>엔진</th>
              <th>IMEI</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="table-empty-cell">불러오는 중…</td>
              </tr>
            ) : vehicles.length === 0 ? (
              <tr>
                <td colSpan={4} className="table-empty-cell">차량 없음</td>
              </tr>
            ) : (
              vehicles.map((v) => (
                <tr key={v.slug}>
                  <td>{v.plateNumber}</td>
                  <td><WheelTypeBadge value={v.wheelType} /></td>
                  <td><EngineTypeBadge value={v.engineType} /></td>
                  <td>{v.imei ?? <span className="muted">—</span>}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
