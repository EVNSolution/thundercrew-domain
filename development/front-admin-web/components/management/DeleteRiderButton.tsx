"use client";

import { useTransition } from "react";

import { deleteRiderFromOverviewAction } from "@/app/actions";

/**
 * Per-row delete control for the root page riders tab. See
 * `DeleteVehicleButton` for the shared design (icon button + onClick
 * confirm + manual server action call). Backend soft-deletes the rider.
 */
export function DeleteRiderButton({ riderId, riderName }: { riderId: string; riderName: string }) {
  const [pending, startTransition] = useTransition();

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (pending) return;
    if (!window.confirm(`라이더 "${riderName}"을(를) 삭제하시겠습니까?`)) return;
    startTransition(() => {
      void deleteRiderFromOverviewAction(riderId);
    });
  };

  return (
    <button
      type="button"
      className="delete-icon-button"
      onClick={handleClick}
      disabled={pending}
      title={`라이더 "${riderName}" 삭제`}
      aria-label={`라이더 "${riderName}" 삭제`}
    >
      <TrashIcon />
    </button>
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
