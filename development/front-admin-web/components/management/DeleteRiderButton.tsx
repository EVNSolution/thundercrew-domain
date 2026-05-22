"use client";

import { deleteRiderFromOverviewAction } from "@/app/actions";

/**
 * Per-row delete control for the root page riders tab. See
 * `DeleteVehicleButton` for the shared design (icon button + confirm +
 * stopPropagation). Backend soft-deletes the rider.
 */
export function DeleteRiderButton({ riderId, riderName }: { riderId: string; riderName: string }) {
  const boundAction = deleteRiderFromOverviewAction.bind(null, riderId);
  return (
    <form
      action={boundAction}
      onClick={(event) => event.stopPropagation()}
      onSubmit={(event) => {
        if (!window.confirm(`라이더 "${riderName}"을(를) 삭제하시겠습니까?`)) {
          event.preventDefault();
        }
      }}
      style={{ display: "inline-flex" }}
    >
      <button
        className="delete-icon-button"
        type="submit"
        title={`라이더 "${riderName}" 삭제`}
        aria-label={`라이더 "${riderName}" 삭제`}
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
