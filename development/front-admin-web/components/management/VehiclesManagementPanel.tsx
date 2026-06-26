"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { ExcelImportButton } from "./ExcelImportButton";
import {
  bulkPreviewVehiclesAction,
  bulkApplyVehiclesAction,
  listVehiclesAction,
  deleteVehicleAction
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
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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

      {actionError ? (
        <p role="alert" style={{ color: "red", marginBottom: 8 }}>
          {actionError}
        </p>
      ) : null}

      <div className="table-card">
        <table className="table" style={{ tableLayout: "fixed" }}>
          <thead>
            <tr>
              <th aria-label="관리" />
              <th>차량번호</th>
              <th>구분</th>
              <th>엔진</th>
              <th>IMEI</th>
              <th>단말기 ID</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="table-empty-cell">불러오는 중…</td>
              </tr>
            ) : vehicles.length === 0 ? (
              <tr>
                <td colSpan={6} className="table-empty-cell">차량 없음</td>
              </tr>
            ) : (
              vehicles.map((v) => (
                <tr key={v.slug}>
                  <td>
                    <button
                      type="button"
                      className="delete-icon-button"
                      disabled={isPending || !v.id}
                      title={`차량 "${v.plateNumber}" 삭제`}
                      aria-label={`차량 "${v.plateNumber}" 삭제`}
                      onClick={() => {
                        if (!v.id) return;
                        if (!window.confirm(`차량 "${v.plateNumber}"을(를) 삭제하시겠습니까?`)) return;
                        setActionError(null);
                        startTransition(async () => {
                          const res = await deleteVehicleAction(v.id!);
                          if (res.ok) {
                            router.refresh();
                            setLoading(true);
                            setRefreshKey(k => k + 1);
                          } else {
                            setActionError(res.message ?? "삭제 실패");
                          }
                        });
                      }}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M3 6h18" />
                        <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
                        <path d="M5 6l1 14a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-14" />
                        <path d="M10 11v6" />
                        <path d="M14 11v6" />
                      </svg>
                    </button>
                  </td>
                  <td>{v.plateNumber}</td>
                  <td><WheelTypeBadge value={v.wheelType} /></td>
                  <td><EngineTypeBadge value={v.engineType} /></td>
                  <td>{v.imei ?? <span className="muted">—</span>}</td>
                  <td>{v.terminalId ?? <span className="muted">—</span>}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
