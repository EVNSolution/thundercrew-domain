"use client";

import { useEffect, useState } from "react";

import {
  listCompletedDispatchOrdersAction,
  listDispatchOrdersAction
} from "@/app/dispatch/actions";
import type { ServiceOpsDispatchOrder } from "@/lib/services/service-ops-api";

export interface FocusDispatchOrders {
  /** 진행 중(ASSIGNED) 배차 주문. sequence 오름차순 정렬. */
  active: ServiceOpsDispatchOrder[];
  /** 완료(COMPLETED) 배차 주문. */
  completed: ServiceOpsDispatchOrder[];
  loading: boolean;
}

/**
 * 조회 완료 결과. `key` 는 어떤 bikeId 에 대한 결과인지 — 현재 bikeId 와 다르면
 * stale 로 보고 loading 으로 파생한다. null 이면 아직 한 번도 안 받음.
 */
type FetchedOrders = {
  key: string;
  active: ServiceOpsDispatchOrder[];
  completed: ServiceOpsDispatchOrder[];
} | null;

const EMPTY_RESULT: FocusDispatchOrders = { active: [], completed: [], loading: false };

/**
 * 포커스 모드에서 선택 차량의 배차 주문(진행 중 + 완료)을 조회한다.
 *
 * 기존 server action(`listDispatchOrdersAction` / `listCompletedDispatchOrdersAction`)
 * 을 그대로 재사용한다(둘 다 미인증/오류 시 빈 배열). bikeId 가 null 이면
 * 빈 상태로 단락한다(= 포커스 해제). cancelled 가드로 빠른 선택 전환 시
 * stale 응답이 state 를 덮어쓰지 않게 한다.
 *
 * loading 은 "받은 결과의 key 가 현재 bikeId 와 다른가" 에서 파생한다 —
 * effect 본문에서 동기 setState 를 호출하지 않기 위함
 * (react-hooks/set-state-in-effect).
 */
export function useFocusDispatchOrders(bikeId: string | null, reloadTick = 0): FocusDispatchOrders {
  const [fetched, setFetched] = useState<FetchedOrders>(null);

  useEffect(() => {
    if (!bikeId) return;
    // reloadTick 는 완료 정정(수동 완료/되돌리기) 직후 재조회 트리거다.
    void reloadTick;

    let cancelled = false;
    // 클로저 narrowing 유지용 확정값 캡처.
    const targetBikeId = bikeId;
    // 시뮬 배차 체인이 서버에서 완료를 만들어내므로, 패널을 열어둔 동안
    // 15초 폴링으로 진행/완료 목록을 계속 갱신한다 — 껐다 켜지 않아도
    // 오늘 일정이 작업 완료를 따라간다.
    const POLL_INTERVAL_MS = 15_000;
    function load() {
      Promise.all([
      listDispatchOrdersAction(targetBikeId),
      listCompletedDispatchOrdersAction(targetBikeId)
    ])
      .then(([active, completed]) => {
        if (cancelled) return;
        // GET /?bikeId= 는 상태 무관 전체 목록이다 — 완료건이 "진행 중"
        // 섹션에 섞이지 않게 ASSIGNED 만 남긴다 (완료는 completed 목록이 담당).
        // 정렬: 클리닝(시간 배차)은 예정 시각이 곧 순서다 — sequence 는 생성
        // 순이라 나중에 등록한 이른 시각 건이 뒤로 밀린다. 예정 시각이 있는
        // 건끼리는 시각순, 그 외(배송)는 순번순.
        const sortedActive = active
          .filter((o) => o.status === "ASSIGNED")
          .sort((a, b) => {
            if (a.scheduledAt && b.scheduledAt) {
              return a.scheduledAt < b.scheduledAt ? -1 : a.scheduledAt > b.scheduledAt ? 1 : 0;
            }
            if (a.scheduledAt) return -1;
            if (b.scheduledAt) return 1;
            return a.sequence - b.sequence;
          });
        setFetched({ key: targetBikeId, active: sortedActive, completed });
      })
      .catch(() => {
        if (cancelled) return;
        // 폴링 중 일시 오류 — 표시 중이던 목록을 비우지 않는다(stale 유지).
        // 첫 로드 실패만 빈 목록으로 확정해 로딩 스피너가 안 멈추게 한다.
        setFetched((prev) =>
          prev && prev.key === targetBikeId ? prev : { key: targetBikeId, active: [], completed: [] }
        );
      });
    }

    load();
    const timer = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      load();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [bikeId, reloadTick]);

  if (!bikeId) return EMPTY_RESULT;
  if (!fetched || fetched.key !== bikeId) {
    // 현재 bikeId 에 대한 결과를 아직 못 받음 → 로딩 중.
    return { active: [], completed: [], loading: true };
  }
  return { active: fetched.active, completed: fetched.completed, loading: false };
}
