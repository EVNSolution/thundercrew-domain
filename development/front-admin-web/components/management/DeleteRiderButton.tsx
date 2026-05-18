"use client";

import { deleteRiderFromOverviewAction } from "@/app/overview/actions";

/**
 * Per-row delete button for the /overview riders tab. Wraps the server
 * action in a small client form so we can intercept submit and ask the
 * operator to confirm before the row goes away. Backend soft-deletes
 * the rider (sets deleted_at), the loader filters those out, so the
 * row disappears from the next render after revalidatePath fires.
 */
export function DeleteRiderButton({ riderId, riderName }: { riderId: string; riderName: string }) {
  const boundAction = deleteRiderFromOverviewAction.bind(null, riderId);
  return (
    <form
      action={boundAction}
      onSubmit={(event) => {
        if (!window.confirm(`라이더 "${riderName}"을 삭제하시겠습니까?`)) {
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
