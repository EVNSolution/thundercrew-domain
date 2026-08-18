"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { ExcelImportButton } from "./ExcelImportButton";
import { VehicleCreateDialog } from "./ResourceCreateDialogs";
import { VehicleDetailDialog, type VehicleDetailRow } from "./VehicleDetailDialog";
import {
  bulkPreviewVehiclesAction,
  bulkApplyVehiclesAction,
  deleteVehicleAction
} from "@/app/management/vehicles/actions";
import type {
  FrontendRider,
  FrontendVehicle,
  ServiceOpsRiderBikeContract
} from "@/lib/services/service-ops-api";

function WheelTypeBadge({ value }: { value?: string | null }) {
  if (!value) return <span className="muted">—</span>;
  return <span>{value === "TWO_WHEEL" ? "2륜" : "4륜"}</span>;
}

function EngineTypeBadge({ value }: { value?: string | null }) {
  if (!value) return <span className="muted">—</span>;
  // 2갈래 삼항으로 두면 안 된다. LPG 가 "내연" 으로 표시되고, 운영자는 목록만 보고
  // LPG 차량을 내연으로 착각한다. 동력은 3갈래다.
  if (value === "ELECTRIC") return <span>전기</span>;
  if (value === "ICE") return <span>내연</span>;
  if (value === "LPG") return <span>LPG</span>;
  return <span className="muted">{value}</span>;
}

/** 용도. 배차 방식과 같은 축이다 — 배송용=콜, 클린차량=시간 기반 순차. */
function PurposeBadge({ value }: { value?: string | null }) {
  if (!value) return <span className="muted">—</span>;
  if (value === "DELIVERY") return <span>배송용</span>;
  if (value === "CLEANING") return <span>클린차량</span>;
  return <span className="muted">{value}</span>;
}

/**
 * 자원 관리의 차량 표. 목록은 서버 컴포넌트(page)가 내려준 props 가 단일
 * 소스다 — 등록/삭제/수정 후엔 `router.refresh()` 로 서버 재렌더를 트리거해
 * 새 목록을 받는다.
 *
 * 행 클릭 → 차량 상세 (기본 정보 수정 / 정비 체크 / 함체 / 매칭 요약 /
 * 운영상태 이력). 관제의 floating 패널과 같은 `VehicleDetailDialog` 를
 * 재사용하고, returnTo 만 자원 관리로 바꾼다.
 */
export function VehiclesManagementPanel({
  vehicles,
  riders,
  contracts,
  exportUrl
}: {
  vehicles: ReadonlyArray<FrontendVehicle>;
  riders: ReadonlyArray<FrontendRider>;
  contracts: ReadonlyArray<ServiceOpsRiderBikeContract>;
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
    if (!q) return vehicles;
    return vehicles.filter((v) =>
      [v.plateNumber, v.imei, v.terminalId, v.model]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q))
    );
  }, [vehicles, search]);

  // 상세 다이얼로그에 넣을 라이더 컨텍스트 — 활성 매칭에서 역참조한다.
  // (관제에선 지도 데이터가 이 매핑을 만들지만, 여기선 계약 목록으로 충분.)
  const detailRow = useMemo<VehicleDetailRow | null>(() => {
    if (!selectedId) return null;
    const vehicle = vehicles.find((v) => (v.id ?? v.slug) === selectedId);
    if (!vehicle) return null;
    // 활성 = 미종료. 매칭 표의 "진행 중" 정의와 동일 — 만료(endAt) 판정은
    // 서버 측 조회(getActiveContractForBikeAction)가 맡는다.
    const contract = contracts.find((c) => c.bikeId === selectedId && !c.terminatedAt);
    const rider = contract ? riders.find((r) => (r.id ?? r.slug) === contract.riderId) ?? null : null;
    return {
      vehicle,
      riderName: rider?.name ?? contract?.riderName ?? null,
      riderPhone: rider?.phone ?? contract?.riderPhoneNumber ?? null,
      riderId: contract?.riderId ?? null
    };
  }, [selectedId, vehicles, riders, contracts]);

  const handleRefresh = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <div className="management-panel">
      <div className="mgmt-panel-header">
        <div className="mgmt-panel-header-left">
          <span className="mgmt-panel-title">차량</span>
          <span className="mgmt-panel-count">{vehicles.length}</span>
        </div>
        <div className="mgmt-panel-header-actions">
          <input
            type="search"
            className="mgmt-panel-search"
            placeholder="차량번호 · IMEI 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="차량 검색"
          />
          <button type="button" className="button-secondary" onClick={() => setCreateOpen(true)}>
            등록
          </button>
          <a href={exportUrl} target="_blank" rel="noreferrer">
            <button type="button" className="button-secondary">내려받기</button>
          </a>
          <ExcelImportButton
            onPreview={bulkPreviewVehiclesAction}
            onApply={bulkApplyVehiclesAction}
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
              <th>차량번호</th>
              <th>용도</th>
              <th>구분</th>
              <th>엔진</th>
              <th>IMEI</th>
              <th>단말기 ID</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="table-empty-cell">
                  {vehicles.length === 0 ? "차량 없음" : "검색 결과 없음"}
                </td>
              </tr>
            ) : (
              filtered.map((v) => (
                <tr
                  key={v.slug}
                  className="table-row-clickable"
                  onClick={() => setSelectedId(v.id ?? v.slug)}
                >
                  <td onClick={(e) => e.stopPropagation()}>
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
                  <td><PurposeBadge value={v.purpose} /></td>
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

      <VehicleCreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(partialNotice) => {
          setNotice(partialNotice ?? null);
          handleRefresh();
        }}
      />
      {detailRow ? (
        <VehicleDetailDialog
          key={selectedId}
          row={detailRow}
          onClose={() => setSelectedId(null)}
          returnTo="/management/resources"
        />
      ) : null}
    </div>
  );
}
