"use client";

import { useEffect, useState, useTransition } from "react";

import {
  completeDispatchManualAction,
  revertDispatchCompletionAction
} from "@/app/dispatch/actions";
import type { ServiceOpsDispatchOrder } from "@/lib/services/service-ops-api";

export interface DeliveryFocusPanelProps {
  /** 진행 중(ASSIGNED) 배차 — sequence 정렬된 상태로 받는다. (호스트에서 1회 조회) */
  active: ServiceOpsDispatchOrder[];
  /** 완료(COMPLETED) 배차. */
  completed: ServiceOpsDispatchOrder[];
  /** 배차 데이터 조회 중. */
  loading: boolean;
  /** 순차배차(SEQUENTIAL/ROUND) 여부. true 면 순번 + 현재/대기 표기. */
  isSequential: boolean;
  /** 선택 차량의 현재 위치 — 다음 목적지 ETA 계산에 사용. */
  vehiclePosition?: { lat: number; lng: number } | null;
  /** 패널 닫기(= 선택 해제). */
  onClose: () => void;
  /** 행 클릭 시 해당 배송지로 지도 팬. */
  onSelectDestination: (p: { lat: number; lng: number }) => void;
  /** 완료 정정(수동 완료/되돌리기) 후 재조회 트리거. */
  onOrdersChanged?: () => void;
}

/**
 * 완료 상태 배지 — 자동 추정 진행 단계까지. 배차 모니터(completionLabel)와
 * 표기 통일: 이동 중 → 도착 감지 → 완료(자동)/완료(수동).
 */
function completionLabel(order: ServiceOpsDispatchOrder): string {
  if (order.status === "COMPLETED") {
    return order.completedSource === "AUTO" ? "완료(자동)" : "완료(수동)";
  }
  return order.arrivalDetectedAt ? "도착 감지" : "이동 중";
}

/** epoch ms → KST HH:mm. */
function kstClockFromMs(ms: number): string {
  const kst = new Date(ms + 9 * 60 * 60 * 1000);
  return `${String(kst.getUTCHours()).padStart(2, "0")}:${String(kst.getUTCMinutes()).padStart(2, "0")}`;
}

/** 클리닝 예정 시각 (KST HH:mm). */
function kstClock(iso: string): string {
  const kst = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000);
  return `${String(kst.getUTCHours()).padStart(2, "0")}:${String(kst.getUTCMinutes()).padStart(2, "0")}`;
}

function hasCoords(o: ServiceOpsDispatchOrder): boolean {
  return Boolean(o.latitude || o.longitude);
}

