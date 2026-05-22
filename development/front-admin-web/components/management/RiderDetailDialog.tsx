"use client";

import { useCallback, useRef, useState, useTransition } from "react";

import { PhoneNumberInput } from "@/components/management/PhoneNumberInput";
import type { InsuranceOption } from "@/components/management/RidersPanel";
import { TerminateContractButton } from "@/components/management/TerminateContractButton";
import {
  setVehicleIgnitionBlockFromOverviewAction,
  updateRiderFromOverviewAction
} from "@/app/actions";
import { useScrollLockedDialog } from "@/lib/hooks/use-scroll-locked-dialog";
import type { FrontendRider } from "@/lib/services/service-ops-api";

/**
 * 라이더 상세 + 편집 다이얼로그. 패널이 활성 행을 prop 으로 넘기면 자동으로
 * `<dialog>` 가 열린다. 처음엔 읽기 전용 상세 화면이고, "수정" 누르면 같은
 * 다이얼로그에서 입력 모드로 전환되어 이름 / 연락처 / 보험 을 바꿀 수 있다.
 *
 * 활성 계약(매칭)이 있는 경우엔 view 모드에 차량 시동 상태와 시동 방지
 * 토글이 같이 보인다. 시동 방지 토글은 backend `PATCH /bikes/{id}/ignition-block`
 * 를 호출한다 — 운영자의 의도(intent) 영속화. 실제 차량 측 명령 전달은
 * vendor telemetry adapter 슬라이스에서 처리.
 */
export interface RiderDetailRow {
  rider: FrontendRider;
  educationLabel: string;
  plate: string | null;
  category: string | null;
  returnType: string | null;
  durationLabel: string | null;
  hasInsurance: boolean | null;
  /** 활성 rider_bike_contract 의 id. 있으면 view 모드에서 "계약 종료" 버튼이 노출된다. */
  activeContractId: string | null;
  /** 현재 활성 rider_insurance row 의 id. 변경/해지 시 server action 이 삭제 대상으로 참조. */
  currentInsuranceId: string | null;
  /** 현재 가입된 보험 상품(insurance_item) id. select 의 기본 선택값. */
  currentInsuranceItemId: string | null;
  /** 매칭된 차량의 bikeId. 시동 상태 / 시동 방지 토글의 대상. */
  activeBikeId: string | null;
  /** 매칭된 차량의 telemetry ignition_status (ON/OFF/그 외). null 이면 텔레메트리 없음. */
  ignitionStatus: string | null;
  /** 매칭된 차량의 "시동 방지" 운영자 토글 현재 상태. */
  ignitionBlocked: boolean;
}

