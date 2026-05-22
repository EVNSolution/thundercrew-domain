"use client";

import { useTransition } from "react";

import { deleteVehicleFromOverviewAction } from "@/app/actions";

/**
 * Per-row delete control for the root page vehicles tab. Renders as a
 * trash-icon button; backend soft-deletes the bike (sets deleted_at) and
 * the loader filters those out so the row disappears next render.
 *
 * 이전엔 `<form action={action} onSubmit={confirm}>` 패턴이었는데, React 19
 * server action 의 form 제출 경로가 native submit 이벤트를 우회하는 케이스가
 * 있어 `preventDefault()` 가 확실히 동작 안 할 때가 있었다. form 을 걷어내고
 * button onClick 안에서 직접 confirm → 통과 시 server action 호출. 이렇게
 * 하면 LogoutButton 의 confirm 과 동일하게 항상 발화한다. `useTransition`
 * 으로 pending 표시 + 중복 클릭 방지.
 */
export function DeleteVehicleButton({ vehicleId, plateNumber }: { vehicleId: string; plateNumber: string }) {
  const [pending, startTransition] = useTransition();

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    // 행 클릭으로 인한 상세 다이얼로그 오픈과 충돌 방지.
    event.stopPropagation();
    if (pending) return;
    if (!window.confirm(`차량 "${plateNumber}"을(를) 삭제하시겠습니까?`)) return;
    startTransition(() => {
      void deleteVehicleFromOverviewAction(vehicleId);
    });
  };

  return (
    <button
      type="button"
      className="delete-icon-button"
      onClick={handleClick}
      disabled={pending}
      title={`차량 "${plateNumber}" 삭제`}
      aria-label={`차량 "${plateNumber}" 삭제`}
    >
      <TrashIcon />
    </button>
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