function formatCompletedAt(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

/** 진행 중 한 행 — 고객명 + 종류 배지 + 주소 + 도착/예정 시각. 클릭 시 지도 팬. */
function ActiveRow({
  order,
  badge,
  etaLabel,
  onSelect
}: {
  order: ServiceOpsDispatchOrder;
  badge?: string;
  /** 다음 목적지 행의 "도착 예정 HH:mm" 라벨 (없으면 미표시). */
  etaLabel?: string | null;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className="delivery-focus-row"
      onClick={onSelect}
      disabled={!hasCoords(order)}
    >
      {badge ? <span className="delivery-focus-seq">{badge}</span> : null}
      <span className="delivery-focus-row-main">
        <span className="delivery-focus-row-head">
          <span className="delivery-focus-name">{order.customerName || "—"}</span>
          {order.scheduledAt ? (
            <span className="delivery-focus-sched">{kstClock(order.scheduledAt)}</span>
          ) : null}
          <span
            className={`delivery-focus-kind delivery-focus-kind--${
              order.arrivalDetectedAt ? "arrived" : "delivery"
            }`}
          >
            {completionLabel(order)}
          </span>
        </span>
        <span className="delivery-focus-addr">{order.address || "주소 없음"}</span>
        {order.arrivalDetectedAt || etaLabel ? (
          <span className="delivery-focus-times">
            {order.arrivalDetectedAt ? `도착 ${kstClock(order.arrivalDetectedAt)}` : null}
            {order.arrivalDetectedAt && etaLabel ? " · " : null}
            {etaLabel}
          </span>
        ) : null}
      </span>
    </button>
  );
}

/**
 * 좌측 배송 리스트 패널 (포커스 모드). 읽기 전용 — 진행 중 + 완료 배차를
 * 상태 구분해 보여주고, 행 클릭 시 해당 배송지로 지도를 이동한다.
 *
 * 순차배차(isSequential)면 진행 중 섹션을 순번 + 현재/대기 로, 그 외엔 평면
 * 목록으로 렌더한다. 완료 섹션은 접을 수 있고 완료 시각을 표시한다.
 */
export function DeliveryFocusPanel({
  active,
  completed,
  loading,
  isSequential,
  vehiclePosition,
  onClose,
  onSelectDestination,
  onOrdersChanged
}: DeliveryFocusPanelProps) {
  const [completedOpen, setCompletedOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  // 다음 목적지(아직 도착 감지 전인 첫 진행 건)의 도착 예정 시각.
  // 차량 현 위치 → 목적지 ETA 를 서버 프록시(OSRM, 폴백 거리 추정)로 받아
  // "지금 + 소요초" 를 KST 시계로 표기한다. 30초마다 갱신.
  const [eta, setEta] = useState<{ orderId: string; arriveAtMs: number } | null>(null);

  // "오늘 일정" — 클리닝은 KST 오늘 범위의 예정만 보여준다. listByBike 는
  // 날짜 경계가 없어 내일·모레 예정까지 실려 오기 때문. 예정 시각이 없는
  // 행(구 데이터)은 판정 불가라 남긴다.
  // mount 시점 고정 — 패널은 차량 선택마다 새로 붙으므로 충분하고,
  // 렌더 중 Date.now 호출은 react-hooks/purity 위반이다.
  const [kstToday] = useState(() => new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10));

  const nextOrder = active.find((o) => !o.arrivalDetectedAt && hasCoords(o)) ?? null;
  const nextOrderId = nextOrder?.id ?? null;
  const nextLat = nextOrder?.latitude ?? null;
  const nextLng = nextOrder?.longitude ?? null;
  const fromLat = vehiclePosition?.lat ?? null;
  const fromLng = vehiclePosition?.lng ?? null;

  useEffect(() => {
    if (nextOrderId === null || fromLat === null || fromLng === null) return;
    // 클로저에서 narrowing 이 풀리지 않게 확정값으로 캡처.
    const orderId = nextOrderId;
    let cancelled = false;

    function load() {
      fetch(
        `/api/overview/eta?fromLat=${fromLat}&fromLng=${fromLng}&toLat=${nextLat}&toLng=${nextLng}`,
        { cache: "no-store", credentials: "same-origin" }
      )
        .then(async (r) => (r.ok ? ((await r.json()) as { durationSeconds: number }) : null))
        .then((next) => {
          if (cancelled || !next) return;
          setEta({ orderId, arriveAtMs: Date.now() + next.durationSeconds * 1000 });
        })
        .catch(() => {
          /* 다음 갱신에서 재시도 */
        });
    }

    load();
    const timer = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [nextOrderId, nextLat, nextLng, fromLat, fromLng]);
  const visibleActive = isSequential
    ? active.filter((o) => {
        if (!o.scheduledAt) return true;
        const kstDate = new Date(new Date(o.scheduledAt).getTime() + 9 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10);
        return kstDate === kstToday;
      })
    : active;

  const handleComplete = (id: string) => {
    if (!window.confirm("이 배차를 완료 처리하시겠어요? (사진 없이 수동 완료)")) return;
    startTransition(async () => {
      const res = await completeDispatchManualAction(id);
      if (!res.ok) window.alert(res.message ?? "완료 실패");
      onOrdersChanged?.();
    });
  };

  const handleRevert = (id: string) => {
    if (!window.confirm("완료를 되돌리시겠어요? 배차가 다시 진행 중이 됩니다.")) return;
    startTransition(async () => {
      const res = await revertDispatchCompletionAction(id);
      if (!res.ok) window.alert(res.message ?? "되돌리기 실패");
      onOrdersChanged?.();
    });
  };

  const activeWithCoords = visibleActive.filter(hasCoords);

  return (
    <aside className="vehicle-focus-left-panel" aria-label="배송 리스트">
      <div className="vehicle-focus-left-panel-header">
        <h3>{isSequential ? "오늘 일정" : "배송"}</h3>
        <a
          className="delivery-focus-goto"
          href={isSequential ? "/management/operations#mgmt-cleaning" : "/management/operations#mgmt-dispatch"}
          title="배차 화면에서 이 건들을 관리"
        >
          배차 화면 ↗
        </a>
        <button
          type="button"
          className="vehicle-floating-panel-close"
          onClick={onClose}
          aria-label="닫기"
          title="닫기"
        >
          ×
        </button>
      </div>

      <section className="delivery-focus-section">
        <p className="delivery-focus-section-title">
          진행 중<span className="delivery-focus-count">{visibleActive.length}</span>
        </p>
        {loading ? (
          <p className="delivery-focus-empty">불러오는 중…</p>
        ) : visibleActive.length === 0 ? (
          <p className="delivery-focus-empty">진행 중인 배송이 없습니다.</p>
        ) : (
          <ul className="delivery-focus-list">
            {visibleActive.map((order, idx) => {
              // 클리닝 배지는 예정 시각순 순번 — sequence 는 생성 순이라
              // 시간 순서와 무관하다.
              const badge = isSequential ? String(idx + 1) : undefined;
              return (
                <li key={order.id}>
                  <ActiveRow
                    order={order}
                    badge={badge}
                    etaLabel={
                      eta && eta.orderId === order.id
                        ? `도착 예정 ${kstClockFromMs(eta.arriveAtMs)}`
                        : null
                    }
                    onSelect={() =>
                      onSelectDestination({ lat: order.latitude, lng: order.longitude })
                    }
                  />
                  {isSequential ? (
                    <span className="delivery-focus-state">
                      {idx === 0 ? "현재" : "대기"}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    className="delivery-focus-action"
                    disabled={isPending}
                    onClick={() => handleComplete(order.id)}
                    title="사진 없이 수동 완료"
                  >
                    완료
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {!loading && visibleActive.length > 0 && activeWithCoords.length === 0 ? (
          <p className="delivery-focus-empty">표시할 배송지 좌표가 없습니다.</p>
        ) : null}
      </section>

      {completed.length > 0 ? (
        <section className="delivery-focus-section delivery-focus-section--completed">
          <button
            type="button"
            className="delivery-focus-collapse"
            aria-expanded={completedOpen}
            onClick={() => setCompletedOpen((open) => !open)}
          >
            완료 내역
            <span className="delivery-focus-count">{completed.length}</span>
            <span className="delivery-focus-caret" aria-hidden="true">
              {completedOpen ? "▲" : "▼"}
            </span>
          </button>
          {completedOpen ? (
            <ul className="delivery-focus-list">
              {completed.map((order) => (
                <li key={order.id}>
                  <button
                    type="button"
                    className="delivery-focus-row delivery-focus-row--completed"
                    disabled={!hasCoords(order)}
                    onClick={() =>
                      onSelectDestination({ lat: order.latitude, lng: order.longitude })
                    }
                  >
                    <span className="delivery-focus-row-main">
                      <span className="delivery-focus-row-head">
                        <span className="delivery-focus-name">
                          {order.customerName || "—"}
                        </span>
                        <span className="delivery-focus-kind delivery-focus-kind--delivery">
                          {completionLabel(order)}
                        </span>
                      </span>
                      <span className="delivery-focus-addr">
                        {order.address || "주소 없음"}
                      </span>
                    </span>
                    {order.completedAt ? (
                      <span className="delivery-focus-completed-time">
                        {formatCompletedAt(order.completedAt)}
                      </span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    className="delivery-focus-action"
                    disabled={isPending}
                    onClick={() => handleRevert(order.id)}
                  >
                    되돌리기
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </aside>
  );
}
