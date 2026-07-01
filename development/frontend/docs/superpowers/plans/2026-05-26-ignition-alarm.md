# Ignition Alarm Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** IMEI=-1 시뮬레이션 차량이 WORKING→MOVING 전환(시동 ON) 시 지도 마커 위에 CSS 말풍선을 표시하고 헤더 벨 아이콘 + 드롭다운 이력에 기록한다.

**Architecture:** `fleet-simulation.ts`의 상태명을 IDLE/EN_ROUTE → WORKING/MOVING으로 바꾸고 `ignitionOnAt` 필드를 추가한다. `FleetSimulationContext`가 상태 변화를 감지해 `NotificationContext`에 이벤트를 push하고, `MapShell`이 `ignitionOnAt` 기준으로 마커 HTML에 CSS 말풍선을 포함시킨다.

**Tech Stack:** Next.js 14 App Router, TypeScript, React "use client", NCP Maps SDK (HTML marker), CSS animation

---

## 변경 파일 목록

| 파일 | 신규/수정 |
|------|----------|
| `development/front-admin-web/lib/services/fleet-simulation.ts` | 수정 |
| `development/front-admin-web/components/layout/NotificationContext.tsx` | **신규** |
| `development/front-admin-web/components/layout/NotificationBell.tsx` | **신규** |
| `development/front-admin-web/components/overview/FleetSimulationContext.tsx` | 수정 |
| `development/front-admin-web/components/overview/use-simulated-bike-pins.ts` | 수정 |
| `development/front-admin-web/components/dashboard/MapShell.tsx` | 수정 |
| `development/front-admin-web/components/overview/OverviewClientShell.tsx` | 수정 |
| `development/front-admin-web/app/page.tsx` | 수정 |
| `development/front-admin-web/app/globals.css` | 수정 |

---

### Task 1: fleet-simulation.ts — ServicePhase + ignitionOnAt

**Files:**
- Modify: `development/front-admin-web/lib/services/fleet-simulation.ts`

현재 파일 전체를 아래 내용으로 교체한다. 변경점:
- `DeliveryPhase` → `ServicePhase`, `"IDLE"` → `"WORKING"`, `"EN_ROUTE"` → `"MOVING"`
- `SimulatedBikeState`에 `ignitionOnAt: number | null` 추가
- `advanceBikeState` WORKING→MOVING 전환 시 `ignitionOnAt: nowMs`, MOVING→WORKING 시 `ignitionOnAt: null`
- `makeInitialState` 양쪽 `ignitionOnAt: null`
- 상수명 `EN_ROUTE_*` → `MOVING_*`, `IDLE_BETWEEN_*` → `WORKING_BETWEEN_*`

- [ ] **Step 1: fleet-simulation.ts 전체 교체**

