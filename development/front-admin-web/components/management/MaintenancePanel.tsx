"use client";

import { useMemo, useState, type ReactNode } from "react";

import { DeleteMaintenanceItemButton } from "@/components/management/DeleteMaintenanceItemButton";
import { MaintenanceItemDetailDialog } from "@/components/management/MaintenanceItemDetailDialog";
import type {
  ServiceOpsMaintenanceCategory,
  ServiceOpsMaintenanceItem
} from "@/lib/services/service-ops-api";

/**
 * `/management/maintenance` 의 정비 카탈로그 편집 패널. 단일 테이블 + 상단
 * 휠(전체/2륜/4륜) · 엔진(전체/전기/내연) 필터. 항목은 categories(다중) 를
 * 보유하며, 선택한 휠 × 엔진 교차곱과 하나라도 겹치면 표시된다.
 *
 * 행 클릭 시 상세 다이얼로그, "+ 항목 추가" 로 생성 다이얼로그.
 */
type WheelFilter = "ALL" | "TWO_WHEEL" | "FOUR_WHEEL";
type EngineFilter = "ALL" | "ELECTRIC" | "ICE";

export function MaintenancePanel({ items }: { items: ReadonlyArray<ServiceOpsMaintenanceItem> }) {
  const [activeRow, setActiveRow] = useState<ServiceOpsMaintenanceItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [wheel, setWheel] = useState<WheelFilter>("ALL");
  const [engine, setEngine] = useState<EngineFilter>("ALL");

  const sorted = useMemo(
    () => [...items].sort((a, b) => a.name.localeCompare(b.name, "ko")),
    [items]
  );

  const visible = useMemo(() => {
    const wheels: ("TWO_WHEEL" | "FOUR_WHEEL")[] =
      wheel === "ALL" ? ["TWO_WHEEL", "FOUR_WHEEL"] : [wheel];
    const engines: ("ELECTRIC" | "ICE")[] =
      engine === "ALL" ? ["ELECTRIC", "ICE"] : [engine];
    const target = new Set<ServiceOpsMaintenanceCategory>();
    for (const w of wheels) for (const e of engines) {
      target.add(`${w}_${e}` as ServiceOpsMaintenanceCategory);
    }
    return sorted.filter((item) => item.categories.some((c) => target.has(c)));
  }, [sorted, wheel, engine]);

  const openRow = (item: ServiceOpsMaintenanceItem) => {
    setCreating(false);
    setActiveRow(item);
  };
  const close = () => {
    setActiveRow(null);
    setCreating(false);
  };

  return (
    <div className="maintenance-panel">
      <div className="maintenance-panel-toolbar">
        <div className="maintenance-filters">
          <div className="maintenance-filter-group">
            <span className="maintenance-filter-group-label">휠</span>
            <FilterChip label="전체" active={wheel === "ALL"} onClick={() => setWheel("ALL")} />
            <FilterChip label="2륜" active={wheel === "TWO_WHEEL"} onClick={() => setWheel("TWO_WHEEL")} />
            <FilterChip label="4륜" active={wheel === "FOUR_WHEEL"} onClick={() => setWheel("FOUR_WHEEL")} />
          </div>
          <div className="maintenance-filter-group">
            <span className="maintenance-filter-group-label">엔진</span>
            <FilterChip label="전체" active={engine === "ALL"} onClick={() => setEngine("ALL")} />
            <FilterChip label="전기" active={engine === "ELECTRIC"} onClick={() => setEngine("ELECTRIC")} />
            <FilterChip label="내연" active={engine === "ICE"} onClick={() => setEngine("ICE")} />
          </div>
        </div>
        <button type="button" className="button-primary" onClick={() => { setActiveRow(null); setCreating(true); }}>
          + 항목 추가
        </button>
      </div>

      <div className="table-card">
        <table className="table" style={{ tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "48px" }} />
            <col />
            <col style={{ width: "240px" }} />
            <col style={{ width: "140px" }} />
          </colgroup>
          <thead>
            <tr>
              <th aria-label="삭제" />
              <th>품목</th>
              <th>분류</th>
              <th>교환주기</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={4} className="table-empty-cell">해당 조건의 정비 항목 없음</td>
              </tr>
            ) : (
              visible.map((item) => (
                <tr key={item.id} className="table-row-clickable" onClick={() => openRow(item)}>
                  <td onClick={(event) => event.stopPropagation()}>
                    <DeleteMaintenanceItemButton itemId={item.id} itemName={item.name} />
                  </td>
                  <td>{item.name}</td>
                  <td>
                    <div className="maintenance-chip-row">
                      {sortCategories(item.categories).map((c) => (
                        <span key={c} className="maintenance-chip">{categoryLabel(c)}</span>
                      ))}
                    </div>
                  </td>
                  <td>{renderCycle(item)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <MaintenanceItemDetailDialog
        key={activeRow?.id ?? (creating ? "create" : "none")}
        row={activeRow}
        creating={creating}
        onClose={close}
      />
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" className="maintenance-filter-chip" aria-pressed={active} onClick={onClick}>
      {label}
    </button>
  );
}

function renderCycle(item: ServiceOpsMaintenanceItem): ReactNode {
  if (item.cycleKm !== null && item.cycleKm > 0) return `${item.cycleKm.toLocaleString()} km`;
  if (item.cycleMonths !== null && item.cycleMonths > 0) return `${item.cycleMonths}개월`;
  return <span className="muted">—</span>;
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
