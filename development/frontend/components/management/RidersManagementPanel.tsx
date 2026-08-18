"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { ExcelImportButton } from "./ExcelImportButton";
import { RiderCreateDialog } from "./ResourceCreateDialogs";
import { RiderDetailDialog } from "./RiderDetailDialog";
import {
  bulkPreviewRidersAction,
  bulkApplyRidersAction,
  deleteRiderAction
} from "@/app/management/riders/actions";
import type { FrontendRider, ServiceOpsRiderTrainingStatus } from "@/lib/services/service-ops-api";

function TrainingStatusBadge({ status }: { status?: ServiceOpsRiderTrainingStatus | null }) {
  if (!status) return <span className="muted">—</span>;
  if (status === "ONLINE") return <span className="status-badge status-badge-green">온라인</span>;
  if (status === "OFFLINE") return <span className="status-badge status-badge-gray">오프라인</span>;
  return <span className="status-badge status-badge-orange">미완료</span>;
}

/** 직무. 차량의 용도와 짝을 이루는 축이다 (backend V54). */
function RoleBadge({ value }: { value?: string | null }) {
  if (!value) return <span className="muted">—</span>;
  if (value === "RIDER") return <span>라이더</span>;
  if (value === "CLEANER") return <span>클리너</span>;
  return <span className="muted">{value}</span>;
}

/** 등급. 초보/고수 2단계 (V58) — 빈 값은 아직 판정하지 않은 상태. */
function SkillBadge({ value }: { value?: FrontendRider["skillLevel"] }) {
  if (value === "BEGINNER") return <span className="status-badge status-badge-orange">초보</span>;
  if (value === "EXPERT") return <span className="status-badge status-badge-green">고수</span>;
  return <span className="muted">미판정</span>;
}

/**
 * 자원 관리의 이용자(라이더/클리너) 표. 목록은 page 가 내려준 props 가 단일
 * 소스 — 변경 후엔 `router.refresh()`.
 *
 * 행 클릭 → 이용자 상세 (기본 정보/등급/보험 수정 + 교육 기록 관리).
 */
export function RidersManagementPanel({
  riders,
  exportUrl
}: {
  riders: ReadonlyArray<FrontendRider>;
  exportUrl: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return riders;
    return riders.filter((r) =>
      [r.name, r.phone, r.team]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q))
    );
  }, [riders, search]);

  const selectedRider = useMemo(
    () => (selectedId ? riders.find((r) => (r.id ?? r.slug) === selectedId) ?? null : null),
    [selectedId, riders]
  );

  const handleRefresh = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <div className="management-panel">
      <div className="mgmt-panel-header">
        <div className="mgmt-panel-header-left">
          <span className="mgmt-panel-title">이용자</span>
          <span className="mgmt-panel-count">{riders.length}</span>
        </div>
        <div className="mgmt-panel-header-actions">
          <input
            type="search"
            className="mgmt-panel-search"
            placeholder="이름 · 연락처 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="이용자 검색"
          />
          <button type="button" className="button-secondary" onClick={() => setCreateOpen(true)}>
            등록
          </button>
          <a href={exportUrl} target="_blank" rel="noreferrer">
            <button type="button" className="button-secondary">내려받기</button>
          </a>
          <ExcelImportButton
            onPreview={bulkPreviewRidersAction}
            onApply={bulkApplyRidersAction}
            onSuccess={handleRefresh}
            label="업로드"
            className="button-primary"
          />
        </div>
      </div>

      {notice ? (
        <p role="status" style={{ marginBottom: 8 }}>{notice}</p>
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
              <th aria-label="관리" style={{ width: 44 }} />
              <th>이름</th>
              <th>직무</th>
              <th>등급</th>
              <th>연락처</th>
              <th>교육이수</th>
              <th>팀</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="table-empty-cell">
                  {riders.length === 0 ? "이용자 없음" : "검색 결과 없음"}
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr
                  key={r.slug}
                  className="table-row-clickable"
                  onClick={() => setSelectedId(r.id ?? r.slug)}
                >
                  <td onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="delete-icon-button"
                      disabled={isPending || !r.id}
                      title={`이용자 "${r.name}" 삭제`}
                      aria-label={`이용자 "${r.name}" 삭제`}
                      onClick={() => {
                        if (!r.id) return;
                        if (!window.confirm(`이용자 "${r.name}"을(를) 삭제하시겠습니까?`)) return;
                        setActionError(null);
                        startTransition(async () => {
                          const res = await deleteRiderAction(r.id!);
                          if (res.ok) {
                            router.refresh();
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
                  <td><RoleBadge value={r.role} /></td>
                  <td><SkillBadge value={r.skillLevel} /></td>
                  <td>{r.phone}</td>
                  <td><TrainingStatusBadge status={r.trainingStatus} /></td>
                  <td>{r.team}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <RiderCreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(partialNotice) => {
          setNotice(partialNotice ?? null);
          handleRefresh();
        }}
      />
      <RiderDetailDialog
        key={selectedId ?? "none"}
        rider={selectedRider}
        onClose={() => setSelectedId(null)}
        returnTo="/management/resources"
      />
    </div>
  );
}