```ts
/**
 * Fleet 서비스 시뮬레이션 순수 데이터 모델 + phase 진행 함수.
 *
 * Phase: WORKING(작업, 시동 OFF) ↔ MOVING(이동 중, 시동 ON)
 * isMatched=true 이면 WORKING → MOVING 자동 전환, false 이면 WORKING 유지.
 */

export type ServicePhase = "WORKING" | "MOVING";

export type SimulatedBikeState = {
  bikeId: string;
  phase: ServicePhase;
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number } | null;
  /** MOVING 진행률 0..1. WORKING 에선 0. */
  progress: number;
  /** 누적 완료 건수. MOVING → WORKING 전환 시마다 +1. */
  deliveryCount: number;
  /** 현재 표시 위치 */
  position: { lat: number; lng: number };
  /** 이 phase 의 시작 ms */
  phaseStartedAt: number;
  /** 이 phase 의 종료 예정 ms */
  phaseEndsAt: number;
  /** 현재 표시 속도 km/h */
  speedKph: number;
  /** 현재 시동. MOVING 만 ON. */
  ignitionStatus: "ON" | "OFF";
  /**
   * WORKING→MOVING 전환 시점 ms. 말풍선 표시 여부 판단에 사용.
   * MOVING→WORKING 전환 시 null 로 초기화.
   */
  ignitionOnAt: number | null;
  /** 누적 km */
  odometerKm: number;
  /** 배터리 % */
  batteryPercent: number;
  /** OSRM 경로 waypoints */
  routeWaypoints: ReadonlyArray<{ lat: number; lng: number }> | null;
};

/** tick 간격 (ms) */
export const TICK_INTERVAL_MS = 250;
/** MOVING 한 주기 최소 길이 (15분) */
export const MOVING_DURATION_MIN_MS = 15 * 60 * 1_000;
/** MOVING 한 주기 최대 길이 (40분) */
export const MOVING_DURATION_MAX_MS = 40 * 60 * 1_000;
/** 완료 후 다음 사이클까지 최소 대기 (ms) */
export const WORKING_BETWEEN_MIN_MS = 5_000;
/** 완료 후 다음 사이클까지 최대 대기 (ms) */
export const WORKING_BETWEEN_MAX_MS = 30_000;
/** MOVING 시 표시 속도 (km/h) */
export const MOVING_SPEED_KPH = 30;
/** 초당 배터리 감소량 */
export const BATTERY_DROP_PER_SECOND = 0.05;

const SEOUL_LAT_MIN = 37.44;
const SEOUL_LAT_MAX = 37.65;
const SEOUL_LNG_MIN = 126.87;
const SEOUL_LNG_MAX = 127.10;

function randomMovingDurationMs(random: () => number): number {
  return (
    MOVING_DURATION_MIN_MS +
    random() * (MOVING_DURATION_MAX_MS - MOVING_DURATION_MIN_MS)
  );
}

function randomSeoulPoint(random: () => number = Math.random): { lat: number; lng: number } {
  return {
    lat: SEOUL_LAT_MIN + random() * (SEOUL_LAT_MAX - SEOUL_LAT_MIN),
    lng: SEOUL_LNG_MIN + random() * (SEOUL_LNG_MAX - SEOUL_LNG_MIN)
  };
}

function approxDistanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = (b.lat - a.lat) * 111;
  const dLng = (b.lng - a.lng) * 88;
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

function lerpPosition(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  t: number
): { lat: number; lng: number } {
  const clamped = Math.max(0, Math.min(1, t));
  return {
    lat: from.lat + (to.lat - from.lat) * clamped,
    lng: from.lng + (to.lng - from.lng) * clamped
  };
}

function walkPolyline(
  waypoints: ReadonlyArray<{ lat: number; lng: number }>,
  t: number
): { lat: number; lng: number } {
  if (waypoints.length === 0) return { lat: 37.5665, lng: 126.978 };
  if (waypoints.length === 1) return waypoints[0];
  const clamped = Math.max(0, Math.min(1, t));
  const totalSegs = waypoints.length - 1;
  const pos = clamped * totalSegs;
  const segIndex = Math.min(Math.floor(pos), totalSegs - 1);
  const segT = pos - segIndex;
  return lerpPosition(waypoints[segIndex], waypoints[segIndex + 1], segT);
}

export function advanceBikeState(
  prev: SimulatedBikeState,
  nowMs: number,
  isMatched: boolean,
  random: () => number = Math.random
): SimulatedBikeState {
  if (nowMs < prev.phaseEndsAt) {
    if (prev.phase !== "MOVING" || !prev.destination) return prev;
    const total = prev.phaseEndsAt - prev.phaseStartedAt;
    const elapsed = nowMs - prev.phaseStartedAt;
    const progress = total > 0 ? elapsed / total : 1;
    const position = prev.routeWaypoints
      ? walkPolyline(prev.routeWaypoints, progress)
      : lerpPosition(prev.origin, prev.destination, progress);
    const distanceKm = approxDistanceKm(prev.origin, prev.destination);
    const totalSeconds = total / 1_000;
    const tickFactor = TICK_INTERVAL_MS / 1_000;
    const odometerDelta = totalSeconds > 0 ? (distanceKm / totalSeconds) * tickFactor : 0;
    const batteryDelta = BATTERY_DROP_PER_SECOND * tickFactor;
    return {
      ...prev,
      progress,
      position,
      odometerKm: prev.odometerKm + odometerDelta,
      batteryPercent: Math.max(0, prev.batteryPercent - batteryDelta)
    };
  }

  switch (prev.phase) {
    case "WORKING": {
      if (!isMatched) {
        return { ...prev, phaseEndsAt: Number.POSITIVE_INFINITY };
      }
      const destination = randomSeoulPoint(random);
      return {
        ...prev,
        phase: "MOVING",
        destination,
        progress: 0,
        position: prev.origin,
        phaseStartedAt: nowMs,
        phaseEndsAt: nowMs + randomMovingDurationMs(random),
        speedKph: MOVING_SPEED_KPH,
        ignitionStatus: "ON",
        ignitionOnAt: nowMs,
        routeWaypoints: null
      };
    }
    case "MOVING": {
      const finalPosition = prev.destination ?? prev.origin;
      const idleMs = isMatched
        ? WORKING_BETWEEN_MIN_MS +
          Math.floor(random() * (WORKING_BETWEEN_MAX_MS - WORKING_BETWEEN_MIN_MS))
        : Number.POSITIVE_INFINITY;
      const workingPhaseEndsAt = idleMs === Number.POSITIVE_INFINITY ? idleMs : nowMs + idleMs;
      return {
        ...prev,
        phase: "WORKING",
        progress: 0,
        position: finalPosition,
        origin: finalPosition,
        destination: null,
        phaseStartedAt: nowMs,
        phaseEndsAt: workingPhaseEndsAt,
        speedKph: 0,
        ignitionStatus: "OFF",
        ignitionOnAt: null,
        routeWaypoints: null,
        deliveryCount: prev.deliveryCount + 1
      };
    }
  }
}

export function makeInitialState(input: {
  bikeId: string;
  origin: { lat: number; lng: number };
  nowMs: number;
  phase: "WORKING" | "MOVING";
  random?: () => number;
  initialOdometerKm?: number;
  initialBatteryPercent?: number;
}): SimulatedBikeState {
  const {
    bikeId,
    origin,
    nowMs,
    phase,
    random = Math.random,
    initialOdometerKm = 0,
    initialBatteryPercent = 90
  } = input;

  if (phase === "MOVING") {
    return {
      bikeId,
      phase: "MOVING",
      origin,
      destination: randomSeoulPoint(random),
      progress: 0,
      position: origin,
      phaseStartedAt: nowMs,
      phaseEndsAt: nowMs + randomMovingDurationMs(random),
      speedKph: MOVING_SPEED_KPH,
      ignitionStatus: "ON",
      ignitionOnAt: nowMs,
      odometerKm: initialOdometerKm,
      batteryPercent: initialBatteryPercent,
      routeWaypoints: null,
      deliveryCount: 0
    };
  }

  return {
    bikeId,
    phase: "WORKING",
    origin,
    destination: null,
    progress: 0,
    position: origin,
    phaseStartedAt: nowMs,
    phaseEndsAt: Number.POSITIVE_INFINITY,
    speedKph: 0,
    ignitionStatus: "OFF",
    ignitionOnAt: null,
    odometerKm: initialOdometerKm,
    batteryPercent: initialBatteryPercent,
    routeWaypoints: null,
    deliveryCount: 0
  };
}
```

