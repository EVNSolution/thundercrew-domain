"use client";

import { useCallback, useRef, useState } from "react";

import { createMaintenanceItemAction, updateMaintenanceItemAction } from "@/app/actions";
import { useScrollLockedDialog } from "@/lib/hooks/use-scroll-locked-dialog";
import type {
  ServiceOpsMaintenanceCategory,
  ServiceOpsMaintenanceItem
} from "@/lib/services/service-ops-api";

/**
 * 정비 카탈로그 행의 상세 + 추가/수정 다이얼로그. 다른 detail dialog 들과 같은
 * modal 패턴 (centered, scroll-locked).
 *
 * 분류는 휠(2륜/4륜) × 엔진(전기/내연) 두 축 토글로 고른다. 안 고른 축은
 * "전체"로 간주되어 교차곱으로 전개된다 (예: 2륜만 → 2륜전기·2륜내연).
 * 저장 시 두 축을 hidden input 으로 내보내고 서버 액션이 분류로 합친다.
 */
export function MaintenanceItemDetailDialog({
  row,
  creating = false,
  onClose
}: {
  row: ServiceOpsMaintenanceItem | null;
  creating?: boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const isCreate = row === null && creating;
  const open = row !== null || creating;
  const [mode, setMode] = useState<"view" | "edit">(isCreate ? "edit" : "view");

  const initialAxes = axesFromCategories(row?.categories ?? []);
  const [wheels, setWheels] = useState<Set<WheelAxis>>(initialAxes.wheels);
  const [engines, setEngines] = useState<Set<EngineAxis>>(initialAxes.engines);

  useScrollLockedDialog(dialogRef, open);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!open) return null;

  const formAction = isCreate
    ? createMaintenanceItemAction
    : updateMaintenanceItemAction.bind(null, row!.id);

  const previewCategories = effectiveCategories(wheels, engines);
  const categoriesValid = previewCategories.length > 0;

  const toggleWheel = (w: WheelAxis) =>
    setWheels((prev) => toggle(prev, w));
  const toggleEngine = (e: EngineAxis) =>
    setEngines((prev) => toggle(prev, e));

  return (
    <dialog
      ref={dialogRef}
      className="overview-create-dialog maintenance-dialog"
      onClose={onClose}
      onCancel={onClose}
    >
      <button
        type="button"
        className="overview-create-dialog-reset"
        aria-label="닫기"
        onClick={handleClose}
      >
        ×
      </button>
      <h3>{isCreate ? "정비 품목 추가" : "정비 품목 상세"}</h3>

      {!isCreate && mode === "view" ? (
        <div className="detail-row-grid">
          <DetailField label="품목" value={row!.name} />
          <div className="detail-field">
            <span className="detail-field-label">분류</span>
            {row!.categories.length > 0 ? (
              <div className="maintenance-chip-row">
                {sortCategories(row!.categories).map((c) => (
                  <span key={c} className="maintenance-chip">{categoryLabel(c)}</span>
                ))}
              </div>
            ) : (
              <span className="detail-field-value">—</span>
            )}
          </div>
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

          <div className="maintenance-axis-group">
            <div className="maintenance-axis-head">
              <span className="maintenance-axis-title">분류</span>
              <span className="maintenance-axis-hint">휠 × 엔진 (각각 1개 이상 선택)</span>
            </div>
            <div className="maintenance-axis-row">
              <span className="maintenance-axis-row-label">휠</span>
              <div className="maintenance-axis-toggles">
                <AxisToggle label="2륜" active={wheels.has("TWO_WHEEL")} onClick={() => toggleWheel("TWO_WHEEL")} />
                <AxisToggle label="4륜" active={wheels.has("FOUR_WHEEL")} onClick={() => toggleWheel("FOUR_WHEEL")} />
              </div>
            </div>
            <div className="maintenance-axis-row">
              <span className="maintenance-axis-row-label">엔진</span>
              <div className="maintenance-axis-toggles">
                <AxisToggle label="전기" active={engines.has("ELECTRIC")} onClick={() => toggleEngine("ELECTRIC")} />
                <AxisToggle label="내연" active={engines.has("ICE")} onClick={() => toggleEngine("ICE")} />
              </div>
            </div>
            {categoriesValid ? (
              <p className="maintenance-axis-preview">
                → 적용: {sortCategories(previewCategories).map(categoryLabel).join(" · ")}
              </p>
            ) : (
              <p className="maintenance-axis-preview maintenance-axis-preview-empty">
                휠과 엔진을 각각 1개 이상 선택하세요
              </p>
            )}
            {[...wheels].map((w) => (
              <input key={`w-${w}`} type="hidden" name="wheels" value={w} />
            ))}
            {[...engines].map((e) => (
              <input key={`e-${e}`} type="hidden" name="engines" value={e} />
            ))}
          </div>

          <div className="overview-create-dialog-row">
            <label>
              교환주기 (km)
              <input
                name="cycleKm"
                type="number"
                min={0}
                defaultValue={row?.cycleKm ?? ""}
                placeholder="비우면 없음"
              />
            </label>
            <label>
              교환주기 (개월)
              <input
                name="cycleMonths"
                type="number"
                min={0}
                defaultValue={row?.cycleMonths ?? ""}
                placeholder="비우면 없음"
              />
            </label>
          </div>

          <div className="overview-create-dialog-actions">
            <button
              type="button"
              className="button-neutral"
              onClick={isCreate ? handleClose : () => setMode("view")}
            >
              취소
            </button>
            <button type="submit" className="button-primary" disabled={!categoriesValid}>
              {isCreate ? "추가" : "저장"}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}

type WheelAxis = "TWO_WHEEL" | "FOUR_WHEEL";
type EngineAxis = "ELECTRIC" | "ICE";

function AxisToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className="maintenance-axis-toggle"
      aria-pressed={active}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function toggle<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function axesFromCategories(cats: ReadonlyArray<ServiceOpsMaintenanceCategory>): {
  wheels: Set<WheelAxis>;
  engines: Set<EngineAxis>;
} {
  const wheels = new Set<WheelAxis>();
  const engines = new Set<EngineAxis>();
  for (const c of cats) {
    wheels.add(c.startsWith("TWO_WHEEL") ? "TWO_WHEEL" : "FOUR_WHEEL");
    engines.add(c.endsWith("ELECTRIC") ? "ELECTRIC" : "ICE");
  }
  return { wheels, engines };
}

// 선택된 휠 × 엔진 교차곱. 한 축이라도 비면 빈 배열(= 미선택, 제출 불가).
function effectiveCategories(
  wheels: Set<WheelAxis>,
  engines: Set<EngineAxis>
): ServiceOpsMaintenanceCategory[] {
  const out: ServiceOpsMaintenanceCategory[] = [];
  for (const ww of wheels) {
    for (const ee of engines) {
      out.push(`${ww}_${ee}` as ServiceOpsMaintenanceCategory);
    }
  }
  return out;
}

const CATEGORY_ORDER: ServiceOpsMaintenanceCategory[] = [
  "TWO_WHEEL_ELECTRIC",
  "TWO_WHEEL_ICE",
  "FOUR_WHEEL_ELECTRIC",
  "FOUR_WHEEL_ICE"
];

function sortCategories(
  cats: ReadonlyArray<ServiceOpsMaintenanceCategory>
): ServiceOpsMaintenanceCategory[] {
  return CATEGORY_ORDER.filter((c) => cats.includes(c));
}

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
