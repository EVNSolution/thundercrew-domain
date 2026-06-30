"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type ChangeEvent, type ReactNode } from "react";

import { PlateNumberInput } from "@/components/management/PlateNumberInput";
import {
  deriveMaintenanceRows,
  type DerivedMaintenanceRow,
  type MaintenanceStatus
} from "@/components/management/vehicle-maintenance-derive";
import {
  changeVehicleOperationStatusInlineAction,
  markVehicleMaintenanceServicedAction,
  recordAuditLogAction,
  setRiderInsuranceTextAction,
  updateVehicleFromOverviewAction
} from "@/app/actions";
import { useSimulatedCurrentTelemetry } from "@/components/overview/use-simulated-bike-pins";
import type {
  FrontendVehicle,
  ServiceOpsBikeOperationStatus,
  ServiceOpsBikeServiceType
} from "@/lib/services/service-ops-api";
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
 * IMEI 와 단말기 ID(terminalId) 는 Bike 속성으로, 자원 관리와 동일한 값을 보여준다.
 * deviceUid 는 별도 텔레메트리 단말기 연동 식별자다 — server action 이 device
 * 생성/조회 + bike-device-installation 생성/해제를 자동으로 처리한다. 운영자
 * 입장에선 차량 정보 / 운영 상태 / 단말기 연동 세 가지를 한 번의 저장으로 묶는 것.
 */
export interface VehicleDetailRow {
  vehicle: FrontendVehicle;
  riderName: string | null;
  riderPhone: string | null;
  /** 현재 배정된 라이더 id. null 이면 보험 편집 불가 (보험이 라이더에 귀속). */
  riderId: string | null;
  /** 라이더의 기본 보험 자유 텍스트. riderId 없으면 null. */
  primaryInsurance: string | null;
  /** 라이더의 추가 보험 자유 텍스트. riderId 없으면 null. */
  addonInsurance: string | null;
}

const STATUS_TO_CODE: Record<FrontendVehicle["status"], ServiceOpsBikeOperationStatus> = {
  "운행": "IN_SERVICE",
  "대기": "READY"
};

