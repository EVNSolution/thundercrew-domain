"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { ExcelImportButton } from "./ExcelImportButton";
import {
  bulkPreviewMatchingAction,
  bulkApplyMatchingAction,
  listMatchingAction,
  terminateMatchingAction
} from "@/app/management/matching/actions";
import type {
  ServiceOpsRiderBikeContract,
  ServiceOpsBikeServiceType,
  ServiceOpsContractCategory,
  ServiceOpsContractReturnType,
} from "@/lib/services/service-ops-api";

function ContractStatusBadge({ contract }: { contract: ServiceOpsRiderBikeContract }) {
  if (contract.terminatedAt) {
    return <span className="status-badge status-badge-gray">종료</span>;
  }
  return <span className="status-badge status-badge-green">진행 중</span>;
}

function categoryLabel(category?: ServiceOpsContractCategory | null): React.ReactNode {
  if (category === "SUBSCRIPTION") return "구독";
  if (category === "RENTAL") return "렌탈";
  if (category === "CUSTOM") return "기타";
  return <span className="muted">—</span>;
}

function returnTypeLabel(returnType?: ServiceOpsContractReturnType | null): React.ReactNode {
  if (returnType === "TAKEOVER") return "인수형";
  if (returnType === "RETURN") return "반납형";
  return <span className="muted">—</span>;
}

function serviceTypeLabel(serviceType?: ServiceOpsBikeServiceType | null): React.ReactNode {
  if (serviceType === "CALL") return "콜 배차";
  if (serviceType === "SINGLE") return "단일 배차";
  if (serviceType === "SEQUENTIAL") return "순차 배차";
  if (serviceType === "ROUND") return "왕복 배차";
  if (serviceType === "OTHER") return "기타";
  return <span className="muted">—</span>;
}

export function MatchingManagementPanel({ exportUrl }: { exportUrl: string }) {
  const router = useRouter();
  const [contracts, setContracts] = useState<ServiceOpsRiderBikeContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    listMatchingAction()
      .then(items => { if (active) { setContracts(items); setError(null); setLoading(false); } })
      .catch(err => { if (active) { setError(err instanceof Error ? err.message : "계약 목록 조회 실패"); setLoading(false); } });
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
          <span className="mgmt-panel-title">매칭</span>
          <span className="mgmt-panel-count">{loading ? "…" : contracts.length}</span>
        </div>
        <div className="mgmt-panel-header-actions">
          <a href={exportUrl} target="_blank" rel="noreferrer">
            <button type="button" className="button-secondary">내려받기</button>
          </a>
          <ExcelImportButton
            onPreview={bulkPreviewMatchingAction}
            onApply={bulkApplyMatchingAction}
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
              <th>서비스 유형</th>
              <th>라이더 이름</th>
              <th>연락처</th>
              <th>계약형태</th>
              <th>인수방식</th>
              <th>시작일</th>
              <th>종료일</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} className="table-empty-cell">불러오는 중…</td>
              </tr>
            ) : contracts.length === 0 ? (
              <tr>
                <td colSpan={10} className="table-empty-cell">계약 없음</td>
              </tr>
            ) : (
              contracts.map((c) => (
                <tr key={c.id}>
                  <td>
                    {!c.terminatedAt ? (
                      <button
                        type="button"
                        className="button-neutral"
                        disabled={isPending}
                        onClick={() => {
                          if (!window.confirm("계약을 종료하시겠습니까?")) return;
                          setActionError(null);
                          startTransition(async () => {
                            const res = await terminateMatchingAction(c.id);
                            if (res.ok) {
                              router.refresh();
                              setLoading(true);
                              setRefreshKey(k => k + 1);
                            } else {
                              setActionError(res.message ?? "종료 실패");
                            }
                          });
                        }}
                      >
                        종료
                      </button>
                    ) : null}
                  </td>
                  <td>{c.plateNumber ?? <span className="muted">—</span>}</td>
                  <td>{serviceTypeLabel(c.serviceType)}</td>
                  <td>{c.riderName ?? <span className="muted">—</span>}</td>
                  <td>{c.riderPhoneNumber ?? <span className="muted">—</span>}</td>
                  <td>{categoryLabel(c.category)}</td>
                  <td>{returnTypeLabel(c.returnType)}</td>
                  <td>{c.startAt.slice(0, 10)}</td>
                  <td>{c.endAt ? c.endAt.slice(0, 10) : <span className="muted">—</span>}</td>
                  <td><ContractStatusBadge contract={c} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
