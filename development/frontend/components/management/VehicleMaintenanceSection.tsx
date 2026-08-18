"use client";

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";

import {
  markVehicleMaintenanceServicedAction,
  recordAuditLogAction
} from "@/app/actions";
import {
  deriveMaintenanceRows,
  type DerivedMaintenanceRow
} from "@/components/management/vehicle-maintenance-derive";
import type { VehicleMaintenanceBundle } from "@/lib/services/vehicle-maintenance-data";

/**
 * 차량 정비 체크 섹션 — 정비 관리 페이지와 자원 관리 차량 상세가 공유한다.
 * (지도 마커 패널에서는 뺐다 — 관제는 보는 화면, 관리는 관리 화면.)
 */

// ============================================================================
// 정비 상태 섹션
// ============================================================================

export function MaintenanceSection({
  vehicleId,
  bundle,
  onChanged
}: {
  vehicleId: string;
  bundle: VehicleMaintenanceBundle | null;
  /**
   * "교환 완료" 액션이 백엔드에 성공적으로 적용된 직후 호출. 부모가
   * maintenance bundle 을 재페치해 새 record 를 즉시 노출하도록 한다.
   */
  onChanged: () => void;
}) {
  const rows = useMemo(() => {
    if (!bundle) return null;
    return deriveMaintenanceRows(bundle.items, bundle.records, bundle.currentState ?? null);
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

  // 백엔드 응답 순서(이미 정렬됨)를 신뢰해 그대로 사용.
  const ordered = rows;

  // 텔레메트리 ONLINE 일 때만 km 기반 자동 분류가 작동. 오프라인일 땐 cycle_km
  // 품목의 상태 셀에 "오프라인" 뱃지를 박아 운영자에게 "지금 자동 계산이 안
  // 되고 있다" 는 사실을 알린다. 별도 섹션 배너는 두지 않음 — 행 단위로 표시.
  const currentState = bundle.currentState;
  const telemetryOffline = !currentState || currentState.connectionStatus !== "ONLINE";
  // 교환 완료 액션이 baseline odometer 로 박을 값. 텔레메트리 ONLINE 이고
  // 수치가 있을 때만 의미가 있고, 그 외엔 null 로 두어 backend record 의
  // serviced_at_odometer_km 도 null 이 박힌다 (다음 분류 못 함).
  const currentOdometerKm =
    currentState && currentState.connectionStatus === "ONLINE" && typeof currentState.odometerKm === "number"
      ? currentState.odometerKm
      : null;

  return (
    <section className="maintenance-section">
      <h4>정비 상태</h4>
      <ul className="maintenance-list">
        {ordered.map((row) => (
          <li key={row.item.id} className="maintenance-row">
            <MaintenanceRowView
              vehicleId={vehicleId}
              row={row}
              telemetryOffline={telemetryOffline}
              currentOdometerKm={currentOdometerKm}
              onChanged={onChanged}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function MaintenanceRowView({
  vehicleId,
  row,
  telemetryOffline,
  currentOdometerKm,
  onChanged
}: {
  vehicleId: string;
  row: DerivedMaintenanceRow;
  /** 텔레메트리 connectionStatus 가 ONLINE 이 아닐 때 true. km 기반 행 상태
   *  뱃지를 "오프라인" 으로 대체한다. cycle_months 만 있는 행에는 영향 없음. */
  telemetryOffline: boolean;
  /** "교환 완료" 클릭 시점의 차량 누적 주행거리 (km). null 이면 baseline 없이
   *  record 가 박혀 다음 cycle_km 분류가 안 됨. */
  currentOdometerKm: number | null;
  onChanged: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const cycleLabel = renderCycleLabel(row);
  const isGroupHeader = row.item.cycleKm === null && row.item.cycleMonths === null;

  const handleServiced = () => {
    if (pending) return;
    if (!window.confirm(`"${row.item.name}" 교환 완료 처리하시겠습니까?`)) return;
    const fd = new FormData();
    fd.append("itemId", row.item.id);
    // 현재 텔레메트리 odometer 를 baseline 으로 박는다. 다음 cycle_km 분류가
    // (current odometer − baseline) / cycleKm 로 작동하려면 이 record 한 건의
    // 시점 odometer 가 필요. null 이면 (텔레메트리 미수신 차량) baseline 없는
    // record 가 박히고, 그 행은 다음 화면에서도 UNKNOWN.
    if (currentOdometerKm !== null) {
      fd.append("servicedAtOdometerKm", String(currentOdometerKm));
    }
    startTransition(async () => {
      // 액션이 redirect 대신 result 를 반환하므로 await 으로 완료를 잡고
      // 성공 시에만 부모에게 재페치 시그널을 보낸다. 실패 케이스는 일단
      // alert 으로 알리는 정도 — 더 정교한 toast 는 추후.
      const result = await markVehicleMaintenanceServicedAction(vehicleId, fd);
      if (result.ok) {
        void recordAuditLogAction({
          entityType: "MAINTENANCE",
          entityId: vehicleId,
          field: row.item.name,
          oldValue: null,
          newValue: "교환 완료"
        });
        onChanged();
      } else if (result.reason === "session-required") {
        window.location.href = "/login?status=session-required";
      } else {
        window.alert("교환 완료 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      }
    });
  };

  return (
    <div className="maintenance-row-grid">
      {/* Row 1: 품목명 (좌) · 상태 뱃지 (우) */}
      <span className="maintenance-row-name">{row.item.name}</span>
      <span className="maintenance-row-status">{renderStatusBadge(row, telemetryOffline)}</span>
      {/* Row 2: 주기 · 마지막 교환 (좌) · 교환 완료 버튼 (우) */}
      <div className="maintenance-row-info">
        <span className="maintenance-row-cycle">{cycleLabel}</span>
        <span className="maintenance-row-divider" aria-hidden="true">·</span>
        <span className="maintenance-row-last">{renderLastServiced(row)}</span>
      </div>
      {isGroupHeader ? (
        <span aria-hidden="true" />
      ) : (
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

function renderStatusBadge(row: DerivedMaintenanceRow, telemetryOffline: boolean): ReactNode {
  // 텔레메트리 오프라인 + cycle_km 자동 분류가 필요한 행 — 운영자에게 "지금
  // 상태 계산이 안 되고 있는 이유" 를 정확히 알려주려고 "오프라인" 뱃지로
  // 대체. cycle_months 가 같이 잡힌 행은 derive 가 이미 분류한 status 가
  // 우선이므로 영향 없음. NEVER 도 정보가 더 정확하므로 그대로 둠.
  if (
    telemetryOffline &&
    row.status === "UNKNOWN" &&
    row.item.cycleKm !== null &&
    row.item.cycleMonths === null
  ) {
    return <span className="vehicles-pill vehicles-pill--idle">오프라인</span>;
  }
  switch (row.status) {
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



// ============================================================================
// 정비 관리 페이지 — 차량별 정비 체크 패널
// ============================================================================

type MaintenanceVehicleOption = { id: string; plateNumber: string; purpose?: string | null };

/**
 * 정비 관리 화면의 "차량 정비 체크" — 차량을 고르면 그 차량의 정비 상태를
 * 불러와 교환 완료를 마킹한다. 지도 마커 패널에 있던 관리 동작을 이관한 것.
 * 번들 fetch 는 차량 상세와 같은 Next API 라우트를 재사용한다.
 */
export function VehicleMaintenanceCheckPanel({ vehicles }: { vehicles: MaintenanceVehicleOption[] }) {
  const [bikeId, setBikeId] = useState("");
  const [bundle, setBundle] = useState<VehicleMaintenanceBundle | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!bikeId) {
      const handle = window.requestAnimationFrame(() => {
        if (!cancelled) setBundle(null);
      });
      return () => {
        cancelled = true;
        window.cancelAnimationFrame(handle);
      };
    }
    fetch(`/api/overview/vehicle-maintenance/${encodeURIComponent(bikeId)}`, {
      cache: "no-store",
      credentials: "same-origin"
    })
      .then(async (r) => (r.ok ? ((await r.json()) as VehicleMaintenanceBundle) : null))
      .then((next) => {
        if (!cancelled) setBundle(next);
      })
      .catch(() => {
        if (!cancelled) setBundle(null);
      });
    return () => {
      cancelled = true;
    };
  }, [bikeId, reloadTick]);

  return (
    <div className="management-panel">
      <div className="mgmt-panel-header">
        <div className="mgmt-panel-header-left">
          <span className="mgmt-panel-title">차량 정비 체크</span>
        </div>
        <div className="mgmt-panel-header-actions">
          <select
            className="mgmt-panel-search"
            value={bikeId}
            onChange={(e) => setBikeId(e.target.value)}
            aria-label="정비 체크 차량"
          >
            <option value="">차량 선택</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.plateNumber}
                {v.purpose === "CLEANING" ? " · 클린차량" : " · 배송용"}
              </option>
            ))}
          </select>
        </div>
      </div>
      {!bikeId ? (
        <p className="muted">차량을 선택하면 정비 상태가 표시됩니다.</p>
      ) : (
        <MaintenanceSection
          vehicleId={bikeId}
          bundle={bundle}
          onChanged={() => setReloadTick((t) => t + 1)}
        />
      )}
    </div>
  );
}
