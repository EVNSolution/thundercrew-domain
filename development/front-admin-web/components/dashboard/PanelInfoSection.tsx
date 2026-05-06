"use client";

import type { ReactNode } from "react";

export interface PanelInfoSectionRow {
  label: string;
  value: ReactNode;
}

export function PanelInfoSection({ rows }: { rows: PanelInfoSectionRow[] }) {
  return (
    <dl className="rm-panel-info-section">
      {rows.map((row) => (
        <div key={row.label} className="rm-panel-info-row">
          <dt className="rm-panel-info-row-label">{row.label}</dt>
          <dd className="rm-panel-info-row-value">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
