"use client";

import { useState, useTransition } from "react";

import { setVehicleOperationStatusFromOverviewAction } from "@/app/actions";
import type { ServiceOpsBikeOperationStatus } from "@/lib/services/service-ops-api";

/**
 * 차량 탭 테이블의 "운영 상태" 컬럼에서 한 줄에 박히는 인라인 토글. READY ↔
 * IN_SERVICE 둘 사이만 오가는 단순한 boolean 같지만 운영 상태는 차량 별로
 * 별도 endpoint 가 있어 ignition block 토글과 짝을 이루도록 같은 스위치
 * 시각/동작을 채택했다.
 *
 * 켜짐(.is-on) = "운행"(IN_SERVICE), 꺼짐 = "대기"(READY). 라벨은 현재 값을
 * 그대로 출력해 운영자가 "지금 어느 상태인지" 한눈에 보이도록.
 *
 * 행 클릭은 차량 상세 다이얼로그를 띄우므로, 토글 클릭이 행 클릭으로
 * 전파되지 않도록 stopPropagation. optimistic 으로 즉시 시각 갱신 →
 * server revalidate 후 props 가 재유입되면 자연스럽게 정정.
 */
export function OperationStatusToggle({
  bikeId,
  initialStatus
}: {
  bikeId: string;
  initialStatus: ServiceOpsBikeOperationStatus;
}) {
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<ServiceOpsBikeOperationStatus | null>(null);
  const status = optimistic ?? initialStatus;
  const isOperating = status === "IN_SERVICE";

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (pending) return;
    const next: ServiceOpsBikeOperationStatus = isOperating ? "READY" : "IN_SERVICE";
    setOptimistic(next);
    const fd = new FormData();
    fd.append("operationStatus", next);
    startTransition(() => {
      void setVehicleOperationStatusFromOverviewAction(bikeId, fd);
    });
  };

  return (
    <button
      type="button"
      className={`toggle-switch toggle-switch--compact${isOperating ? " is-on" : ""}`}
      role="switch"
      aria-checked={isOperating}
      aria-label="운영 상태 토글"
      disabled={pending}
      onClick={handleClick}
    >
      <span className="toggle-switch-thumb" aria-hidden="true" />
      <span className="toggle-switch-text">{isOperating ? "운행" : "대기"}</span>
    </button>
  );
}
