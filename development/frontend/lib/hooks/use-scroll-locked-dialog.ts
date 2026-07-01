"use client";

import { useEffect, type RefObject } from "react";

/**
 * Native `<dialog>` + `showModal()` 패턴이 가진 부작용을 잡는 훅.
 *
 * 브라우저는 `showModal()` 직후 다이얼로그 내부 첫 focusable 요소(보통
 * input) 에 자동 포커스를 옮긴다. 그 요소가 viewport 밖이면 브라우저가
 * scroll-into-view 휴리스틱으로 페이지를 위로 끌어올려서 다이얼로그를
 * 띄울 때 운영자가 보던 표의 행이 함께 밀려나간다.
 *
 * 두 단계로 막는다:
 *   1) `showModal()` 직전에 `window.scrollY` 를 저장하고, 호출 직후 다음
 *      frame 에서 같은 값으로 다시 스크롤 복원. 어떤 브라우저가 자동
 *      focus 로 스크롤을 옮기더라도 원위치로 잡아당긴다.
 *   2) 다이얼로그 element 자체에 `focus({ preventScroll: true })` 를 호출
 *      해 1) 의 스크롤 점프 자체를 최대한 줄인다. (Safari/Firefox 에서
 *      효과적, Chromium 도 backup 역할.)
 *
 * 닫힐 때는 `close()` 만 호출 — page scroll 은 그대로 살아 있다.
 *
 * `open` 상태가 바뀔 때마다 effect 가 한 번 발화하도록 호출 측에서
 * boolean 으로 명시. (예: `row !== null`)
 */
export function useScrollLockedDialog(
  dialogRef: RefObject<HTMLDialogElement | null>,
  open: boolean
): void {
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      // 이미 열려 있으면(중복 effect 발화 등) 다시 열지 않는다 — 두 번째
      // `showModal()` 호출은 InvalidStateError 를 던진다.
      if (dialog.open) return;
      const savedScrollY = typeof window !== "undefined" ? window.scrollY : 0;
      dialog.showModal();
      // dialog 자체에 포커스를 잡아 두면 내부 input 으로의 자동 포커스가
      // 일어나도 그 단계가 사용자 가시 영역 안쪽이 된다. tabindex 가 명시
      // 안 되어 있으면 native dialog 는 focusable 이 아닐 수 있어 부드러운
      // fallback 차원으로만 시도.
      try {
        (dialog as HTMLElement).focus({ preventScroll: true });
      } catch {
        /* focus 가 실패해도 1) 단계 scroll 복원으로 충분히 메꿔진다. */
      }
      // 다음 frame 에서 scroll 복원. `showModal()` 후 브라우저가 focus 를
      // 잡는 시점이 microtask 다음에 오는 frame 이라 rAF 안에서 잡아주면
      // 거의 모든 케이스가 잡힌다.
      if (typeof window !== "undefined") {
        const handle = window.requestAnimationFrame(() => {
          if (Math.abs(window.scrollY - savedScrollY) > 1) {
            window.scrollTo({ top: savedScrollY, left: 0, behavior: "instant" as ScrollBehavior });
          }
        });
        return () => window.cancelAnimationFrame(handle);
      }
    } else {
      if (dialog.open) dialog.close();
    }
  }, [dialogRef, open]);
}
