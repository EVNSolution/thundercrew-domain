"use client";

import { useCallback, useRef, useState } from "react";

import { createMaintenanceItemAction, updateMaintenanceItemAction } from "@/app/actions";
import { useScrollLockedDialog } from "@/lib/hooks/use-scroll-locked-dialog";
import type {
  ServiceOpsMaintenanceAppliesTo,
  ServiceOpsMaintenanceItem
} from "@/lib/services/service-ops-api";

/**
 * 정비 카탈로그 행의 상세 + 수정 다이얼로그. 다른 detail dialog 들과 같은
 * modal 패턴 (centered, scroll-locked).
 *
 * 그룹 부모 (`구동계3종`) 도 같은 폼으로 편집 — cycle 세 필드를 모두 비우면
 * 헤더-only 행이 된다. parent_item_id select 는 같은 applies_to 내의 다른 행
 * 들을 옵션으로 노출 (자기 자신은 제외).
 */
export function MaintenanceItemDetailDialog({
  row,
  createEngine = null,
  parentOptions,
  onClose
}: {
  row: ServiceOpsMaintenanceItem | null;
  createEngine?: ServiceOpsMaintenanceAppliesTo | null;
  parentOptions: ReadonlyArray<ServiceOpsMaintenanceItem>;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const isCreate = row === null && createEngine !== null;
  // 생성 모드는 바로 폼, 기존 항목은 보기 → 수정 토글.
  const [mode, setMode] = useState<"view" | "edit">(isCreate ? "edit" : "view");
  useScrollLockedDialog(dialogRef, row !== null || createEngine !== null);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!row && !isCreate) return null;

  const formAction = isCreate ? createMaintenanceItemAction : updateMaintenanceItemAction.bind(null, row!.id);
  // 그룹 부모 후보: 최상위 항목만(자기 자신 제외). 생성 모드는 제외할 자기 자신이 없다.
  const eligibleParents = parentOptions.filter(
    (option) => option.parentItemId === null && (row ? option.id !== row.id : true)
  );

  return (
    <dialog
      ref={dialogRef}
      className="overview-create-dialog"
      onClose={onClose}
      onCancel={onClose}
    >
      <h3>{isCreate ? "정비 품목 추가" : "정비 품목 상세"}</h3>
      {!isCreate && mode === "view" ? (
        <div className="detail-row-grid">
          <DetailField label="품목" value={row!.name} />
          <DetailField label="적용" value={appliesToLabel(row!.appliesTo)} />
          <DetailField label="휠타입" value={wheelAppliesLabel(row!.appliesToWheel)} />
          <DetailField label="교환주기 (km)" value={row!.cycleKm !== null ? `${row!.cycleKm.toLocaleString()} km` : "—"} />
          <DetailField label="교환주기 (개월)" value={row!.cycleMonths !== null ? `${row!.cycleMonths}개월` : "—"} />
          <DetailField label="라벨" value={row!.cycleLabel ?? "—"} />
          <DetailField label="그룹 부모" value={parentLabel(row!, parentOptions)} />
          <DetailField label="활성" value={row!.enabled ? "ON" : "OFF"} />
          <DetailField label="정렬" value={String(row!.displayOrder)} />
          <div className="overview-create-dialog-actions">
            <button type="button" className="button-neutral" onClick={handleClose}>닫기</button>
            <button type="button" className="button-primary" onClick={() => setMode("edit")}>수정</button>
          </div>
        </div>
      ) : (
        <form action={formAction}>
          <label>
            품목
            <input name="name" defaultValue={row?.name ?? ""} maxLength={100} required />
          </label>
          <label>
            적용
            <select name="appliesTo" defaultValue={row?.appliesTo ?? createEngine ?? "BOTH"}>
              <option value="ELECTRIC">전기</option>
              <option value="ICE">내연</option>
              <option value="BOTH">공통</option>
            </select>
          </label>
          <label>
            휠타입
            <select name="appliesToWheel" defaultValue={row?.appliesToWheel ?? "BOTH"}>
              <option value="TWO_WHEEL">2륜</option>
              <option value="FOUR_WHEEL">4륜</option>
              <option value="BOTH">공통</option>
            </select>
          </label>
          <label>
            교환주기 (km)
            <input name="cycleKm" type="number" min={0} defaultValue={row?.cycleKm ?? ""} placeholder="비우면 km 기준 없음" />
          </label>
          <label>
            교환주기 (개월)
            <input name="cycleMonths" type="number" min={0} defaultValue={row?.cycleMonths ?? ""} placeholder="비우면 개월 기준 없음" />
          </label>
          <label>
            라벨 (자유 텍스트)
            <input name="cycleLabel" defaultValue={row?.cycleLabel ?? ""} maxLength={50} placeholder="예: 6~7개월 / 12개월 이상" />
          </label>
          <label>
            그룹 부모
            <select name="parentItemId" defaultValue={row?.parentItemId ?? ""}>
              <option value="">없음</option>
              {eligibleParents.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name} ({appliesToLabel(option.appliesTo)})
                </option>
              ))}
            </select>
          </label>
          <label>
            정렬
            <input name="displayOrder" type="number" min={0} defaultValue={row?.displayOrder ?? ""} />
          </label>
          {!isCreate ? (
            <label>
              활성
              <select name="enabled" defaultValue={row!.enabled ? "true" : "false"}>
                <option value="true">ON</option>
                <option value="false">OFF</option>
              </select>
            </label>
          ) : null}
          <div className="overview-create-dialog-actions">
            <button type="button" className="button-neutral" onClick={isCreate ? handleClose : () => setMode("view")}>취소</button>
            <button type="submit" className="button-primary">{isCreate ? "추가" : "저장"}</button>
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

function appliesToLabel(value: ServiceOpsMaintenanceItem["appliesTo"]): string {
  if (value === "ELECTRIC") return "전기";
  if (value === "ICE") return "내연";
  return "공통";
}

function wheelAppliesLabel(value: ServiceOpsMaintenanceItem["appliesToWheel"]): string {
  if (value === "TWO_WHEEL") return "2륜";
  if (value === "FOUR_WHEEL") return "4륜";
  return "공통";
}

function parentLabel(
  row: ServiceOpsMaintenanceItem,
  options: ReadonlyArray<ServiceOpsMaintenanceItem>
): string {
  if (!row.parentItemId) return "—";
  const parent = options.find((option) => option.id === row.parentItemId);
  return parent?.name ?? "—";
}
