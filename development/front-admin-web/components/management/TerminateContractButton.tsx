"use client";

import { useTransition } from "react";

import { terminateContractFromOverviewAction } from "@/app/actions";

/**
 * 라이더 상세 다이얼로그 view 모드 actions 줄에 노출되는 "종료" 버튼.
 * 백엔드는 soft-terminate (terminated_at 채워넣음) 후 active 목록에서 빠지게
 * 한다. 운영자가 실수로 누르지 않도록 confirm prompt 를 한 번 띄운다.
 *
 * 원래는 `<form action={serverAction}>` 패턴이었지만, native `<dialog>` 모달
 * 안에서 form submit 이 다이얼로그 상태와 어긋나(다이얼로그가 닫히지 않아
 * stale 상태로 보임) 운영자가 "종료가 안 먹는다" 고 느끼는 문제가 있었다.
 *
 * 그래서 `<button onClick>` + `useTransition` 으로 서버 액션을 직접 호출하고,
 * `onConfirmed` 콜백으로 상위 다이얼로그를 즉시 닫는다. 서버 액션의
 * `redirect()` 가 RSC 네비게이션을 트리거해 데이터도 새로 받아온다.
 *
 * 같은 줄의 닫기 / 수정 버튼과 시각적 무게를 맞추기 위해 button-neutral 톤.
 */
export function TerminateContractButton({
  contractId,
  contractLabel,
  onConfirmed
}: {
  contractId: string;
  contractLabel: string;
  /** confirm 통과 직후 호출 — 보통 상위 다이얼로그 닫기로 연결. */
  onConfirmed?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className="button-neutral"
      disabled={pending}
      onClick={() => {
        if (pending) return;
        if (!window.confirm(`계약 "${contractLabel}" 을(를) 종료하시겠습니까?`)) return;
        onConfirmed?.();
        startTransition(() => {
          // 서버 액션 결과는 redirect 로 RSC 네비게이션을 트리거하므로
          // 여기서 await / 결과 처리할 게 따로 없다. 실패 시 액션이
          // ?status=contract-terminate-error 로 redirect 한다.
          void terminateContractFromOverviewAction(contractId);
        });
      }}
    >
      {pending ? "종료 중…" : "종료"}
    </button>
  );
}