export function RiderDetailDialog({
  row,
  insuranceOptions,
  onClose
}: {
  row: RiderDetailRow | null;
  insuranceOptions: ReadonlyArray<InsuranceOption>;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [ignitionPending, startIgnitionTransition] = useTransition();
  // 토글 클릭 직후 화면이 즉시 바뀌게 optimistic 처리. 페이지 revalidate 후
  // row prop 이 갱신되면 자동으로 정정된다.
  const [ignitionBlockedOptimistic, setIgnitionBlockedOptimistic] = useState<boolean | null>(null);

  // 다이얼로그를 native <dialog> 모달로 띄우거나 닫기만 한다. 자동 포커스로
  // 인한 페이지 스크롤 점프는 훅 안에서 잡는다. mode 초기화나 입력 상태
  // 리셋은 effect 가 아니라 부모에서 `key={rider id}` 로 컴포넌트를 재마운트해
  // 자연스럽게 처리한다 (react-hooks/set-state-in-effect 회피).
  useScrollLockedDialog(dialogRef, row !== null);

  const handleClose = useCallback(() => {
    dialogRef.current?.close();
    onClose();
  }, [onClose]);

  if (!row) return null;

  const { rider } = row;
  const riderId = rider.id ?? rider.slug;
  const boundUpdate = updateRiderFromOverviewAction.bind(null, riderId);
  const currentInsuranceLabel = row.currentInsuranceItemId
    ? insuranceOptions.find((option) => option.id === row.currentInsuranceItemId)?.label ?? "있음"
    : "—";

  const effectiveIgnitionBlocked = ignitionBlockedOptimistic ?? row.ignitionBlocked;
  const handleIgnitionToggle = () => {
    if (!row.activeBikeId || ignitionPending) return;
    const next = !effectiveIgnitionBlocked;
    setIgnitionBlockedOptimistic(next);
    const fd = new FormData();
    fd.append("blocked", next ? "true" : "false");
    startIgnitionTransition(() => {
      void setVehicleIgnitionBlockFromOverviewAction(row.activeBikeId!, fd);
    });
  };

  return (
    <dialog
      ref={dialogRef}
      className="overview-create-dialog"
      onClose={onClose}
      onCancel={onClose}
    >
      {/* 헤딩 줄. 활성 매칭이 있으면 우측에 시동 상태(read-only) + 시동 제어
          (toggle) 를 작은 패널로 띄운다 — 본문 grid 와 분리해 운영자가
          상시 보이는 위치에서 시동을 통제할 수 있도록. */}
      <div className="rider-detail-header">
        <h3>라이더 상세</h3>
        {row.activeBikeId ? (
          <div className="rider-detail-ignition">
            <DetailField label="시동 상태" value={ignitionLabel(row.ignitionStatus)} />
            <div className="detail-field">
              <span className="detail-field-label">시동 제어</span>
              <button
                type="button"
                className={`toggle-switch${effectiveIgnitionBlocked ? " is-on" : ""}`}
                role="switch"
                aria-checked={effectiveIgnitionBlocked}
                aria-label="시동 제어 토글"
                disabled={ignitionPending}
                onClick={handleIgnitionToggle}
              >
                <span className="toggle-switch-thumb" aria-hidden="true" />
                {/* 라벨은 항상 "방지" 로 고정. 켜짐/꺼짐은 `.is-on` 클래스의
                    mint vs 회색 배경 으로 전달 — "방지가 켜져 있다" 라는 한
                    개념을 두 단어로 분기시키지 않고 색깔만 보면 알 수 있게.
                    스크린리더는 aria-checked 로 상태를 받는다. */}
                <span className="toggle-switch-text">방지</span>
              </button>
            </div>
          </div>
        ) : null}
      </div>
      {mode === "view" ? (
        <div className="detail-row-grid">
          <DetailField label="이름" value={rider.name} />
          <DetailField label="연락처" value={rider.phone} />
          <DetailField label="교육" value={row.educationLabel} />
          <DetailField label="차량 번호" value={row.plate ?? "—"} />
          <DetailField label="구독/렌탈" value={row.category ?? "—"} />
          <DetailField label="형태" value={row.returnType ?? "—"} />
          <DetailField label="기간" value={row.durationLabel ?? "—"} />
          <DetailField label="보험" value={currentInsuranceLabel} />
          <div className="overview-create-dialog-actions">
            {row.activeContractId ? (
              <TerminateContractButton
                contractId={row.activeContractId}
                contractLabel={`${rider.name}${row.plate ? ` / ${row.plate}` : ""}`}
                onConfirmed={handleClose}
              />
            ) : null}
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
          {/* server action 이 보험 변경 여부 판단 시 참고하는 현재 상태. */}
          <input
            type="hidden"
            name="currentInsuranceId"
            value={row.currentInsuranceId ?? ""}
          />
          <input
            type="hidden"
            name="currentInsuranceItemId"
            value={row.currentInsuranceItemId ?? ""}
          />
          <label>
            이름
            <input name="name" defaultValue={rider.name} maxLength={100} required />
          </label>
          <label>
            연락처
            <PhoneNumberInput name="phoneNumber" defaultValue={rider.phone} maxLength={20} required />
          </label>
          <label>
            보험
            <select
              name="insuranceItemId"
              defaultValue={row.currentInsuranceItemId ?? ""}
              disabled={insuranceOptions.length === 0}
            >
              <option value="">없음</option>
              {insuranceOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
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
    </dialog>
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

function ignitionLabel(status: string | null): string {
  if (status === "ON") return "시동";
  if (status === "OFF") return "꺼짐";
  return "—";
}
