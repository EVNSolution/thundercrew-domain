"use client";

import { useCallback, useRef, useState, useTransition } from "react";

import { terminateMatchingAction } from "@/app/management/matching/actions";
import { useScrollLockedDialog } from "@/lib/hooks/use-scroll-locked-dialog";
import type {
  FrontendRider,
  FrontendVehicle,
  ServiceOpsRiderBikeContract
} from "@/lib/services/service-ops-api";

/**
 * 매칭 상세 팝업 — 차량·라이더/클리너 상세와 같은 modal 패턴. 행 클릭으로
 * 열리고, 매칭이 담고 있는 차량/라이더 요약 + 계약 고유 정보(형태/기간)를
 * 보여준다. 관리 동작은 계약 종료 (계약은 수정 대신 종료 후 재생성이 도메인
 * 규칙 — 이력이 남아야 하므로).
 */
export function MatchingDetailDialog({
  contract,
  vehicle,
  rider,
  onClose,
  onChanged
}: {
  contract: ServiceOpsRiderBikeContract | null;
  vehicle: FrontendVehicle | null;
  rider: FrontendRider | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const open = contract !== null;
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useScrollLockedDialog(dialogRef, open);

  const handleClose = useCallback(() => {
    setMessage(null);
    onClose();
  }, [onClose]);

  if (!contract) return null;

  const handleTerminate = () => {
    if (!window.confirm("계약을 종료하시겠습니까?")) return;
    setMessage(null);
    startTransition(async () => {
      const res = await terminateMatchingAction(contract.id);
      if (res.ok) {
        onChanged();
        handleClose();
      } else {
        setMessage(res.message ?? "종료 실패");
      }
    });
  };

  return (
    <dialog
      ref={dialogRef}
      className="overview-create-dialog maintenance-dialog"
      onClose={handleClose}
      onCancel={handleClose}
    >
      <button
        type="button"
        className="overview-create-dialog-reset"
        aria-label="닫기"
        onClick={handleClose}
      >
        ×
      </button>
      <h3>매칭 상세</h3>
      <div className="detail-row-grid">
        <DetailField label="차량번호" value={contract.plateNumber ?? "—"} />
        <DetailField label="용도" value={purposeLabel(vehicle?.purpose)} />
        <DetailField label="라이더/클리너" value={contract.riderName ?? "—"} />
        <DetailField label="직무" value={roleLabel(rider?.role)} />
        <DetailField label="연락처" value={contract.riderPhoneNumber ?? "—"} />
        <DetailField label="팀" value={rider?.team || "—"} />
        <DetailField label="형태" value={shapeLabel(contract)} />
        <DetailField
          label="기간"
          value={`${contract.startAt.slice(0, 10)} ~ ${
            contract.endAt ? contract.endAt.slice(0, 10) : "무기한"
          }`}
        />
      </div>
      {message ? <p role="alert" style={{ color: "red" }}>{message}</p> : null}
      <div className="overview-create-dialog-actions">
        <button type="button" className="button-neutral" onClick={handleClose}>
          닫기
        </button>
        {!contract.terminatedAt ? (
          <button
            type="button"
            className="button-primary"
            disabled={isPending}
            onClick={handleTerminate}
          >
            {isPending ? "종료 중…" : "계약 종료"}
          </button>
        ) : null}
      </div>
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

function purposeLabel(value?: FrontendVehicle["purpose"] | null): string {
  if (value === "DELIVERY") return "배송용";
  if (value === "CLEANING") return "클린차량";
  return "—";
}

function roleLabel(role?: FrontendRider["role"] | null): string {
  if (role === "CLEANER") return "클리너";
  if (role === "RIDER") return "라이더";
  return "—";
}

function shapeLabel(contract: ServiceOpsRiderBikeContract): string {
  if (contract.engagementType === "DIRECT") return "클리닝 · 직영";
  if (contract.engagementType === "PARTNER") return "클리닝 · 협력";
  const category =
    contract.category === "SUBSCRIPTION" ? "구독" : contract.category === "RENTAL" ? "렌탈" : "기타";
  const returnType =
    contract.returnType === "TAKEOVER" ? "인수형" : contract.returnType === "RETURN" ? "반납형" : "—";
  return `${category} · ${returnType}`;
}
