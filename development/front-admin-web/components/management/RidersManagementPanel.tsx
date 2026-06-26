"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { ExcelImportButton } from "./ExcelImportButton";
import {
  bulkPreviewRidersAction,
  bulkApplyRidersAction,
  listRidersAction,
  deleteRiderAction
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
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
              <th>이름</th>
              <th>연락처</th>
              <th>교육이수</th>
              <th>팀</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="table-empty-cell">불러오는 중…</td>
              </tr>
            ) : riders.length === 0 ? (
              <tr>
                <td colSpan={5} className="table-empty-cell">라이더 없음</td>
              </tr>
            ) : (
              riders.map((r) => (
                <tr key={r.slug}>
                  <td>
                    <button
                      type="button"
                      className="delete-icon-button"
                      disabled={isPending || !r.id}
                      title={`라이더 "${r.name}" 삭제`}
                      aria-label={`라이더 "${r.name}" 삭제`}
                      onClick={() => {
                        if (!r.id) return;
                        if (!window.confirm(`라이더 "${r.name}"을(를) 삭제하시겠습니까?`)) return;
                        setActionError(null);
                        startTransition(async () => {
                          const res = await deleteRiderAction(r.id!);
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
