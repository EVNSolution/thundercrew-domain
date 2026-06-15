"use client";

import { useMemo, useState, type ReactNode } from "react";

import { DeleteMaintenanceItemButton } from "@/components/management/DeleteMaintenanceItemButton";
import { MaintenanceItemDetailDialog } from "@/components/management/MaintenanceItemDetailDialog";
import type {
  ServiceOpsMaintenanceCategory,
  ServiceOpsMaintenanceItem
} from "@/lib/services/service-ops-api";

/**
 * `/management/maintenance` 의 정비 카탈로그 편집 패널. 4개 카테고리 섹션
 * (2륜전기 / 2륜내연 / 4륜전기 / 4륜내연) 으로 나눠서 품목을 보여준다.
 *
 * 한 품목이 여러 카테고리에 속할 수 있으며, 해당 섹션 모두에 중복 표시된다.
 * 각 행 클릭 시 상세 다이얼로그가 열리고 거기서 수정 모드로 전환.
 */
export function MaintenancePanel({ items }: { items: ReadonlyArray<ServiceOpsMaintenanceItem> }) {
  const [activeRow, setActiveRow] = useState<ServiceOpsMaintenanceItem | null>(null);
  const [creating, setCreating] = useState(false);

  const sorted = useMemo(
    () => [...items].sort((a, b) => a.name.localeCompare(b.name, "ko")),
    [items]
  );

  const openRow = (item: ServiceOpsMaintenanceItem) => {
    setCreating(false);
    setActiveRow(item);
  };
  const openCreate = () => {
    setActiveRow(null);
    setCreating(true);
  };
  const close = () => {
    setActiveRow(null);
    setCreating(false);
  };

  const sections: { category: ServiceOpsMaintenanceCategory; title: string }[] = [
    { category: "TWO_WHEEL_ELECTRIC", title: "2륜 전기" },
    { category: "TWO_WHEEL_ICE", title: "2륜 내연" },
    { category: "FOUR_WHEEL_ELECTRIC", title: "4륜 전기" },
    { category: "FOUR_WHEEL_ICE", title: "4륜 내연" }
  ];

  return (
    <div className="maintenance-panel">
      <div className="maintenance-panel-toolbar">
        <button type="button" className="button-primary" onClick={openCreate}>
          + 항목 추가
        </button>
      </div>

      {sections.map(({ category, title }) => (
        <Section
          key={category}
          title={title}
          items={sorted.filter((i) => i.categories.includes(category))}
          onActivate={openRow}
        />
      ))}

      <MaintenanceItemDetailDialog
        key={activeRow?.id ?? (creating ? "create" : "none")}
        row={activeRow}
        creating={creating}
        onClose={close}
      />
    </div>
  );
}

function Section({
  title,
  items,
  onActivate
}: {
  title: string;
  items: ReadonlyArray<ServiceOpsMaintenanceItem>;
  onActivate: (item: ServiceOpsMaintenanceItem) => void;
}) {
  return (
    <section className="maintenance-panel-section">
      <h3 className="maintenance-panel-section-title">{title}</h3>
      <div className="table-card">
        <table className="table" style={{ tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "48px" }} />
            <col />
            <col style={{ width: "160px" }} />
          </colgroup>
          <thead>
            <tr>
              <th aria-label="삭제" />
              <th>품목</th>
              <th>교환주기</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={3} className="table-empty-cell">
                  데이터 없음
                </td>
              </tr>
            ) : null}
            {items.map((item) => (
              <tr
                key={item.id}
                className="table-row-clickable"
                onClick={() => onActivate(item)}
              >
                <td onClick={(event) => event.stopPropagation()}>
                  <DeleteMaintenanceItemButton itemId={item.id} itemName={item.name} />
                </td>
                <td>{item.name}</td>
                <td>{renderCycle(item)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function renderCycle(item: ServiceOpsMaintenanceItem): ReactNode {
  if (item.cycleKm !== null && item.cycleKm > 0) return `${item.cycleKm.toLocaleString()} km`;
  if (item.cycleMonths !== null && item.cycleMonths > 0) return `${item.cycleMonths}개월`;
  return <span className="muted">—</span>;
}
