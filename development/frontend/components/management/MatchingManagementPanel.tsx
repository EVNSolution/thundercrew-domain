"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { ExcelImportButton } from "./ExcelImportButton";
import { MatchingCreateDialog } from "./ResourceCreateDialogs";
import {
  bulkPreviewMatchingAction,
  bulkApplyMatchingAction,
  terminateMatchingAction
} from "@/app/management/matching/actions";
import type {
  FrontendRider,
  FrontendVehicle,
  ServiceOpsRiderBikeContract,
  ServiceOpsContractCategory,
  ServiceOpsContractReturnType,
} from "@/lib/services/service-ops-api";

function purposeLabel(purpose?: FrontendVehicle["purpose"]): React.ReactNode {
  if (purpose === "DELIVERY") return "배송용";
  if (purpose === "CLEANING") return "클린차량";
  return <span className="muted">—</span>;
}

function roleLabel(role?: FrontendRider["role"]): React.ReactNode {
  if (role === "RIDER") return "라이더";
  if (role === "CLEANER") return "클리너";
  return <span className="muted">—</span>;
}

function skillLabel(skill?: FrontendRider["skillLevel"]): React.ReactNode {
  if (skill === "BEGINNER") return "초보";
  if (skill === "EXPERT") return "고수";
  return <span className="muted">미판정</span>;
}

function trainingLabel(status?: FrontendRider["trainingStatus"]): React.ReactNode {
  if (status === "ONLINE") return "온라인";
  if (status === "OFFLINE") return "오프라인";
  if (status === "INCOMPLETE") return "미완료";
  return <span className="muted">—</span>;
}

function ContractStatusBadge({ contract }: { contract: ServiceOpsRiderBikeContract }) {
  if (contract.terminatedAt) {
    return <span className="status-badge status-badge-gray">종료</span>;
  }
  return <span className="status-badge status-badge-green">진행 중</span>;
}

/**
 * 계약형태 컬럼 — 용도가 축을 가른다. 클리닝 계약(engagement 보유)은
 * "클리닝", 배송 계약은 구독/렌탈.
 */
function categoryLabel(contract: ServiceOpsRiderBikeContract): React.ReactNode {
  if (contract.engagementType) return "클리닝";
  const category: ServiceOpsContractCategory | null | undefined = contract.category;
  if (category === "SUBSCRIPTION") return "구독";
  if (category === "RENTAL") return "렌탈";
  if (category === "CUSTOM") return "기타";
  return <span className="muted">—</span>;
}

/** 형태 컬럼 — 배송: 인수형/반납형, 클리닝: 직영/협력 (V57). */
function shapeLabel(contract: ServiceOpsRiderBikeContract): React.ReactNode {
  if (contract.engagementType === "DIRECT") return "직영";
  if (contract.engagementType === "PARTNER") return "협력";
  const returnType: ServiceOpsContractReturnType | null | undefined = contract.returnType;
  if (returnType === "TAKEOVER") return "인수형";
  if (returnType === "RETURN") return "반납형";
  return <span className="muted">—</span>;
}

/**
 * 자원 관리의 매칭(계약) 표. 목록은 page 가 내려준 props 가 단일 소스 —
 * 생성/종료 후엔 `router.refresh()`.
 *
 * 단건 생성은 MatchingCreateDialog — 차량 용도에 따라 폼이 갈린다
 * (배송: 구독/렌탈+인수/반납, 클리닝: 직영/협력).
 */
export function MatchingManagementPanel({
  contracts,
  vehicles,
  riders,
  exportUrl,
  logExportUrl
}: {
  contracts: ReadonlyArray<ServiceOpsRiderBikeContract>;
  vehicles: ReadonlyArray<FrontendVehicle>;
  riders: ReadonlyArray<FrontendRider>;
  exportUrl: string;
  logExportUrl: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // 종료된 계약은 테이블에서 숨긴다 — 활성 매칭만 표시. 종료 포함 전체 이력은
  // "매칭로그" 다운로드로 받는다.
  const activeContracts = useMemo(() => contracts.filter((c) => !c.terminatedAt), [contracts]);

  // 차량·라이더/클리너 상세 컬럼(용도/직무/등급/교육/팀) 역참조용.
  const vehicleById = useMemo(() => {
    const map = new Map<string, FrontendVehicle>();
    for (const v of vehicles) map.set(v.id ?? v.slug, v);
    return map;
  }, [vehicles]);
  const riderById = useMemo(() => {
    const map = new Map<string, FrontendRider>();
    for (const r of riders) map.set(r.id ?? r.slug, r);
    return map;
  }, [riders]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return activeContracts;
    return activeContracts.filter((c) =>
      [c.plateNumber, c.riderName, c.riderPhoneNumber]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q))
    );
  }, [activeContracts, search]);

  const handleRefresh = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <div className="management-panel">
      <div className="mgmt-panel-header">
        <div className="mgmt-panel-header-left">
          <span className="mgmt-panel-title">매칭</span>
          <span className="mgmt-panel-count">{activeContracts.length}</span>
        </div>
        <div className="mgmt-panel-header-actions">
          <input
            type="search"
            className="mgmt-panel-search"
            placeholder="차량번호 · 이름 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="매칭 검색"
          />
          <button type="button" className="button-secondary" onClick={() => setCreateOpen(true)}>
            등록
          </button>
          <a href={exportUrl} target="_blank" rel="noreferrer">
            <button type="button" className="button-secondary">내려받기</button>
          </a>
          <a href={logExportUrl} target="_blank" rel="noreferrer">
            <button type="button" className="button-secondary">매칭로그</button>
          </a>
          <ExcelImportButton
            onPreview={bulkPreviewMatchingAction}
            onApply={bulkApplyMatchingAction}
            onSuccess={handleRefresh}
            label="업로드"
            className="button-primary"
          />
        </div>
      </div>

      {actionError ? (
        <p role="alert" style={{ color: "red", marginBottom: 8 }}>
          {actionError}
        </p>
      ) : null}

      <div className="table-card">
        <table className="table" style={{ tableLayout: "fixed" }}>
          <thead>
            <tr>
              <th aria-label="관리" style={{ width: 64 }} />
              <th>차량번호</th>
              <th>용도</th>
              <th>라이더/클리너</th>
              <th>직무</th>
              <th>등급</th>
              <th>연락처</th>
              <th>교육</th>
              <th>팀</th>
              <th>계약형태</th>
              <th>형태</th>
              <th>시작일</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={13} className="table-empty-cell">
                  {activeContracts.length === 0 ? "계약 없음" : "검색 결과 없음"}
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
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
                  <td>{purposeLabel(vehicleById.get(c.bikeId)?.purpose)}</td>
                  <td>{c.riderName ?? <span className="muted">—</span>}</td>
                  <td>{roleLabel(riderById.get(c.riderId)?.role)}</td>
                  <td>{skillLabel(riderById.get(c.riderId)?.skillLevel)}</td>
                  <td>{c.riderPhoneNumber ?? <span className="muted">—</span>}</td>
                  <td>{trainingLabel(riderById.get(c.riderId)?.trainingStatus)}</td>
                  <td>{riderById.get(c.riderId)?.team ?? <span className="muted">—</span>}</td>
                  <td>{categoryLabel(c)}</td>
                  <td>{shapeLabel(c)}</td>
                  <td>{c.startAt.slice(0, 10)}</td>
                  <td><ContractStatusBadge contract={c} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <MatchingCreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleRefresh}
        vehicles={vehicles}
        riders={riders}
      />
    </div>
  );
}
