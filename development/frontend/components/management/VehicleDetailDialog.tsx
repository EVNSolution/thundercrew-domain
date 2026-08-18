"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type ChangeEvent, type ReactNode } from "react";

import { PlateNumberInput } from "@/components/management/PlateNumberInput";
import { MaintenanceSection } from "@/components/management/VehicleMaintenanceSection";
import {
  changeVehicleOperationStatusInlineAction,
  recordAuditLogAction,
  setRiderInsuranceTextAction,
  updateVehicleFromOverviewAction
} from "@/app/actions";
import { useSimulatedCurrentTelemetry } from "@/components/overview/use-simulated-bike-pins";
import {
  getActiveContractForBikeAction,
  getBoxStatusAction,
  listVehicleHistoryAction,
  setBoxAttachedAction,
  type BoxStatus
} from "@/app/management/resources/actions";
import type {
  FrontendVehicle,
  ServiceOpsBikeOperationStatus,
  ServiceOpsBikeOperationStatusHistory,
  ServiceOpsRiderBikeContract
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
  bottomPanelOpen,
  returnTo = "/?tab=vehicles",
  maintenanceEnabled = true
}: {
  row: VehicleDetailRow | null;
  onClose: () => void;
  /** 하단 패널이 열려 있을 때 true — floating panel 높이를 줄여 겹침 방지. */
  bottomPanelOpen?: boolean;
  /** 수정 저장 후 돌아갈 경로. 자원 관리에서 열면 "/management/resources". */
  returnTo?: string;
  /** 정비 체크 섹션 표시 여부 — 지도(관제)에선 숨긴다 (관리는 정비 관리 화면). */
  maintenanceEnabled?: boolean;
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
  const boundUpdate = updateVehicleFromOverviewAction.bind(null, vehicleId, returnTo);
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
            <DetailField label="용도" value={purposeLabel(vehicle.purpose)} />
            <DetailField label="구분" value={engineTypeLabel(vehicle.engineType)} />
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
          {maintenanceEnabled ? (
            <MaintenanceSection
              vehicleId={vehicleId}
              bundle={maintenance}
              onChanged={handleMaintenanceChanged}
            />
          ) : null}
          {vehicle.purpose === "DELIVERY" ? <BoxSection vehicleId={vehicleId} /> : null}
          <MatchingSummarySection vehicleId={vehicleId} />
          <StatusHistorySection vehicleId={vehicleId} />
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
            용도
            <select name="purpose" defaultValue={vehicle.purpose ?? "DELIVERY"}>
              <option value="DELIVERY">배송용</option>
              <option value="CLEANING">클린차량</option>
            </select>
          </label>
          <label>
            구분
            <select name="engineType" defaultValue={vehicle.engineType ?? "ELECTRIC"}>
              <option value="ELECTRIC">전기</option>
              <option value="ICE">내연기관</option>
              <option value="LPG">LPG</option>
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

function purposeLabel(value: FrontendVehicle["purpose"]): string {
  if (value === "DELIVERY") return "배송용";
  if (value === "CLEANING") return "클린차량";
  return "—";
}

function engineTypeLabel(value: FrontendVehicle["engineType"]): string {
  if (value === "ELECTRIC") return "전기";
  if (value === "ICE") return "내연";
  if (value === "LPG") return "LPG";
  return "—";
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

  const rid = riderId;

  const handleBlur = (
    field: string,
    oldValue: string | null,
    newValue: string
  ) => {
    if ((oldValue ?? "") !== newValue) {
      void recordAuditLogAction({
        entityType: "RIDER_INSURANCE",
        entityId: rid,
        field,
        oldValue: oldValue ?? null,
        newValue: newValue || null
      });
    }
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
            onBlur={(e) =>
              handleBlur("primaryInsurance", primaryInsurance, e.currentTarget.value)
            }
          />
        </label>
        <label className="insurance-form-field">
          <span className="insurance-form-label">추가 보험</span>
          <input
            name="addonInsurance"
            defaultValue={addonInsurance ?? ""}
            maxLength={200}
            placeholder="예: 원데이 추가, 시간제"
            onBlur={(e) =>
              handleBlur("addonInsurance", addonInsurance, e.currentTarget.value)
            }
          />
        </label>
      </form>
    </section>
  );
}

// ============================================================================
// 함체 섹션 — 배송용 차량 전용
// ============================================================================

/**
 * 함체(배송함) 부착 여부 체크. 장비 도메인 재사용 — equipment_types 의 "함체"
 * 시드(V63) 를 찾아 부착=bike_equipment 생성, 해제=removedAt 기록. 이력은
 * 장비 도메인이 자동으로 남긴다.
 */
function BoxSection({ vehicleId }: { vehicleId: string }) {
  // undefined = 로딩, null = 조회 실패(미구성 환경 포함 — 섹션 숨김).
  const [status, setStatus] = useState<BoxStatus | null | undefined>(undefined);
  const [message, setMessage] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    getBoxStatusAction(vehicleId)
      .then((next) => { if (!cancelled) setStatus(next); })
      .catch(() => { if (!cancelled) setStatus(null); });
    return () => { cancelled = true; };
  }, [vehicleId, reloadTick]);

  // 조회 실패(관제 mock 환경 등)나 함체 유형 미시드면 섹션 자체를 숨긴다 —
  // 체크할 수 없는 UI 나 영구 "불러오는 중" 을 보여주지 않는다.
  if (status === null || (status && !status.available)) return null;

  const attached = status?.equipmentId != null;
  return (
    <section className="maintenance-section">
      <h4>함체</h4>
      {status === undefined ? (
        <p className="muted">불러오는 중…</p>
      ) : (
        <div className="box-section-row">
          <label className="box-section-check">
            <input
              type="checkbox"
              checked={attached}
              disabled={isPending}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                const next = event.target.checked;
                setMessage(null);
                startTransition(async () => {
                  const res = await setBoxAttachedAction(vehicleId, next, status.equipmentId);
                  if (!res.ok) setMessage(res.message ?? "함체 상태 변경 실패");
                  setReloadTick((t) => t + 1);
                });
              }}
            />
            함체 부착
          </label>
          {attached && status.installedAt ? (
            <span className="muted">부착일 {status.installedAt.slice(0, 10)}</span>
          ) : null}
          {message ? <span role="alert" style={{ color: "red" }}>{message}</span> : null}
        </div>
      )}
    </section>
  );
}