- [ ] **Step 2: 타입 체크 확인**

```bash
cd development/front-admin-web && npx tsc --noEmit 2>&1 | head -30
```

Expected: `fleet-simulation.ts` 관련 에러가 다른 파일에서 나올 수 있음 (아직 참조 업데이트 전). `fleet-simulation.ts` 자체 에러는 0.

- [ ] **Step 3: commit**

```bash
git add development/front-admin-web/lib/services/fleet-simulation.ts
git commit -m "refactor(sim): rename DeliveryPhase→ServicePhase, IDLE→WORKING, EN_ROUTE→MOVING, add ignitionOnAt"
```

---

### Task 2: NotificationContext.tsx 신규 + CSS

**Files:**
- Create: `development/front-admin-web/components/layout/NotificationContext.tsx`
- Modify: `development/front-admin-web/app/globals.css` (append)

- [ ] **Step 1: NotificationContext.tsx 작성**

`development/front-admin-web/components/layout/NotificationContext.tsx` 파일을 새로 만든다:

```tsx
// development/front-admin-web/components/layout/NotificationContext.tsx
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

export type IgnitionNotification = {
  id: string;
  plateNumber: string;
  startedAt: number;
};

type NotificationContextValue = {
  notifications: IgnitionNotification[];
  unreadCount: number;
  addNotification: (n: Omit<IgnitionNotification, "id">) => void;
  markAllRead: () => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<IgnitionNotification[]>([]);
  const [readCount, setReadCount] = useState(0);

  const addNotification = useCallback((n: Omit<IgnitionNotification, "id">) => {
    setNotifications((prev) => {
      const next = [
        ...prev,
        { ...n, id: `${n.plateNumber}-${n.startedAt}` },
      ];
      return next.length > 20 ? next.slice(-20) : next;
    });
  }, []);

  const markAllRead = useCallback((total: number) => {
    setReadCount(total);
  }, []);

  const unreadCount = Math.max(0, notifications.length - readCount);

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, addNotification, markAllRead: () => markAllRead(notifications.length) }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}
```

- [ ] **Step 2: globals.css에 벨 CSS 추가 (파일 끝에 append)**

`development/front-admin-web/app/globals.css` 파일 맨 끝에 추가:

```css
/* ── Notification Bell ──────────────────────────────────────────── */
.notif-bell-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.notif-bell-btn {
  position: relative;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 18px;
  padding: 4px 6px;
  border-radius: 6px;
  line-height: 1;
  color: var(--rm-text, #374151);
}

.notif-bell-btn:hover {
  background: var(--rm-hover, rgba(0, 0, 0, 0.06));
}

.notif-badge {
  position: absolute;
  top: 0;
  right: 0;
  background: #ef4444;
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  min-width: 14px;
  height: 14px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 3px;
  pointer-events: none;
  z-index: 1;
}

.notif-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  width: 280px;
  max-height: 320px;
  overflow-y: auto;
  background: var(--rm-card-bg, #fff);
  border: 1px solid var(--rm-border, #e5e7eb);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  z-index: 100;
}

.notif-empty {
  padding: 16px;
  text-align: center;
  font-size: 13px;
  color: var(--rm-text-muted, #9ca3af);
}

.notif-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--rm-border, #e5e7eb);
  font-size: 12px;
}

.notif-item:last-child {
  border-bottom: none;
}

.notif-item-text {
  color: var(--rm-text, #374151);
  font-weight: 500;
  flex: 1;
}

.notif-item-time {
  color: var(--rm-text-muted, #9ca3af);
  white-space: nowrap;
  flex-shrink: 0;
}
```

