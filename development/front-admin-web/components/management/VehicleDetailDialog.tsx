"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";

import { PlateNumberInput } from "@/components/management/PlateNumberInput";
import {
  deriveMaintenanceRows,
  type DerivedMaintenanceRow,
  type MaintenanceStatus
} from "@/components/management/vehicle-maintenance-derive";
import {
  markVehicleMaintenanceServicedAction,
  updateVehicleFromOverviewAction
} from "@/app/actions";
import type { FrontendVehicle, ServiceOpsBikeOperationStatus } from "@/lib/services/service-ops-api";
import type { VehicleDeviceResult } from "@/lib/services/vehicle-device-data";
import type { VehicleMaintenanceBundle } from "@/lib/services/vehicle-maintenance-data";

/**
 * 차량 상세 + 편집 floating 패널. PR-γ3b 이전엔 native `<dialog>` modal 이었지만,
 * 운영자가 표 행을 누르면 지도 위에서 그 차량을 따라가며 상세를 보고 싶다고
 * 요청해 `<div position: fixed>` 로 바꿔 floating presentation 으로 전환.
 *
 * 자동으로 지도 열기 + 차량 위치 pan 은 부모 (`VehiclesPanel`) 가 행 클릭 시
 * `VehicleFilterContext` 의 `setSelectedBikeId` 를 호출해 처리. 이 컴포넌트는
 * 자체 모달 lifecycle 을 더 이상 갖지 않는다 — open/close 는 부모의 `row` prop
 * 으로만 제어.
 *
 * IMEI(단말기 deviceUid) 도 같은 form 의 일부 — server action 이 device
 * 생성/조회 + bike-device-installation 생성/해제를 자동으로 처리한다. 운영자
 * 입장에선 차량 정보 / 운영 상태 / IMEI 세 가지를 한 번의 저장으로 묶는 것.
 */
export interface VehicleDetailRow {
  vehicle: FrontendVehicle;
  riderName: string | null;
  riderPhone: string | null;
}

const STATUS_TO_CODE: Record<FrontendVehicle["status"], ServiceOpsBikeOperationStatus> = {
  "운행": "IN_SERVICE",
  "대기": "READY"
};