// ============================================================================
// 매칭 요약 섹션
// ============================================================================

/** 이 차량의 활성 매칭 1건 요약 — 이용자·형태·기간. 관리 동작은 매칭 표에서. */
function MatchingSummarySection({ vehicleId }: { vehicleId: string }) {
  const [contract, setContract] = useState<ServiceOpsRiderBikeContract | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    getActiveContractForBikeAction(vehicleId)
      .then((next) => { if (!cancelled) setContract(next); })
      .catch(() => { if (!cancelled) setContract(null); });
    return () => { cancelled = true; };
  }, [vehicleId]);

  return (
    <section className="maintenance-section">
      <h4>매칭</h4>
      {contract === undefined ? (
        <p className="muted">불러오는 중…</p>
      ) : contract === null ? (
        <p className="muted">활성 매칭 없음</p>
      ) : (
        <div className="detail-row-grid">
          <DetailField label="이용자" value={contract.riderName ?? "—"} />
          <DetailField label="연락처" value={contract.riderPhoneNumber ?? "—"} />
          <DetailField label="형태" value={contractShapeLabel(contract)} />
          <DetailField
            label="기간"
            value={`${contract.startAt.slice(0, 10)} ~ ${contract.endAt ? contract.endAt.slice(0, 10) : "무기한"}`}
          />
        </div>
      )}
    </section>
  );
}

/**
 * 계약 형태 라벨 — 용도가 축을 가른다. 클리닝 계약은 engagement(직영/협력),
 * 배송 계약은 구독/렌탈 + 인수/반납. MatchingManagementPanel 의 표기와 통일.
 */
function contractShapeLabel(contract: ServiceOpsRiderBikeContract): string {
  if (contract.engagementType === "DIRECT") return "클리닝 · 직영";
  if (contract.engagementType === "PARTNER") return "클리닝 · 협력";
  const category =
    contract.category === "SUBSCRIPTION" ? "구독" : contract.category === "RENTAL" ? "렌탈" : "기타";
  const returnType =
    contract.returnType === "TAKEOVER" ? "인수형" : contract.returnType === "RETURN" ? "반납형" : "—";
  return `${category} · ${returnType}`;
}

// ============================================================================
// 운영상태 이력 섹션
// ============================================================================

const HISTORY_STATUS_LABEL: Record<ServiceOpsBikeOperationStatus, string> = {
  READY: "대기",
  IN_SERVICE: "운행"
};

/** 최근 운영상태 변경 이력. 접힌 채로 시작 — 펼치는 순간 lazy fetch. */
function StatusHistorySection({ vehicleId }: { vehicleId: string }) {
  const [openHistory, setOpenHistory] = useState(false);
  const [rowsState, setRowsState] = useState<ServiceOpsBikeOperationStatusHistory[] | null>(null);

  useEffect(() => {
    if (!openHistory) return;
    let cancelled = false;
    listVehicleHistoryAction(vehicleId)
      .then((next) => { if (!cancelled) setRowsState(next); })
      .catch(() => { if (!cancelled) setRowsState([]); });
    return () => { cancelled = true; };
  }, [openHistory, vehicleId]);

  return (
    <section className="maintenance-section">
      <h4>
        <button
          type="button"
          className="status-history-toggle"
          onClick={() => setOpenHistory((v) => !v)}
        >
          운영상태 이력 {openHistory ? "▾" : "▸"}
        </button>
      </h4>
      {!openHistory ? null : rowsState === null ? (
        <p className="muted">불러오는 중…</p>
      ) : rowsState.length === 0 ? (
        <p className="muted">이력 없음</p>
      ) : (
        <ul className="status-history-list">
          {rowsState.map((h) => (
            <li key={h.id} className="status-history-row">
              <span>{h.startedAt.slice(0, 16).replace("T", " ")}</span>
              <span>{HISTORY_STATUS_LABEL[h.operationStatus] ?? h.operationStatus}</span>
              <span className="muted">{h.reason ?? ""}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