- [ ] **Step 3: 타입 체크**

```bash
cd development/front-admin-web && npx tsc --noEmit 2>&1 | grep "NotificationContext" | head -10
```

Expected: 에러 없음.

- [ ] **Step 4: commit**

```bash
git add development/front-admin-web/components/layout/NotificationContext.tsx \
        development/front-admin-web/app/globals.css
git commit -m "feat(notif): add NotificationContext + bell CSS"
```

---

### Task 3: NotificationBell.tsx 신규 + 말풍선 CSS

**Files:**
- Create: `development/front-admin-web/components/layout/NotificationBell.tsx`
- Modify: `development/front-admin-web/app/globals.css` (append)

- [ ] **Step 1: NotificationBell.tsx 작성**

```tsx
// development/front-admin-web/components/layout/NotificationBell.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useNotifications } from "@/components/layout/NotificationContext";

function formatRelativeTime(startedAt: number): string {
  const diffMs = Date.now() - startedAt;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "방금";
  if (diffMin < 60) return `${diffMin}분 전`;
  return `${Math.floor(diffMin / 60)}시간 전`;
}

export function NotificationBell() {
  const { notifications, unreadCount, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next) markAllRead();
  }

  return (
    <div className="notif-bell-wrapper" ref={wrapperRef}>
      <button
        type="button"
        className="notif-bell-btn"
        onClick={handleToggle}
        aria-label={`알림${unreadCount > 0 ? ` (읽지 않은 알림 ${unreadCount}건)` : ""}`}
      >
        🔔
        {unreadCount > 0 && (
          <span className="notif-badge" aria-hidden="true">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="notif-dropdown" role="list" aria-label="이동 알림 이력">
          {notifications.length === 0 ? (
            <div className="notif-empty">알림 없음</div>
          ) : (
            [...notifications].reverse().map((n) => (
              <div key={n.id} className="notif-item" role="listitem">
                <span className="notif-item-text">🔑 {n.plateNumber} 이동 시작</span>
                <span className="notif-item-time">{formatRelativeTime(n.startedAt)}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: globals.css에 말풍선 CSS 추가 (파일 끝에 append)**

```css
/* ── Map Ignition Bubble ────────────────────────────────────────── */
.map-ignition-bubble {
  position: absolute;
  bottom: 32px;
  left: 50%;
  transform: translateX(-50%);
  background: #1d4ed8;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  padding: 3px 8px;
  border-radius: 10px;
  pointer-events: none;
  animation: ignition-bubble-fade 4s ease forwards;
}

.map-ignition-bubble::after {
  content: "";
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 5px solid transparent;
  border-top-color: #1d4ed8;
}

@keyframes ignition-bubble-fade {
  0%   { opacity: 1; }
  70%  { opacity: 1; }
  100% { opacity: 0; }
}
```

- [ ] **Step 3: 타입 체크**

```bash
cd development/front-admin-web && npx tsc --noEmit 2>&1 | grep "NotificationBell" | head -10
```

Expected: 에러 없음.

- [ ] **Step 4: commit**

```bash
git add development/front-admin-web/components/layout/NotificationBell.tsx \
        development/front-admin-web/app/globals.css