export function VehicleDetailDialog({
  row,
  onClose,
  bottomPanelOpen
}: {
  row: VehicleDetailRow | null;
  onClose: () => void;
  /** 하단 패널이 열려 있을 때 true — floating panel 높이를 줄여 겹침 방지. */
  bottomPanelOpen?: boolean;
}) {
  const [mode, setMode] = useState<"view" | "edit">("view");
  // 현재 부착 단말기 정보. row 가 바뀔 때마다 lazy fetch — 미부착(null) /
  // 조회 실패 / 부착됨 세 상태가 같은 모양 (deviceUid: null 또는 string).
  const [deviceState, setDeviceState] = useState<VehicleDeviceResult | null>(null);
  // 정비 catalog + 이력. 차량별 두 list 를 한 round-trip 으로 받아 캐싱.
  const [maintenance, setMaintenance] = useState<VehicleMaintenanceBundle | null>(null);
  // 정비 bundle 재페치 트리거. "교환 완료" 액션이 끝나면 +1 → maintenance
  // useEffect 가 같은 vehicleId 라도 다시 발화해 새 record 를 반영.
  const [maintenanceReloadTick, setMaintenanceReloadTick] = useState(0);
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

  // 정비 catalog + 이력 lazy fetch. `maintenanceReloadTick` 증가 시에도
  // 재발화 — "교환 완료" 후 즉시 갱신이 보이도록.
  useEffect(() => {
    if (!vehicleIdForFetch) return;
    const bikeId = vehicleIdForFetch;
    let cancelled = false;
    // 패널이 열려있는 동안 텔레메트리(마지막 수신·연결상태 등)를 주기적으로
    // 갱신한다. bike_current_states 는 NT 수신마다 갱신되는데, 폴링이 없으면
    // 열어둔 패널의 "마지막 수신" 이 연 시점 값에 고정돼 안 움직인다.
    const POLL_INTERVAL_MS = 15_000;

    function loadBundle() {
      fetch(`/api/overview/vehicle-maintenance/${encodeURIComponent(bikeId)}`, {
        cache: "no-store",
        credentials: "same-origin"
      })
        .then(async (response) => (response.ok ? ((await response.json()) as VehicleMaintenanceBundle) : null))
        .then((next) => {
          if (cancelled) return;
          setMaintenance(next ?? { items: [], records: [], currentState: null });
        })
        .catch(() => {
          if (cancelled) return;
          setMaintenance({ items: [], records: [], currentState: null });
        });
    }

    loadBundle();
    const timer = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      loadBundle();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [vehicleIdForFetch, maintenanceReloadTick]);

  const handleMaintenanceChanged = useCallback(() => {
    setMaintenanceReloadTick((tick) => tick + 1);
  }, []);

  const overlaidCurrent = useSimulatedCurrentTelemetry(maintenance?.currentState ?? null, vehicleIdForFetch);

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
      className={`vehicle-floating-panel${bottomPanelOpen ? " vehicle-floating-panel--bottom-open" : ""}`}
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
        // view 모드 내부 구조: 위에서 아래로 (1) 2-컬럼 field grid, (2) 정비
        // 섹션, (3) 액션 버튼. 정비 섹션을 grid 안에 두면 IMEI 오른쪽 셀로
        // 흘러들어가서 어색하게 붙어 보이는 문제를 막기 위해 grid 밖으로
        // 분리. 액션 버튼도 같이 빠져 나와서 패널 하단에 자연스럽게 위치.
        <div className="vehicle-detail-view">
          <div className="detail-row-grid">
            <DetailField label="차량번호" value={vehicle.plateNumber} />
            <DetailField label="구분" value={engineTypeLabel(vehicle.engineType)} />
            <DetailField label="운영 방식" value={serviceTypeLabel(vehicle.serviceType)} />
            <DetailField label="모델명" value={vehicle.model || "—"} />
            <OperationStatusInlineField
              vehicleId={vehicleId}
              currentOperationStatus={currentOperationStatus}
            />
            <DetailField label="이름" value={row.riderName ?? "—"} />
            <DetailField label="연락처" value={row.riderPhone ?? "—"} />
            <DetailField label="IMEI" value={vehicle.imei || "—"} />
            <DetailField label="단말기 ID" value={vehicle.terminalId || "—"} />
          </div>
          <TelemetrySection current={overlaidCurrent} loading={maintenance === null} />
          <InsuranceSection
            riderId={row.riderId}
            primaryInsurance={row.primaryInsurance}
            addonInsurance={row.addonInsurance}
          />
          <MaintenanceSection
            vehicleId={vehicleId}
            bundle={maintenance}
            onChanged={handleMaintenanceChanged}
          />
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
            운영 방식
            <select name="serviceType" defaultValue={vehicle.serviceType ?? "SINGLE"}>
              <option value="CALL">콜 배차</option>
              <option value="SINGLE">단일 배차</option>
              <option value="SEQUENTIAL">순차 배차</option>
              <option value="ROUND">왕복 배차</option>
              <option value="OTHER">기타</option>
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
              name="imei"
              defaultValue={vehicle.imei ?? ""}
              maxLength={15}
              placeholder="모뎀 IMEI (15자리)"
              autoComplete="off"
              inputMode="numeric"
            />
          </label>
          <label>
            단말기 ID
            <input
              name="terminalId"
              defaultValue={vehicle.terminalId ?? ""}
              maxLength={64}
              placeholder="단말기 관리 ID"
              autoComplete="off"
            />
          </label>
          <label>
            단말기 연동 (deviceUid)
            <input
              name="deviceUid"
              defaultValue={currentDeviceUid}
              maxLength={64}
              placeholder="텔레메트리 단말기 deviceUid (없음으로 두면 해제)"
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

/**
 * VIEW 모드에서 운행 상태를 인라인으로 변경하는 select 컨트롤.
 * 변경 즉시 서버 액션을 호출하고, 실패 시 이전 값으로 되돌린다.
 */
function OperationStatusInlineField({
  vehicleId,
  currentOperationStatus
}: {
  vehicleId: string;
  currentOperationStatus: ServiceOpsBikeOperationStatus;
}) {
  const [selected, setSelected] = useState<ServiceOpsBikeOperationStatus>(currentOperationStatus);
  const [pending, startTransition] = useTransition();

  const handleChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const next = e.currentTarget.value as ServiceOpsBikeOperationStatus;
    const prev = selected;
    setSelected(next);
    startTransition(async () => {
      const result = await changeVehicleOperationStatusInlineAction(vehicleId, next, prev);
      if (!result.ok) {
        if (result.error === "session-required") {
          window.location.href = "/login?status=session-required";
          return;
        }
        window.alert("운행 상태 변경에 실패했습니다. 잠시 후 다시 시도해 주세요.");
        setSelected(prev);
      }
    });
  };

  return (
    <div className="detail-field">
      <span className="detail-field-label">운영 상태</span>
      <select
        className="detail-field-inline-select"
        value={selected}
        onChange={handleChange}
        disabled={pending}
        aria-label="운영 상태 변경"
      >
        <option value="READY">대기</option>
        <option value="IN_SERVICE">운행</option>
      </select>
    </div>
  );
}

function engineTypeLabel(value: FrontendVehicle["engineType"]): string {
  if (value === "ELECTRIC") return "전기";
  if (value === "ICE") return "내연";
  return "—";
}

function serviceTypeLabel(t?: ServiceOpsBikeServiceType): string {
  switch (t) {
    case "CALL": return "콜 배차";
    case "SINGLE": return "단일 배차";
    case "SEQUENTIAL": return "순차 배차";
    case "ROUND": return "왕복 배차";
    case "OTHER": return "기타";
    default: return "단일 배차";
  }
}

// ============================================================================
// 텔레메트리 섹션
// ============================================================================

/**
 * 차량 상세 패널에서 정비 섹션 바로 위에 들어가는 "텔레메트리" 섹션. 운영자가
 * 차량의 실시간 상태(연결 / 시동 / 배터리 / 누적 km / 마지막 수신 시각) 를
 * 한눈에 보고 정비 판단을 빠르게 할 수 있게 한다.
 *
 * 데이터 자체는 정비 섹션과 같은 bundle 의 `currentState` 에서 온다 — 별도
 * fetch 없음. 텔레메트리가 한 번도 안 들어온 차량은 null fallback.
 */
function TelemetrySection({
  current,
  loading
}: {
  current: {
    odometerKm: number | null;
    connectionStatus: string;
    ignitionStatus: string;
    batteryPercent: number | null;
    batteryStatus: string;
    speedKph: number | null;
    drivingStatus: string;
    lastReceivedAt: string;
  } | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <section className="telemetry-section">
        <h4>텔레메트리</h4>
        <p className="muted">불러오는 중…</p>
      </section>
    );
  }

  if (!current) {
    return (
      <section className="telemetry-section">
        <h4>텔레메트리</h4>
        <p className="muted">아직 수신된 텔레메트리가 없습니다.</p>
      </section>
    );
  }

  return (
    <section className="telemetry-section">
      <h4>텔레메트리</h4>
      <dl className="telemetry-list">
        <TelemetryRow label="마지막 수신" value={renderLastReceivedLabel(current.lastReceivedAt)} />
      </dl>
    </section>
  );
}

function TelemetryRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="telemetry-row">
      <dt className="telemetry-row-label">{label}</dt>
      <dd className="telemetry-row-value">{value}</dd>
    </div>
  );
}


function renderLastReceivedLabel(lastReceivedAt: string): string {
  const date = new Date(lastReceivedAt);
  if (Number.isNaN(date.valueOf())) return lastReceivedAt;
  const diffMs = Date.now() - date.valueOf();
  const absolute = date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
  return `${absolute} · ${relativeTimeKo(diffMs)}`;
}

function relativeTimeKo(diffMs: number): string {
  if (diffMs < 0) return "방금";
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}초 전`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

// ============================================================================
// 정비 상태 섹션
// ============================================================================

function MaintenanceSection({
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
// 보험 섹션
// ============================================================================

/**
 * 차량 상세 패널 내 보험 섹션 — 라이더 보험 자유 텍스트 2칸(기본/추가).
 *
 * 보험 데이터는 라이더에 귀속 — riderId 가 없으면 편집 불가. 각 입력은 blur
 * 시 form.requestSubmit() 으로 `setRiderInsuranceTextAction` 을 호출한다.
 * 차량 수정 form 과 nested form 충돌을 피하기 위해 별도 `<form>` 사용.
 */
function InsuranceSection({
  riderId,
  primaryInsurance,
  addonInsurance
}: {
  riderId: string | null;
  primaryInsurance: string | null;
  addonInsurance: string | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  if (!riderId) {
    return (
      <section className="insurance-section">
        <h4>보험</h4>
        <p className="muted">배정된 라이더 없음</p>
      </section>
    );
  }

  const boundAction = setRiderInsuranceTextAction.bind(null, riderId);

  const handleBlur = () => {
    void recordAuditLogAction({
      entityType: "RIDER_INSURANCE",
      entityId: riderId,
      field: "insurance",
      oldValue: null,
      newValue: null
    });
    formRef.current?.requestSubmit();
  };

  return (
    <section className="insurance-section">
      <h4>보험</h4>
      <form ref={formRef} className="insurance-form" action={boundAction}>
        <label className="insurance-form-field">
          <span className="insurance-form-label">기본 보험</span>
          <input
            name="primaryInsurance"
            defaultValue={primaryInsurance ?? ""}
            maxLength={200}
            placeholder="예: KB손해보험 기본형"
            onBlur={handleBlur}
          />
        </label>
        <label className="insurance-form-field">
          <span className="insurance-form-label">추가 보험</span>
          <input
            name="addonInsurance"
            defaultValue={addonInsurance ?? ""}
            maxLength={200}
            placeholder="예: 원데이 추가, 시간제"
            onBlur={handleBlur}
          />
        </label>
      </form>
    </section>
  );
}
