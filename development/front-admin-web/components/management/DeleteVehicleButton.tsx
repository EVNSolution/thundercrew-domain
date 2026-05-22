"use client";

import { deleteVehicleFromOverviewAction } from "@/app/actions";

/**
 * Per-row delete control for the root page vehicles tab. Renders as a
 * trash-icon button so the column on the far left stays narrow and visual
 * weight is similar to other inline-action icons. Wraps the server action
 * in a small client form so we can intercept submit and confirm before
 * deletion. Backend soft-deletes the bike (sets deleted_at) and the
 * loader filters those out, so the row disappears from the next render
 * after revalidatePath fires.
 *
 * The button is wrapped in a stopPropagation handler so clicking it does
 * not also open the row's detail dialog.
 */
export function DeleteVehicleButton({ vehicleId, plateNumber }: { vehicleId: string; plateNumber: string }) {
  const boundAction = deleteVehicleFromOverviewAction.bind(null, vehicleId);
  return (
    <form
      action={boundAction}
      onClick={(event) => event.stopPropagation()}
      onSubmit={(event) => {
        if (!window.confirm(`차량 "${plateNumber}"을(를) 삭제하시겠습니까?`)) {
          event.preventDefault();
        }
      }}
      style={{ display: "inline-flex" }}
    >
      <button
        className="delete-icon-button"
        type="submit"
        title={`차량 "${plateNumber}" 삭제`}
        aria-label={`차량 "${plateNumber}" 삭제`}
      >
        <TrashIcon />
      </button>
    </form>
  );
}

// Trash can outline icon — light line-art matching the marker/logout
// glyphs so the table action column reads as one consistent set.
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
