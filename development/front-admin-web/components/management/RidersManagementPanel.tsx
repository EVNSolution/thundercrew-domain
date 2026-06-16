"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ExcelImportButton } from "./ExcelImportButton";
import {
  bulkPreviewRidersAction,
  bulkApplyRidersAction,
  listRidersAction
} from "@/app/management/riders/actions";
import type { FrontendRider, ServiceOpsRiderTrainingStatus } from "@/lib/services/service-ops-api";

function TrainingStatusBadge({ status }: { status?: ServiceOpsRiderTrainingStatus | null }) {
  if (!status) return <span className="muted">—</span>;
  if (status === "ONLINE") return <span className="status-badge status-badge-green">온라인</span>;
  if (status === "OFFLINE") return <span className="status-badge status-badge-gray">오프라인</span>;
  return <span className="status-badge status-badge-orange">미완료</span>;
}

export function RidersManagementPanel({ exportUrl }: { exportUrl: string }) {
  const router = useRouter();
  const [riders, setRiders] = useState<FrontendRider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    listRidersAction()
      .then(items => { if (active) { setRiders(items); setError(null); setLoading(false); } })
      .catch(err => { if (active) { setError(err instanceof Error ? err.message : "라이더 목록 조회 실패"); setLoading(false); } });
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
          <span className="mgmt-panel-title">라이더</span>
          <span className="mgmt-panel-count">{loading ? "…" : riders.length}</span>
        </div>
        <div className="mgmt-panel-header-actions">
          <a href={exportUrl} target="_blank" rel="noreferrer">
            <button type="button" className="button-secondary">내려받기</button>
          </a>
          <ExcelImportButton
            onPreview={bulkPreviewRidersAction}
            onApply={bulkApplyRidersAction}
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
              <th>이름</th>
              <th>연락처</th>
              <th>교육이수</th>
              <th>팀</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="table-empty-cell">불러오는 중…</td>
              </tr>
            ) : riders.length === 0 ? (
              <tr>
                <td colSpan={4} className="table-empty-cell">라이더 없음</td>
              </tr>
            ) : (
              riders.map((r) => (
                <tr key={r.slug}>
                  <td>{r.name}</td>
                  <td>{r.phone}</td>
                  <td><TrainingStatusBadge status={r.trainingStatus} /></td>
                  <td>{r.team}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
