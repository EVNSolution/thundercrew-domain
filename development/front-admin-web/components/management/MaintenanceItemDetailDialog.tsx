"use client";

import { useCallback, useRef, useState } from "react";

import { updateMaintenanceItemAction } from "@/app/actions";
import { useScrollLockedDialog } from "@/lib/hooks/use-scroll-locked-dialog";
import type { ServiceOpsMaintenanceItem } from "@/lib/services/service-ops-api";

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
  parentOptions,
  onClose
}: {
  row: ServiceOpsMaintenanceItem | null;
  parentOptions: ReadonlyArray<ServiceOpsMaintenanceItem>;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<"view" | "edit">("view");
  useScrollLockedDialog(dialogRef, row !== null);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!row) return null;

  const boundUpdate = updateMaintenanceItemAction.bind(null, row.id);
  const eligibleParents = parentOptions.filter(
    (option) => option.id !== row.id && option.parentItemId === null
  );

  return (
    <dialog
      ref={dialogRef}
      className="overview-create-dialog"
      onClose={onClose}
      onCancel={onClose}
    >
      <h3>정비 품목 상세</h3>
      {mode === "view" ? (
        <div className="detail-row-grid">
          <DetailField label="품목" value={row.name} />
          <DetailField label="적용" value={appliesToLabel(row.appliesTo)} />
          <DetailField label="교환주기 (km)" value={row.cycleKm !== null ? `${row.cycleKm.toLocaleString()} km` : "—"} />
          <DetailField label="교환주기 (개월)" value={row.cycleMonths !== null ? `${row.cycleMonths}개월` : "—"} />
          <DetailField label="라벨" value={row.cycleLabel ?? "—"} />
          <DetailField label="그룹 부모" value={parentLabel(row, parentOptions)} />
          <DetailField label="활성" value={row.enabled ? "ON" : "OFF"} />
          <DetailField label="정렬" value={String(row.displayOrder)} />
          <div className="overview-create-dialog-actions">
            <button type="button" className="button-neutral" onClick={handleClose}>닫기</button>
            <button type="button" className="button-primary" onClick={() => setMode("edit")}>수정</button>
          </div>
        </div>
      ) : (
        <form action={boundUpdate}>
          <label>
            품목
            <input name="name" defaultValue={row.name} maxLength={100} required />
          </label>
          <label>
            적용
            <select name="appliesTo" defaultValue={row.appliesTo}>
              <option value="ELECTRIC">전기</option>
              <option value="ICE">내연</option>
              <option value="BOTH">공통</option>
            </select>
          </label>
          <label>
            교환주기 (km)
            <input name="cycleKm" type="number" min={0} defaultValue={row.cycleKm ?? ""} placeholder="비우면 km 기준 없음" />
          </label>
          <label>
            교환주기 (개월)
            <input name="cycleMonths" type="number" min={0} defaultValue={row.cycleMonths ?? ""} placeholder="비우면 개월 기준 없음" />
          </label>
          <label>
            라벨 (자유 텍스트)
            <input name="cycleLabel" defaultValue={row.cycleLabel ?? ""} maxLength={50} placeholder="예: 6~7개월 / 12개월 이상" />
          </label>
          <label>
            그룹 부모
            <select name="parentItemId" defaultValue={row.parentItemId ?? ""}>
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
            <input name="displayOrder" type="number" min={0} defaultValue={row.displayOrder} />
          </label>
          <label>
            활성
            <select name="enabled" defaultValue={row.enabled ? "true" : "false"}>
              <option value="true">ON</option>
              <option value="false">OFF</option>
            </select>
          </label>
          <div className="overview-create-dialog-actions">
            <button type="button" className="button-neutral" onClick={() => setMode("view")}>취소</button>
            <button type="submit" className="button-primary">저장</button>
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

function parentLabel(
  row: ServiceOpsMaintenanceItem,
  options: ReadonlyArray<ServiceOpsMaintenanceItem>
): string {
  if (!row.parentItemId) return "—";
  const parent = options.find((option) => option.id === row.parentItemId);
  return parent?.name ?? "—";
}