git commit -m "feat(notif): add NotificationBell component + ignition bubble CSS"
```

---

### Task 4: FleetSimulationContext.tsx — ignitionOnAt 감지 + addNotification 연동

**Files:**
- Modify: `development/front-admin-web/components/overview/FleetSimulationContext.tsx`

현재 파일에서 다음 변경 적용:

1. import `ServicePhase` (기존 `DeliveryPhase` 제거), `MOVING_DURATION_MAX_MS` (기존 `EN_ROUTE_DURATION_MAX_MS`)
2. `useNotifications` import 추가
3. `lastNotifiedIgnitionOnAtRef` ref 추가 — 중복 알림 방지용 (bikeId → 마지막 통보한 ignitionOnAt)
4. ignition 감지 `useEffect` 추가 — `simulated` 변화 감지 시 새 `ignitionOnAt` 비교
5. 기존 `"EN_ROUTE"` 문자열 → `"MOVING"`, `"IDLE"` → `"WORKING"` 변경
6. `EN_ROUTE_DURATION_MAX_MS` → `MOVING_DURATION_MAX_MS`

- [ ] **Step 1: import 블록 + useNotifications 호출 변경**

파일 상단 import를 다음으로 교체:

```ts
import {
  advanceBikeState,
  makeInitialState,
  TICK_INTERVAL_MS,
  MOVING_DURATION_MAX_MS,
  type SimulatedBikeState,
  type ServicePhase
} from "@/lib/services/fleet-simulation";
import type { FrontendDashboardBikePin } from "@/lib/services/service-ops-api";
import { fetchOsrmRoute } from "@/lib/services/osrm";
import { useNotifications } from "@/components/layout/NotificationContext";
```

- [ ] **Step 2: Provider 함수 안에 useNotifications + ref 추가**

`FleetSimulationProvider` 함수 내부, `useState` 선언들 바로 아래에 추가:

```ts
const { addNotification } = useNotifications();
/** bikeId → 마지막으로 알림 발송한 ignitionOnAt ms. 중복 발송 방지. */
const lastNotifiedIgnitionOnAtRef = useRef<Map<string, number>>(new Map());
```

- [ ] **Step 3: ignition 감지 useEffect 추가**

`useEffect(() => { ... }, [matchedImeiSet]);` (자동 트리거 useEffect) 바로 뒤에 추가:

```ts
// WORKING→MOVING 전환 감지 → 알림 발송.
// simulated 변화를 감지해 ignitionOnAt 이 새로 설정된 bike 를 찾아낸다.
// lastNotifiedIgnitionOnAtRef 로 같은 ignitionOnAt 에 대해 중복 발송하지 않는다.
useEffect(() => {
  for (const [bikeId, state] of simulated) {
    if (state.ignitionOnAt == null) continue;
    const last = lastNotifiedIgnitionOnAtRef.current.get(bikeId);
    if (last === state.ignitionOnAt) continue;
    lastNotifiedIgnitionOnAtRef.current.set(bikeId, state.ignitionOnAt);
    const pin = pinsRef.current.find((p) => p.bikeId === bikeId);
    const plateNumber = pin?.plateNumber ?? bikeId.slice(0, 8);
    addNotification({ plateNumber, startedAt: state.ignitionOnAt });
  }
  // cleanup: 시뮬에서 제거된 bikeId 는 ref 에서도 정리
  for (const bikeId of lastNotifiedIgnitionOnAtRef.current.keys()) {
    if (!simulated.has(bikeId)) {
      lastNotifiedIgnitionOnAtRef.current.delete(bikeId);
    }
  }
}, [simulated, addNotification]);
```

- [ ] **Step 4: 나머지 문자열 치환**

파일 내 나머지 변경:

| 변경 전 | 변경 후 |
|---------|---------|
| `EN_ROUTE_DURATION_MAX_MS` | `MOVING_DURATION_MAX_MS` |
| `phase: "EN_ROUTE"` | `phase: "MOVING"` |
| `phase === "IDLE"` | `phase === "WORKING"` |
| `DeliveryPhase` (타입 참조) | `ServicePhase` |

자동 트리거 useEffect 내 `makeInitialState` 호출의 `phase: "EN_ROUTE"` → `phase: "MOVING"`.

tick loop 내 cleanup 조건 `advanced.phase === "IDLE"` → `advanced.phase === "WORKING"`.

OSRM fetch useEffect 내 `state.phase !== "EN_ROUTE"` → `state.phase !== "MOVING"`, `current.phase === "IDLE"` → `current.phase === "WORKING"`.

- [ ] **Step 5: 타입 체크**

```bash
cd development/front-admin-web && npx tsc --noEmit 2>&1 | grep "FleetSimulationContext" | head -10
```

Expected: 에러 없음.

- [ ] **Step 6: commit**

```bash
git add development/front-admin-web/components/overview/FleetSimulationContext.tsx
git commit -m "feat(sim): connect FleetSimulationContext to NotificationContext on ignitionOnAt change"
```

---

### Task 5: use-simulated-bike-pins.ts — servicePhase + ignitionOnAt 전달

**Files:**
- Modify: `development/front-admin-web/components/overview/use-simulated-bike-pins.ts`

- [ ] **Step 1: 파일 전체를 아래 내용으로 교체**

```ts
"use client";

import { useMemo } from "react";

import { useFleetSimulation } from "@/components/overview/FleetSimulationContext";
import type { FrontendDashboardBikePin } from "@/lib/services/service-ops-api";
import type { VehicleCurrentTelemetrySummary } from "@/lib/services/vehicle-maintenance-data";
import type { ServicePhase } from "@/lib/services/fleet-simulation";

/**
 * MapShell / OverviewMapSearch 에 전달하는 클라이언트 전용 확장 타입.
 * FrontendDashboardBikePin 위에 servicePhase / ignitionOnAt 을 overlay 한다.
 */
export type SimulatedBikePin = FrontendDashboardBikePin & {
  servicePhase: ServicePhase | null;
  /** 누적 완료 건수. 시뮬레이션 대상이 아니면 undefined. */
  deliveryCount?: number;
  /** WORKING→MOVING 전환 시점 ms. 말풍선 표시 여부 판단에 사용. null 이면 미표시. */
  ignitionOnAt?: number | null;
};

/**
 * 지도 마커용 — raw bikePins 배열 위에 fleet 시뮬레이션 상태를 overlay 한다.
 */
