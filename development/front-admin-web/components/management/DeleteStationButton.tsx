"use client";

import { deleteStationFromOverviewAction } from "@/app/actions";

/**
 * Per-row delete control for the root page stations tab. See
 * `DeleteVehicleButton` for the shared design (icon button + confirm +
 * stopPropagation). Backend soft-deletes the battery station.
 */
export function DeleteStationButton({ stationId, stationLabel }: { stationId: string; stationLabel: string }) {
  const boundAction = deleteStationFromOverviewAction.bind(null, stationId);
  return (
    <form
      action={boundAction}
      onClick={(event) => event.stopPropagation()}
      onSubmit={(event) => {
        if (!window.confirm(`스테이션 "${stationLabel}"을(를) 삭제하시겠습니까?`)) {
          event.preventDefault();
        }
      }}
      style={{ display: "inline-flex" }}
    >
      <button
        className="delete-icon-button"
        type="submit"
        title={`스테이션 "${stationLabel}" 삭제`}
        aria-label={`스테이션 "${stationLabel}" 삭제`}
      >
        <TrashIcon />
      </button>
    </form>
  );
}

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
