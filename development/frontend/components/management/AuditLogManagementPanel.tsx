"use client";

import { useEffect, useState } from "react";

import { listAuditLogsAction } from "@/app/management/logs/actions";
import type { ServiceOpsAuditLog } from "@/lib/services/service-ops-api";

const ENTITY_TYPE_CHIPS: { label: string; value: string | null }[] = [
  { label: "전체", value: null },
  { label: "차량", value: "BIKE" },
  { label: "라이더", value: "RIDER" },
  { label: "매칭", value: "CONTRACT" },
  { label: "배차", value: "DISPATCH_ORDER" },
  { label: "운영상태", value: "BIKE_OPERATION_STATUS" },
  { label: "정비", value: "MAINTENANCE" },
  { label: "보험", value: "RIDER_INSURANCE" }
];

const ENTITY_TYPE_LABEL: Record<string, string> = {
  BIKE: "차량",
  RIDER: "라이더",
  CONTRACT: "매칭",
  DISPATCH_ORDER: "배차",
  BIKE_OPERATION_STATUS: "운영상태",
  MAINTENANCE: "정비",
  RIDER_INSURANCE: "보험"
};

const FIELD_LABEL: Record<string, string> = {
  __created__: "생성",
  __updated__: "수정",
  __deleted__: "삭제",
  __terminated__: "종료"
};

function entityTypeLabel(value: string): string {
  return ENTITY_TYPE_LABEL[value] ?? value;
}

function fieldLabel(value: string): string {
  return FIELD_LABEL[value] ?? value;
}

function nullish(value: string | null | undefined): string {
  return value ?? "—";
}

export function AuditLogManagementPanel() {
  const [logs, setLogs] = useState<ServiceOpsAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEntityType, setSelectedEntityType] = useState<string | null>(null);
  const [loadKey, setLoadKey] = useState(0);

  useEffect(() => {
    let active = true;
    listAuditLogsAction(selectedEntityType ?? undefined)
      .then(items => {
        if (active) {
          setLogs(items);
          setError(null);
          setLoading(false);
        }
      })
      .catch(err => {
        if (active) {
          setError(err instanceof Error ? err.message : "작업 로그 조회 실패");
          setLoading(false);
        }
      });
    return () => { active = false; };
  }, [loadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  function selectEntityType(value: string | null) {
    setLoading(true);
    setError(null);
    setSelectedEntityType(value);
    setLoadKey(k => k + 1);
  }

  return (
    <div className="management-panel">
      <div className="mgmt-panel-header">
        <div className="mgmt-panel-header-left">
          <span className="mgmt-panel-title">작업 로그</span>
          <span className="mgmt-panel-count">{loading ? "…" : logs.length}</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {ENTITY_TYPE_CHIPS.map(chip => (
          <button
            key={chip.value ?? "all"}
            type="button"
            className={chip.value === selectedEntityType ? "button-primary" : "button-secondary"}
            onClick={() => selectEntityType(chip.value)}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {error ? (
        <p role="alert" style={{ color: "red", marginBottom: 8 }}>
          {error}
        </p>
      ) : null}

      <div className="table-card">
        <table className="table" style={{ tableLayout: "fixed" }}>
          <thead>
            <tr>
              <th style={{ width: 160 }}>발생시각</th>
              <th style={{ width: 100 }}>작업자</th>
              <th style={{ width: 90 }}>대상</th>
              <th style={{ width: 100 }}>항목</th>
              <th>변경</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="table-empty-cell">불러오는 중…</td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="table-empty-cell">로그 없음</td>
              </tr>
            ) : (
              logs.map(log => (
                <tr key={log.id}>
                  <td>{new Date(log.occurredAt).toLocaleString("ko-KR")}</td>
                  <td>{nullish(log.actor)}</td>
                  <td>{entityTypeLabel(log.entityType)}</td>
                  <td>{fieldLabel(log.field)}</td>
                  <td>
                    <span className="muted">{nullish(log.oldValue)}</span>
                    {" → "}
                    {nullish(log.newValue)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
