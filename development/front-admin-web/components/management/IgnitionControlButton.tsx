"use client";

import { useState, useTransition } from "react";

import { setVehicleIgnitionBlockFromOverviewAction } from "@/app/overview/actions";

/**
 * 라이더 테이블의 "시동 제어" 컬럼에서 한 줄에 박히는 인라인 토글. 라이더에
 * 매칭된 차량의 시동 방지(ignition_blocked) 운영자 의도를 켜고 끄는 작은
 * 스위치. RiderDetailDialog 의 같은 컨트롤과 시각·동작 일치 — 거기서는 더
 * 큰 크기로, 여기서는 행 안에 들어가는 작은 크기로만 차이.
 *
 * 매칭 없는 라이더(activeBikeId = null) 는 호출자가 이 컴포넌트를 마운트
 * 안 하도록 함.
 *
 * Optimistic update — 누른 즉시 색이 바뀐다. 페이지 revalidate 후 props 가
 * 새로 내려오면 자연스럽게 보정.
 */
export function IgnitionControlButton({
  bikeId,
  initialBlocked
}: {
  bikeId: string;
  initialBlocked: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const blocked = optimistic ?? initialBlocked;

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    // 라이더 테이블의 행은 클릭 시 상세 다이얼로그를 여는 핸들러가 붙어
    // 있으므로 시동 토글의 클릭이 행 클릭으로 전파되지 않도록 끊는다.
    event.stopPropagation();
    if (pending) return;
    const next = !blocked;
    setOptimistic(next);
    const fd = new FormData();
    fd.append("blocked", next ? "true" : "false");
    startTransition(() => {
      void setVehicleIgnitionBlockFromOverviewAction(bikeId, fd);
    });
  };

  return (
    <button
      type="button"
      className={`toggle-switch toggle-switch--compact${blocked ? " is-on" : ""}`}
      role="switch"
      aria-checked={blocked}
      aria-label="시동 제어 토글"
      disabled={pending}
      onClick={handleClick}
    >
      <span className="toggle-switch-thumb" aria-hidden="true" />
      <span className="toggle-switch-text">방지</span>
    </button>
  );
}