export function useSimulatedBikePins(
  rawPins: ReadonlyArray<FrontendDashboardBikePin>
): SimulatedBikePin[] {
  const { simulated } = useFleetSimulation();
  return useMemo(() => {
    if (simulated.size === 0) {
      return rawPins.map((pin) => ({ ...pin, servicePhase: null }));
    }
    const nowIso = new Date().toISOString();
    return rawPins.map((pin) => {
      const sim = simulated.get(pin.bikeId);
      if (!sim) return { ...pin, servicePhase: null };
      const batteryStatus: FrontendDashboardBikePin["batteryStatus"] =
        sim.batteryPercent < 20 ? "CRITICAL" : sim.batteryPercent <= 50 ? "LOW" : "NORMAL";
      const drivingStatus: FrontendDashboardBikePin["drivingStatus"] =
        sim.ignitionStatus === "ON" ? (sim.speedKph >= 3 ? "DRIVING" : "STOPPED") : "PARKED";
      return {
        ...pin,
        latitude: sim.position.lat,
        longitude: sim.position.lng,
        speedKph: sim.speedKph,
        batteryPercent: Math.round(sim.batteryPercent),
        ignitionStatus: sim.ignitionStatus,
        connectionStatus: "ONLINE",
        drivingStatus,
        batteryStatus,
        lastReceivedAt: nowIso,
        servicePhase: sim.phase,
        deliveryCount: sim.deliveryCount,
        ignitionOnAt: sim.ignitionOnAt
      };
    });
  }, [rawPins, simulated]);
}

/**
 * 차량 상세 패널 텔레메트리 섹션용.
 */
export function useSimulatedCurrentTelemetry(
  rawCurrent: VehicleCurrentTelemetrySummary | null,
  bikeId: string | null
): VehicleCurrentTelemetrySummary | null {
  const { simulated } = useFleetSimulation();
  return useMemo(() => {
    if (!bikeId) return rawCurrent;
    const sim = simulated.get(bikeId);
    if (!sim) return rawCurrent;
    const batteryStatus: VehicleCurrentTelemetrySummary["batteryStatus"] =
      sim.batteryPercent < 20 ? "CRITICAL" : sim.batteryPercent <= 50 ? "LOW" : "NORMAL";
    const drivingStatus: VehicleCurrentTelemetrySummary["drivingStatus"] =
      sim.ignitionStatus === "ON" ? (sim.speedKph >= 3 ? "DRIVING" : "STOPPED") : "PARKED";
    return {
      odometerKm: Math.round(sim.odometerKm),
      connectionStatus: "ONLINE",
      ignitionStatus: sim.ignitionStatus,
      batteryPercent: Math.round(sim.batteryPercent),
      batteryStatus,
      speedKph: sim.speedKph,
      drivingStatus,
      lastReceivedAt: new Date().toISOString()
    };
  }, [rawCurrent, bikeId, simulated]);
}
```

- [ ] **Step 2: 타입 체크**

```bash
cd development/front-admin-web && npx tsc --noEmit 2>&1 | grep "use-simulated-bike-pins" | head -10
```

Expected: 에러 없음.

- [ ] **Step 3: commit**

```bash
git add development/front-admin-web/components/overview/use-simulated-bike-pins.ts
git commit -m "refactor(sim): rename deliveryPhase→servicePhase, add ignitionOnAt in SimulatedBikePin"
```

---

### Task 6: MapShell.tsx — servicePhase 배지 + 말풍선

**Files:**
- Modify: `development/front-admin-web/components/dashboard/MapShell.tsx`

아래 변경을 순서대로 적용한다.

- [ ] **Step 1: import 변경**

파일 상단에서:
```ts
import type { DeliveryPhase } from "@/lib/services/fleet-simulation";
```
를 다음으로 교체:
```ts
import type { ServicePhase } from "@/lib/services/fleet-simulation";
```

- [ ] **Step 2: bikePins prop 타입 변경**

`MapShellProps` 인터페이스에서:
```ts
bikePins?: Array<FrontendDashboardBikePin & { deliveryPhase?: DeliveryPhase | null; deliveryCount?: number }>;
```
를 다음으로 교체:
```ts
bikePins?: Array<FrontendDashboardBikePin & { servicePhase?: ServicePhase | null; deliveryCount?: number; ignitionOnAt?: number | null }>;
```

- [ ] **Step 3: prevDeliveryPhaseRef → prevServicePhaseRef**

```ts
const prevDeliveryPhaseRef = useRef<Map<string, DeliveryPhase | null>>(new Map());
```
를 다음으로 교체:
```ts
const prevServicePhaseRef = useRef<Map<string, ServicePhase | null>>(new Map());
```

- [ ] **Step 4: bike markers useEffect 내부 변경**

`useEffect` (bike markers, line ~430-494) 내부:

```ts
const prevPhases = prevDeliveryPhaseRef.current;
```
→
```ts
const prevPhases = prevServicePhaseRef.current;
```

```ts
const html = bikeMarkerHtml(pin.pinLabel ?? pin.plateNumber, showLabel, pin.deliveryPhase, pin.deliveryCount);
```
→
```ts
const html = bikeMarkerHtml(pin.pinLabel ?? pin.plateNumber, showLabel, pin.servicePhase, pin.deliveryCount, pin.ignitionOnAt);
```

```ts
const currentPhase = pin.deliveryPhase ?? null;
```
→
```ts
const currentPhase = pin.servicePhase ?? null;
```

- [ ] **Step 5: deliveryBadgeMarkup → serviceBadgeMarkup 함수 교체**

기존 `deliveryBadgeMarkup` 함수 (line ~676-690) 전체를 다음으로 교체:

```ts
/**
 * 서비스 상태 배지 HTML.
 * - MOVING: 파랑(#3b82f6) "이동 중 · N건"
 * - WORKING: 회색(#6b7280) "작업 · N건"
 */
