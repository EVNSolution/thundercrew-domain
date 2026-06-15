"use client";

import { useCallback, useRef, useState } from "react";

import { createMaintenanceItemAction, updateMaintenanceItemAction } from "@/app/actions";
import { useScrollLockedDialog } from "@/lib/hooks/use-scroll-locked-dialog";
import type {
  ServiceOpsMaintenanceCategory,
  ServiceOpsMaintenanceItem
} from "@/lib/services/service-ops-api";

/**
 * 정비 카탈로그 행의 상세 + 수정 다이얼로그. 다른 detail dialog 들과 같은
 * modal 패턴 (centered, scroll-locked).
 *
 * 분류는 4개 카테고리 체크박스로 선택. 생성 모드에선 해당 섹션의 카테고리가
 * 기본 체크, 수정 모드에선 기존 categories 배열로 체크 상태를 초기화.
 */
export function MaintenanceItemDetailDialog({
  row,
  createCategory = null,
  onClose
}: {
  row: ServiceOpsMaintenanceItem | null;
  createCategory?: ServiceOpsMaintenanceCategory | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const isCreate = row === null && createCategory !== null;
  // 생성 모드는 바로 폼, 기존 항목은 보기 → 수정 토글.
  const [mode, setMode] = useState<"view" | "edit">(isCreate ? "edit" : "view");
  useScrollLockedDialog(dialogRef, row !== null || createCategory !== null);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!row && !isCreate) return null;

  const formAction = isCreate ? createMaintenanceItemAction : updateMaintenanceItemAction.bind(null, row!.id);

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
          <DetailField
            label="분류"
            value={row!.categories.map(categoryLabel).join(", ") || "—"}
          />
          <DetailField
            label="교환주기 (km)"
            value={row!.cycleKm !== null ? `${row!.cycleKm.toLocaleString()} km` : "—"}
          />
          <DetailField
            label="교환주기 (개월)"
            value={row!.cycleMonths !== null ? `${row!.cycleMonths}개월` : "—"}
          />
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
          <fieldset className="maintenance-category-fieldset">
            <legend>분류</legend>
            {CATEGORY_OPTIONS.map(({ value, label }) => (
              <label key={value} className="maintenance-category-checkbox-label">
                <input
                  type="checkbox"
                  name="categories"
                  value={value}
                  defaultChecked={
                    isCreate
                      ? value === createCategory
                      : (row?.categories ?? []).includes(value)
                  }
                />
                {" "}{label}
              </label>
            ))}
          </fieldset>
          <label>
            교환주기 (km)
            <input
              name="cycleKm"
              type="number"
              min={0}
              defaultValue={row?.cycleKm ?? ""}
              placeholder="비우면 km 기준 없음"
            />
          </label>
          <label>
            교환주기 (개월)
            <input
              name="cycleMonths"
              type="number"
              min={0}
              defaultValue={row?.cycleMonths ?? ""}
              placeholder="비우면 개월 기준 없음"
            />
          </label>
          <div className="overview-create-dialog-actions">
            <button
              type="button"
              className="button-neutral"
              onClick={isCreate ? handleClose : () => setMode("view")}
            >
              취소
            </button>
            <button type="submit" className="button-primary">
              {isCreate ? "추가" : "저장"}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}

const CATEGORY_OPTIONS: { value: ServiceOpsMaintenanceCategory; label: string }[] = [
  { value: "TWO_WHEEL_ELECTRIC", label: "2륜 전기" },
  { value: "TWO_WHEEL_ICE", label: "2륜 내연" },
  { value: "FOUR_WHEEL_ELECTRIC", label: "4륜 전기" },
  { value: "FOUR_WHEEL_ICE", label: "4륜 내연" }
];

function categoryLabel(c: ServiceOpsMaintenanceCategory): string {
  switch (c) {
    case "TWO_WHEEL_ELECTRIC": return "2륜 전기";
    case "TWO_WHEEL_ICE": return "2륜 내연";
    case "FOUR_WHEEL_ELECTRIC": return "4륜 전기";
    case "FOUR_WHEEL_ICE": return "4륜 내연";
  }
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-field">
      <span className="detail-field-label">{label}</span>
      <span className="detail-field-value">{value}</span>
    </div>
  );
}
