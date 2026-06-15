"use client";

import { useMemo, useState, type ReactNode } from "react";

import { DeleteMaintenanceItemButton } from "@/components/management/DeleteMaintenanceItemButton";
import { MaintenanceItemDetailDialog } from "@/components/management/MaintenanceItemDetailDialog";
import type { ServiceOpsMaintenanceItem, ServiceOpsMaintenanceWheelApplies } from "@/lib/services/service-ops-api";

/**
 * `/?tab=maintenance` 의 정비 카탈로그 편집 패널. 세 섹션(전기 전용 / 내연
 * 전용 / 공통) 으로 나눠서 사진의 두 표 + 공통 항목 묶음을 그대로 보여준다.
 *
 * 각 행: 품목 / 적용 / 교환주기 / 그룹 부모 / 활성 / 삭제. 행 클릭 시 상세
 * 다이얼로그가 열리고 거기서 수정 모드로 전환 — 다른 도메인 detail dialog
 * 와 같은 패턴.
 *
 * 그룹 부모(예: 구동계3종) 는 자식 위에 들여쓰기 없이, 자식은 한 단계 들여
 * 써서 시각적으로 묶음. 표시 정렬은 displayOrder 오름차순. 그룹 자체는
 * cycle 세 필드가 모두 비어 있는 행으로 표현 (display order 가 자식 바로
 * 앞으로 박혀 있어서 단순 정렬이 그대로 작동).
 */
export function MaintenancePanel({ items }: { items: ReadonlyArray<ServiceOpsMaintenanceItem> }) {
  const [activeRow, setActiveRow] = useState<ServiceOpsMaintenanceItem | null>(null);

  const sorted = useMemo(
    () => [...items].sort((a, b) => a.displayOrder - b.displayOrder),
    [items]
  );

  const electric = sorted.filter((item) => item.appliesTo === "ELECTRIC");
  const ice = sorted.filter((item) => item.appliesTo === "ICE");
  const both = sorted.filter((item) => item.appliesTo === "BOTH");

  return (
    <div className="maintenance-panel">
      <Section title="전기 전용" items={electric} parentOptions={sorted} onActivate={setActiveRow} />
      <Section title="내연 전용" items={ice} parentOptions={sorted} onActivate={setActiveRow} />
      <Section title="공통 (양쪽 적용)" items={both} parentOptions={sorted} onActivate={setActiveRow} />

      <MaintenanceItemDetailDialog
        key={activeRow?.id ?? "none"}
        row={activeRow}
        parentOptions={sorted}
        onClose={() => setActiveRow(null)}
      />
    </div>
  );
}

function Section({
  title,
  items,
  parentOptions,
  onActivate
}: {
  title: string;
  items: ReadonlyArray<ServiceOpsMaintenanceItem>;
  parentOptions: ReadonlyArray<ServiceOpsMaintenanceItem>;
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
            <col style={{ width: "140px" }} />
            <col style={{ width: "64px" }} />
            <col style={{ width: "120px" }} />
            <col style={{ width: "72px" }} />
          </colgroup>
          <thead>
            <tr>
              <th aria-label="삭제" />
              <th>품목</th>
              <th>교환주기</th>
              <th>휠</th>
              <th>그룹 부모</th>
              <th>활성</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="table-empty-cell">
                  데이터 없음
                </td>
              </tr>
            ) : null}
            {items.map((item) => {
              const parent = item.parentItemId
                ? parentOptions.find((option) => option.id === item.parentItemId) ?? null
                : null;
              return (
                <tr
                  key={item.id}
                  className="table-row-clickable"
                  onClick={() => onActivate(item)}
                >
                  <td onClick={(event) => event.stopPropagation()}>
                    <DeleteMaintenanceItemButton itemId={item.id} itemName={item.name} />
                  </td>
                  <td>
                    {item.parentItemId ? <span className="maintenance-panel-indent">└ </span> : null}
                    {item.name}
                  </td>
                  <td>{renderCycle(item)}</td>
                  <td><span className="muted">{wheelLabel(item.appliesToWheel)}</span></td>
                  <td>{parent ? parent.name : <span className="muted">—</span>}</td>
                  <td>{item.enabled ? "ON" : <span className="muted">OFF</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function renderCycle(item: ServiceOpsMaintenanceItem): ReactNode {
  if (item.cycleLabel) return item.cycleLabel;
  if (item.cycleKm !== null && item.cycleKm > 0) return `${item.cycleKm.toLocaleString()} km`;
  if (item.cycleMonths !== null && item.cycleMonths > 0) return `${item.cycleMonths}개월`;
  // 그룹 부모: cycle 세 값 모두 비어 있는 헤더 행.
  return <span className="muted">— (그룹)</span>;
}

function wheelLabel(w: ServiceOpsMaintenanceWheelApplies): string {
  if (w === "TWO_WHEEL") return "2륜";
  if (w === "FOUR_WHEEL") return "4륜";
  return "공통";
}