function serviceBadgeMarkup(phase: ServicePhase, deliveryCount: number): string {
  const isMoving = phase === "MOVING";
  const bg = isMoving ? "#3b82f6" : "#6b7280";
  const label = isMoving ? "이동 중" : "작업";
  const text = `${label} · ${deliveryCount}건`;
  return (
    `<div style="position:absolute;top:${BADGE_TOP_OFFSET}px;left:50%;` +
    `transform:translateX(-50%);display:flex;align-items:center;` +
    `height:14px;padding:0 5px;border-radius:3px;font-size:9px;font-weight:600;` +
    `color:#fff;white-space:nowrap;background:${bg};pointer-events:none;">` +
    `${text}</div>`
  );
}
```

그리고 아래에 말풍선 생성 함수 추가:

```ts
/**
 * 시동 켜짐 말풍선 HTML.
 * CSS animation (.map-ignition-bubble) 으로 4초 후 자동 소멸.
 * NCP firstChild-only 제약상 markerWrapper 안에 badge 와 함께 삽입.
 */
function ignitionBubbleMarkup(): string {
  return `<div class="map-ignition-bubble">🔑 이동 시작</div>`;
}
```

- [ ] **Step 6: bikeMarkerHtml 함수 교체**

기존 `bikeMarkerHtml` 함수 (line ~755-773) 전체를 다음으로 교체:

```ts
/**
 * 차량 마커 — 스쿠터 아이콘 + (옵션) 번호판 라벨 + (옵션) 서비스 상태 배지 + (옵션) 시동 말풍선.
 *
 * servicePhase != null 이면 배지 포함. ignitionOnAt 이 4초 이내이면 말풍선 포함.
 * 배지·말풍선은 markerWrapper(overflow:visible + position:relative) 안 position:absolute 자식.
 */
function bikeMarkerHtml(
  plateNumber: string,
  showLabel: boolean,
  servicePhase?: ServicePhase | null,
  deliveryCount?: number,
  ignitionOnAt?: number | null
): string {
  const badge =
    servicePhase != null
      ? serviceBadgeMarkup(servicePhase, deliveryCount ?? 0)
      : "";
  const showBubble = ignitionOnAt != null && Date.now() - ignitionOnAt < 4_000;
  const bubble = showBubble ? ignitionBubbleMarkup() : "";
  const extras = badge || bubble ? badge + bubble : undefined;
  const wrapped = markerWrapper(bikeIconSvg(), "--rm-accent", extras);
  if (!showLabel) return wrapped;
  return (
    `<div style="position:relative;pointer-events:auto;width:${ICON_PX}px;height:${ICON_PX}px;">` +
    `${labelMarkup(plateNumber)}${wrapped}` +
    `</div>`
  );
}
```

- [ ] **Step 7: 타입 체크**

```bash
cd development/front-admin-web && npx tsc --noEmit 2>&1 | grep "MapShell" | head -10
```

Expected: 에러 없음.

- [ ] **Step 8: commit**

```bash
git add development/front-admin-web/components/dashboard/MapShell.tsx
git commit -m "feat(map): servicePhase 배지 (이동 중/작업) + 시동 켜짐 말풍선"
```

---

### Task 7: OverviewClientShell.tsx + page.tsx — Provider 래핑 + Bell 연결

**Files:**
- Modify: `development/front-admin-web/components/overview/OverviewClientShell.tsx`
- Modify: `development/front-admin-web/app/page.tsx`

- [ ] **Step 1: OverviewClientShell.tsx — NotificationProvider 래핑**

현재 내용:

```tsx
"use client";

import type { ReactNode } from "react";

import { FleetSimulationProvider } from "@/components/overview/FleetSimulationContext";
import { VehicleFilterProvider } from "@/components/overview/VehicleFilterContext";

export function OverviewClientShell({
  children,
  imeiMinusOneBikeIds,
  bikeRiderPairs
}: {
  children: ReactNode;
  imeiMinusOneBikeIds: string[];
  bikeRiderPairs: [string, string][];
}) {
  return (
    <VehicleFilterProvider>
      <FleetSimulationProvider
        imeiMinusOneBikeIds={imeiMinusOneBikeIds}
        bikeRiderPairs={bikeRiderPairs}
      >
        {children}
      </FleetSimulationProvider>
    </VehicleFilterProvider>
  );
}
```

다음으로 교체:

```tsx
"use client";

