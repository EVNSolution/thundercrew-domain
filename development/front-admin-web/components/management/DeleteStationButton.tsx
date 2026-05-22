"use client";

import { deleteStationFromOverviewAction } from "@/app/actions";

/**
 * Per-row delete button for the root page stations tab. Wraps the server
 * action in a small client form so we can intercept submit and ask the
 * operator to confirm before the row goes away. Backend soft-deletes the
 * battery station (sets deleted_at), the loader filters those out, so the
 * row disappears from the next render after revalidatePath fires.
 */
export function DeleteStationButton({ stationId, stationLabel }: { stationId: string; stationLabel: string }) {
  const boundAction = deleteStationFromOverviewAction.bind(null, stationId);
  return (
    <form
      action={boundAction}
      onSubmit={(event) => {
        if (!window.confirm(`스테이션 "${stationLabel}"을(를) 삭제하시겠습니까?`)) {
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