export function VehicleDetailDialog({
  row,
  onClose
}: {
  row: VehicleDetailRow | null;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"view" | "edit">("view");
  // 현재 부착 단말기 정보. row 가 바뀔 때마다 lazy fetch — 미부착(null) /
  // 조회 실패 / 부착됨 세 상태가 같은 모양 (deviceUid: null 또는 string).
  const [deviceState, setDeviceState] = useState<VehicleDeviceResult | null>(null);
  // 정비 catalog + 이력. 차량별 두 list 를 한 round-trip 으로 받아 캐싱.
  const [maintenance, setMaintenance] = useState<VehicleMaintenanceBundle | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // ESC 로 패널 닫기. 모달이 아니라 floating 이라 page interaction 을 막지는
  // 않지만 키보드 접근성을 위해 listener 등록.
  useEffect(() => {
    if (!row) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [row, onClose]);

  // 차량이 바뀌면 단말기 정보도 새로 받아온다. 부모(`VehiclesPanel`) 가
  // `key={vehicleId}` 로 다이얼로그를 remount 시키므로 row 가 null → row 로
  // 바뀌는 모든 케이스는 자동으로 useState 초기값(null) 에서 시작. 여기서는
  // vehicleId 가 잡힐 때만 fetch 한다.
  const vehicleIdForFetch = row?.vehicle.id ?? row?.vehicle.slug ?? null;
  useEffect(() => {
    if (!vehicleIdForFetch) return;
    let cancelled = false;
    fetch(`/api/overview/vehicle-device/${encodeURIComponent(vehicleIdForFetch)}`, {
      cache: "no-store",
      credentials: "same-origin"
    })
      .then(async (response) => (response.ok ? ((await response.json()) as VehicleDeviceResult) : null))
      .then((next) => {
        if (cancelled) return;
        setDeviceState(next ?? { bikeId: vehicleIdForFetch, deviceUid: null, installationId: null });
      })
      .catch(() => {
        if (cancelled) return;
        setDeviceState({ bikeId: vehicleIdForFetch, deviceUid: null, installationId: null });
      });
    return () => {
      cancelled = true;
    };
  }, [vehicleIdForFetch]);

  // 정비 catalog + 이력 lazy fetch. 같은 차량에 대해 한 번만 호출.
  useEffect(() => {
    if (!vehicleIdForFetch) return;
    let cancelled = false;
    fetch(`/api/overview/vehicle-maintenance/${encodeURIComponent(vehicleIdForFetch)}`, {
      cache: "no-store",
      credentials: "same-origin"
    })
      .then(async (response) => (response.ok ? ((await response.json()) as VehicleMaintenanceBundle) : null))
      .then((next) => {
        if (cancelled) return;
        setMaintenance(next ?? { items: [], records: [] });
      })
      .catch(() => {
        if (cancelled) return;
        setMaintenance({ items: [], records: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [vehicleIdForFetch]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!row) return null;

  const { vehicle } = row;
  const vehicleId = vehicle.id ?? vehicle.slug;
  const boundUpdate = updateVehicleFromOverviewAction.bind(null, vehicleId);
  const currentOperationStatus = vehicle.operationStatus ?? STATUS_TO_CODE[vehicle.status];
  const currentDeviceUid = deviceState?.deviceUid ?? "";
  const currentInstallationId = deviceState?.installationId ?? "";

  return (
    <div
      ref={panelRef}
      className="vehicle-floating-panel"
      role="dialog"
      aria-label="차량 상세"
      aria-modal="false"
    >
      <div className="vehicle-floating-panel-header">
        <h3>차량 상세</h3>
        <button
          type="button"
          className="vehicle-floating-panel-close"
          onClick={handleClose}
          aria-label="닫기"
          title="닫기"
        >
          ×
        </button>
      </div>
      {mode === "view" ? (
        <div className="detail-row-grid">
          <DetailField label="차량번호" value={vehicle.plateNumber} />
          <DetailField label="구분" value={engineTypeLabel(vehicle.engineType)} />
          <DetailField label="모델명" value={vehicle.model || "—"} />
          <DetailField label="운영 상태" value={vehicle.status} />
          <DetailField label="이름" value={row.riderName ?? "—"} />
          <DetailField label="연락처" value={row.riderPhone ?? "—"} />
          <DetailField label="IMEI" value={currentDeviceUid || "—"} />
          <MaintenanceSection vehicleId={vehicleId} bundle={maintenance} />
          <div className="overview-create-dialog-actions">
            <button type="button" className="button-neutral" onClick={handleClose}>
              닫기
            </button>
            <button type="button" className="button-primary" onClick={() => setMode("edit")}>
              수정
            </button>
          </div>
        </div>
      ) : (
        <form action={boundUpdate}>
          {/* server action 이 두 endpoint 분기를 결정할 때 참고하는 현재 상태값. */}
          <input type="hidden" name="currentOperationStatus" value={currentOperationStatus} />
          {/* IMEI / installation 의 "현재값" 도 server action 의 diff 판단에 쓴다 —
              빈 값으로 저장하면 detach, 다른 값으로 저장하면 새로 attach. */}
          <input type="hidden" name="currentDeviceUid" value={currentDeviceUid} />
          <input type="hidden" name="currentInstallationId" value={currentInstallationId} />
          <label>
            차량번호
            <PlateNumberInput name="plateNumber" defaultValue={vehicle.plateNumber} required />
          </label>
          <label>
            구분
            <select name="engineType" defaultValue={vehicle.engineType ?? "ELECTRIC"}>
              <option value="ELECTRIC">전기</option>
              <option value="ICE">내연기관</option>
            </select>
          </label>
          <label>
            모델명 (메모)
            <input name="modelName" defaultValue={vehicle.model} maxLength={100} placeholder="예: NIU NQi GTS" />
          </label>
          <label>
            운영 상태
            <select name="operationStatus" defaultValue={currentOperationStatus}>
              <option value="READY">대기</option>
              <option value="IN_SERVICE">운행</option>
            </select>
          </label>
          <label>
            IMEI
            <input
              name="deviceUid"
              defaultValue={currentDeviceUid}
              maxLength={64}
              placeholder="단말기 IMEI 입력 (없음으로 두면 해제)"
              autoComplete="off"
              inputMode="numeric"
            />
          </label>
          <div className="overview-create-dialog-actions">
            <button type="button" className="button-neutral" onClick={() => setMode("view")}>
              취소
            </button>
            <button type="submit" className="button-primary">
              저장
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-field">
      <span className="detail-field-label">{label}</span>
      <span className="detail-field-value">{value}</span>
    </div>
  );
}

function engineTypeLabel(value: FrontendVehicle["engineType"]): string {
  if (value === "ELECTRIC") return "전기";
  if (value === "ICE") return "내연";
  return "—";
}

// ============================================================================
// 정비 상태 섹션
// ============================================================================

function MaintenanceSection({
  vehicleId,
  bundle
}: {
  vehicleId: string;
  bundle: VehicleMaintenanceBundle | null;
}) {
  const rows = useMemo(() => {
    if (!bundle) return null;
    return deriveMaintenanceRows(bundle.items, bundle.records);
  }, [bundle]);

  if (!bundle) {
    return (
      <section className="maintenance-section">
        <h4>정비 상태</h4>
        <p className="muted">불러오는 중…</p>
      </section>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <section className="maintenance-section">
        <h4>정비 상태</h4>
        <p className="muted">이 차량 구분에 적용되는 정비 품목이 없습니다.</p>
      </section>
    );
  }

  // 그룹 부모(예: 구동계3종) 가 있으면 자식들 위에 헤더로 노출되도록 정렬.
  // displayOrder 가 catalog seed 에서 부모(80) 다음에 자식(81~83) 순서로 박혀
  // 있어 단순 displayOrder 정렬로도 자연스러운 그루핑이 나온다. backend 정렬을
  // 신뢰하되 안전망 차원에서 다시 정렬.
  const ordered = [...rows].sort((a, b) => a.item.displayOrder - b.item.displayOrder);

  return (
    <section className="maintenance-section">
      <h4>정비 상태</h4>
      <ul className="maintenance-list">
        {ordered.map((row) => (
          <li key={row.item.id} className={row.item.parentItemId ? "maintenance-row maintenance-row--child" : "maintenance-row"}>
            <MaintenanceRowView vehicleId={vehicleId} row={row} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function MaintenanceRowView({
  vehicleId,
  row
}: {
  vehicleId: string;
  row: DerivedMaintenanceRow;
}) {
  const [pending, startTransition] = useTransition();
  const cycleLabel = renderCycleLabel(row);
  const isGroupHeader = row.item.cycleKm === null && row.item.cycleMonths === null && !row.item.cycleLabel;

  const handleServiced = () => {
    if (pending) return;
    if (!window.confirm(`"${row.item.name}" 교환 완료 처리하시겠습니까?`)) return;
    const fd = new FormData();
    fd.append("itemId", row.item.id);
    startTransition(() => {
      void markVehicleMaintenanceServicedAction(vehicleId, fd);
    });
  };

  return (
    <div className="maintenance-row-grid">
      <span className="maintenance-row-name">{row.item.name}</span>
      <span className="maintenance-row-cycle">{cycleLabel}</span>
      <span className="maintenance-row-last">{renderLastServiced(row)}</span>
      <span className="maintenance-row-status">{renderStatusBadge(row.status)}</span>
      {isGroupHeader ? null : (
        <button
          type="button"
          className="maintenance-row-action"
          onClick={handleServiced}
          disabled={pending}
          title={`${row.item.name} 교환 완료 마킹`}
        >
          교환 완료
        </button>
      )}
    </div>
  );
}

function renderCycleLabel(row: DerivedMaintenanceRow): string {
  const { item } = row;
  if (item.cycleLabel) return item.cycleLabel;
  if (item.cycleKm !== null) return `${item.cycleKm.toLocaleString()} km`;
  if (item.cycleMonths !== null) return `${item.cycleMonths}개월`;
  return "—";
}

function renderLastServiced(row: DerivedMaintenanceRow): ReactNode {
  if (!row.lastServicedAt) return <span className="muted">기록 없음</span>;
  const date = new Date(row.lastServicedAt);
  const dateLabel = Number.isNaN(date.valueOf())
    ? row.lastServicedAt
    : date.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
  if (row.lastServicedAtOdometerKm !== null) {
    return `${dateLabel} · ${row.lastServicedAtOdometerKm.toLocaleString()} km`;
  }
  return dateLabel;
}

function renderStatusBadge(status: MaintenanceStatus): ReactNode {
  switch (status) {
    case "HEALTHY":
      return <span className="vehicles-pill vehicles-pill--operating">정상</span>;
    case "DUE_SOON":
      return <span className="vehicles-pill vehicles-pill--engine-ice">임박</span>;
    case "OVERDUE":
      return <span className="vehicles-pill vehicles-pill--unknown">지연</span>;
    case "NEVER":
      return <span className="vehicles-pill vehicles-pill--idle">기록 없음</span>;
    case "UNKNOWN":
    default:
      return <span className="muted">—</span>;
  }
}