import type { ReactNode } from "react";

import { NotificationProvider } from "@/components/layout/NotificationContext";
import { FleetSimulationProvider } from "@/components/overview/FleetSimulationContext";
import { VehicleFilterProvider } from "@/components/overview/VehicleFilterContext";

/**
 * 루트 페이지의 클라이언트 전용 Provider 래퍼.
 *
 * NotificationProvider — 최외곽. FleetSimulationProvider 가
 * useNotifications() 를 호출하므로 반드시 그 바깥에 있어야 한다.
 */
export function OverviewClientShell({
  children,
  imeiMinusOneBikeIds,
  bikeRiderPairs
}: {
  children: ReactNode;
  imeiMinusOneBikeIds: string[];
  bikeRiderPairs: [string, string][];
}) {
  return (
    <NotificationProvider>
      <VehicleFilterProvider>
        <FleetSimulationProvider
          imeiMinusOneBikeIds={imeiMinusOneBikeIds}
          bikeRiderPairs={bikeRiderPairs}
        >
          {children}
        </FleetSimulationProvider>
      </VehicleFilterProvider>
    </NotificationProvider>
  );
}
```

- [ ] **Step 2: page.tsx — NotificationBell import 추가**

`page.tsx` 상단 import 목록에 추가 (다른 import 사이 아무 위치):

```ts
import { NotificationBell } from "@/components/layout/NotificationBell";
```

- [ ] **Step 3: page.tsx — NotificationBell을 overview-tab-action에 추가**

`page.tsx`에서 `overview-tab-action` div를 찾아 `NotificationBell`을 추가한다.

현재:
```tsx
<div className="overview-tab-action">
  {activeTab === "riders" ? <CreateRiderDialog /> : null}
  {activeTab === "vehicles" ? <CreateVehicleDialog /> : null}
  {activeTab === "stations" ? <CreateStationDialog /> : null}
  {activeTab === "maintenance" ? <CreateMaintenanceItemDialog parentOptions={maintenanceData.items} /> : null}
</div>
```

다음으로 교체:
```tsx
<div className="overview-tab-action">
  <NotificationBell />
  {activeTab === "riders" ? <CreateRiderDialog /> : null}
  {activeTab === "vehicles" ? <CreateVehicleDialog /> : null}
  {activeTab === "stations" ? <CreateStationDialog /> : null}
  {activeTab === "maintenance" ? <CreateMaintenanceItemDialog parentOptions={maintenanceData.items} /> : null}
</div>
```

- [ ] **Step 4: 타입 체크**

```bash
cd development/front-admin-web && npx tsc --noEmit 2>&1 | head -20
```

Expected: 에러 없음 (또는 이전부터 있던 무관한 에러만).

- [ ] **Step 5: commit**

```bash
git add development/front-admin-web/components/overview/OverviewClientShell.tsx \
        development/front-admin-web/app/page.tsx
git commit -m "feat(notif): wire NotificationProvider + NotificationBell into page layout"
```

---

### Task 8: 최종 검증 + PR

**Files:** 없음 (빌드 검증 + PR 생성)

- [ ] **Step 1: 전체 빌드 확인**

```bash
cd development/front-admin-web && npm run build 2>&1 | tail -30
```

Expected: `✓ Compiled successfully` — TypeScript 에러 0, 빌드 에러 0.

- [ ] **Step 2: lint 확인**

```bash
cd development/front-admin-web && npm run lint 2>&1 | tail -20
```

Expected: 에러 0, warning은 pre-existing 1건 허용.

- [ ] **Step 3: PR 생성**

```bash
git push origin dev

gh pr create \
  --base main \
  --head dev \
  --title "feat: 시동 ON 말풍선 + 벨 알림 (IMEI=-1 시뮬레이션)" \
  --body "$(cat <<'EOF'
## Summary

- fleet-simulation: DeliveryPhase → ServicePhase (WORKING/MOVING), ignitionOnAt 필드 추가
- NotificationContext: ignition 이벤트 배열 + unreadCount + markAllRead
- NotificationBell: 헤더 벨 버튼 + 드롭다운 이력 (최신순 20건)
- FleetSimulationContext: WORKING→MOVING 전환 감지 → addNotification
- MapShell: 배지 라벨 작업/이동 중, WORKING→MOVING 전환 시 CSS 말풍선 (4초 animation)

## Test plan

- [ ] npm run build → compiled successfully
- [ ] npm run lint → 0 errors
- [ ] IMEI=-1 차량이 이동 시작할 때 지도 마커 위 🔑 말풍선 표시 후 4초 소멸 확인
- [ ] 헤더 벨 배지 숫자 증가 확인
- [ ] 벨 클릭 → 드롭다운에 "🔑 {번호판} 이동 시작 · 방금" 이력 표시
- [ ] 드롭다운 열면 배지 초기화 확인
- [ ] 지도 마커 배지 "이동 중 · N건" / "작업 · N건" 표시 확인

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
