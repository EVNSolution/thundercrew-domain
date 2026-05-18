"use client";

import { deleteVehicleFromOverviewAction } from "@/app/overview/actions";

/**
 * Per-row delete button for the /overview vehicles tab. Wraps the server
 * action in a small client form so we can intercept submit and ask the
 * operator to confirm before the row goes away. Backend soft-deletes the
 * bike (sets deleted_at), the loader filters those out, so the row
 * disappears from the next render after revalidatePath fires.
 */
export function DeleteVehicleButton({ vehicleId, plateNumber }: { vehicleId: string; plateNumber: string }) {
  const boundAction = deleteVehicleFromOverviewAction.bind(null, vehicleId);
  return (
    <form
      action={boundAction}
      onSubmit={(event) => {
        if (!window.confirm(`차량 "${plateNumber}"을(를) 삭제하시겠습니까?`)) {
          event.preventDefault();
        }
      }}
      style={{ display: "inline" }}
    >
      <button className="button-link" type="submit">
        삭제
      </button>
    </form>
  );
}
