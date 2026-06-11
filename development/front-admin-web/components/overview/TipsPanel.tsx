"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

import { deleteTipAction, listTipsAction } from "@/app/tips/actions";
import type { ServiceOpsTip } from "@/lib/services/service-ops-api";

import { CreateTipDialog } from "./CreateTipDialog";
import { EditTipDialog } from "./EditTipDialog";

interface TipsPanelProps {
  selectedTipId: string | null;
  onTipSelect: (id: string | null) => void;
}

/**
 * 운영 팁 목록 패널. 주소/내용/등록일 + 액션(편집·삭제) 표. 행 클릭으로 선택을
 * 토글하고 `selectedTipId` 행을 하이라이트한다 (지도 핀과 양방향 연동은 Task 8).
 *
 * 표/버튼/삭제 UX 는 기존 관리 패널(VehiclesPanel) 패턴을 그대로 따른다:
 *   - `.table-card` + `.table` + `.table-row-clickable`
 *   - 삭제는 `.delete-icon-button` + `window.confirm`
 *   - 실패 배너는 `.panel-error-banner`
 *
 * 데이터는 `listTipsAction()` 으로 로드하고 생성/편집/삭제 후 다시 로드한다.
 * 변경 server action 은 throw 가 아니라 `{ ok }` 판별 결과를 돌려주므로
 * `result.ok` 로 분기해 실패 사유를 표면화한다.
 */
export function TipsPanel({ selectedTipId, onTipSelect }: TipsPanelProps) {
  const [tips, setTips] = useState<ServiceOpsTip[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ServiceOpsTip | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const reload = useCallback(() => {
    startTransition(async () => {
      const data = await listTipsAction();
      setTips(data);
    });
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleDelete = (tip: ServiceOpsTip) => {
    if (!window.confirm(`"${tip.address}" 팁을 삭제하시겠습니까?`)) return;
    setDeleteError(null);
    startTransition(async () => {
      const result = await deleteTipAction(tip.id);
      if (!result.ok) {
        setDeleteError(result.error);
        return;
      }
      if (selectedTipId === tip.id) onTipSelect(null);
      const data = await listTipsAction();
      setTips(data);
    });
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("ko-KR", {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
    });

  return (
    <div className="tips-panel">
      <div className="tips-panel-header">
        <span className="tips-panel-title">팁 목록 ({tips.length})</span>
        <button type="button" className="button-primary tips-panel-add" onClick={() => setCreateOpen(true)}>
          + 팁 추가
        </button>
      </div>

      {deleteError ? (
        <p role="alert" className="panel-error-banner tips-panel-error">
          {deleteError}
        </p>
      ) : null}

      <div className="table-card">
        <table className="table tips-table">
          <thead>
            <tr>
              <th>주소</th>
              <th>내용</th>
              <th>등록일</th>
              <th aria-label="액션" />
            </tr>
          </thead>
          <tbody>
            {tips.length === 0 ? (
              <tr>
                <td colSpan={4} className="table-empty-cell">
                  {isPending ? "로딩 중…" : "등록된 팁이 없습니다"}
                </td>
              </tr>
            ) : (
              tips.map((tip) => (
                <tr
                  key={tip.id}
                  className={`table-row-clickable${tip.id === selectedTipId ? " is-selected" : ""}`}
                  onClick={() => onTipSelect(tip.id === selectedTipId ? null : tip.id)}
                >
                  <td>{tip.address}</td>
                  <td className="tips-table-content-cell">{tip.content}</td>
                  <td>{formatDate(tip.createdAt)}</td>
                  <td className="tips-table-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="button-neutral tips-table-edit"
                      onClick={() => setEditTarget(tip)}
                    >
                      편집
                    </button>
                    <button
                      type="button"
                      className="delete-icon-button"
                      onClick={() => handleDelete(tip)}
                      disabled={isPending}
                      title={`"${tip.address}" 팁 삭제`}
                      aria-label={`"${tip.address}" 팁 삭제`}
                    >
                      <TrashIcon />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {createOpen ? (
        <CreateTipDialog
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false);
            reload();
          }}
        />
      ) : null}
      {editTarget ? (
        <EditTipDialog
          key={editTarget.id}
          tip={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            setEditTarget(null);
            reload();
          }}
        />
      ) : null}
    </div>
  );
}

// 휴지통 아이콘 — DeleteVehicleButton 과 동일한 line-art glyph 로 액션 열의
// 시각 톤을 통일.
function TrashIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M5 6l1 14a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-14" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}
