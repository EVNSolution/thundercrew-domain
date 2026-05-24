# Fleet Delivery Simulation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a client-side fleet delivery simulator that drives all registered vehicles through an IDLE → ASSIGNED → EN_ROUTE → ARRIVED → IDLE loop while a `[데모 시작]` pill is on, plus a per-vehicle `[이 차량에 배정]` button for single-bike demos. Live state (position, ignition, speed, odometer, battery, last received, delivery phase + ETA) overlays the existing deterministic dummy state.

**Architecture:** A new `FleetSimulationContext` provider mounted inside `OverviewClientShell` owns the simulation state map + a 1-second tick interval. Two overlay hooks (`useSimulatedBikePins`, `useSimulatedCurrentTelemetry`) merge live simulation values onto the deterministic dummy values passed down from the server page. The provider records the current dummy pins via a ref-based seed so phase transitions know each bike's origin without prop drilling.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript. No new runtime deps. No backend changes. No test runner — verification = `npm run typecheck` + `npm run lint` + manual smoke checklist.

**Reference doc:** `docs/superpowers/specs/2026-05-25-fleet-delivery-simulation-design.md`.

---

## File Structure

| Path | Purpose | Action |
| ---- | ------- | ------ |
| `lib/services/fleet-simulation.ts` | Types + pure phase-advance helper (`tickBike`) + constants (durations, speed, battery drop) | **Create** |
| `components/overview/FleetSimulationContext.tsx` | React context + provider that owns `simulated` map, runs the tick interval, exposes `fleetRunning` / `setFleetRunning` / `assignSingleBike` / `seedBikePins` / `useFleetSimulation()` hook | **Create** |
| `components/overview/use-simulated-bike-pins.ts` | Two read-only hooks that overlay simulated state on raw inputs — `useSimulatedBikePins(raw)` and `useSimulatedCurrentTelemetry(rawCurrent, bikeId)` | **Create** |
| `components/overview/OverviewClientShell.tsx` | Wrap children with `<FleetSimulationProvider>` | **Modify** |
| `components/overview/OverviewMapBanner.tsx` | Seed pins into provider; overlay simulated bikePins onto `MapShell` input; add `[데모 시작/정지]` pill button | **Modify** |
| `components/overview/FullscreenMapHost.tsx` | Same overlay; add `[데모 시작/정지]` pill in header next to `[필터]` | **Modify** |
| `components/management/VehicleDetailDialog.tsx` | Add a "배송" section above "텔레메트리" showing simulated phase + ETA + `[이 차량에 배정]` / `[배정 취소]` / `[새 배정]` button; overlay simulated current state onto `bundle.currentState` for the telemetry section | **Modify** |
| `app/globals.css` | Styles for the `[데모 시작/정지]` pill (in-page + fullscreen) and the new 배송 section | **Modify** |

No tests directory — verification at the end via typecheck + lint + manual smoke.

---

## Task 1: Branch sanity check

**Files:** none

- [ ] **Step 1: Verify branch + spec**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain
git status
git log --oneline -3
ls docs/superpowers/specs/2026-05-25-fleet-delivery-simulation-design.md
ls docs/superpowers/plans/2026-05-25-fleet-delivery-simulation.md
```

Expected: branch `cc-222-fleet-delivery-simulation-design`, most recent commit `fdbab4a` (spec). Both doc files exist. Working tree clean.

---

## Task 2: Create `fleet-simulation.ts` (types + pure helpers)

**Files:**
- Create: `development/front-admin-web/lib/services/fleet-simulation.ts`

The data layer — types, constants, and one pure function `advanceBikeState` that computes the next `SimulatedBikeState` given the current one + `now` ms. No React, no side effects.

- [ ] **Step 1: Create the file with full content**

```ts
/**
 * Fleet 배송 시뮬레이션의 순수 데이터 모델 + phase 진행 함수.
 *
 * Provider 가 useEffect tick 안에서 `advanceBikeState(prev, now)` 를 호출해
 * 다음 phase / position / 텔레메트리 부속 값을 받는다. React / DOM / window
 * 접근 없음.
 */

export type DeliveryPhase = "IDLE" | "ASSIGNED" | "EN_ROUTE" | "ARRIVED";

export type SimulatedBikeState = {
  bikeId: string;
  phase: DeliveryPhase;
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number } | null;
  /** EN_ROUTE 진행률 0..1. 그 외 phase 에선 0. */
  progress: number;
  /** 현재 표시 위치 — origin → destination 보간 결과 또는 phase 별 고정. */
  position: { lat: number; lng: number };
  /** 이 phase 의 시작 ms */
  phaseStartedAt: number;
  /** 이 phase 의 종료 예정 ms */
  phaseEndsAt: number;
  /** 현재 표시 속도 km/h */
  speedKph: number;
  /** 현재 시동. EN_ROUTE 만 ON. */
  ignitionStatus: "ON" | "OFF";
  /** 누적 km. EN_ROUTE 중 점진 증가. */
  odometerKm: number;
  /** 배터리 %. EN_ROUTE 중 0.05/tick 감소. */
  batteryPercent: number;
  /** 운영자가 단일 차량 수동 배정으로 만든 entry 인지. fleet 정지 후에도 살아 있는다. */
  manualOrigin: boolean;
};

// Phase 길이 (ms). 스펙 표 참고.
export const ASSIGNED_DURATION_MS = 5_000;
export const EN_ROUTE_DURATION_MS = 5 * 60 * 1_000;
export const ARRIVED_DURATION_MS = 10_000;
/** Fleet 모드의 IDLE → ASSIGNED staggered window. 0..MAX 사이 random. */
export const IDLE_FLEET_MAX_MS = 30_000;
/** EN_ROUTE 시 표시 속도 (km/h). 거리 / 시간 비례 odometer 증가에도 사용. */
export const EN_ROUTE_SPEED_KPH = 30;
/** 매 tick (1초) 당 배터리 감소량. EN_ROUTE 만 발화. */
export const BATTERY_DROP_PER_TICK = 0.05;

const SEOUL_LAT_MIN = 37.44;
const SEOUL_LAT_MAX = 37.65;
const SEOUL_LNG_MIN = 126.87;
const SEOUL_LNG_MAX = 127.10;

/**
 * 서울 박스 안 random 좌표. fleet 의 destination 으로 쓴다. 시뮬레이션이
 * 매번 새 random 값을 줘야 사이클마다 다른 목적지로 가는 데모 효과가 난다.
 * 결정성이 필요한 경우(테스트 등) `random` 시드 함수를 외부에서 주입.
 */
export function randomSeoulPoint(random: () => number = Math.random): { lat: number; lng: number } {
  return {
    lat: SEOUL_LAT_MIN + random() * (SEOUL_LAT_MAX - SEOUL_LAT_MIN),
    lng: SEOUL_LNG_MIN + random() * (SEOUL_LNG_MAX - SEOUL_LNG_MIN)
  };
}

/** Haversine 대신 단순 평면 근사 — 데모 표시용이라 km 단위 오차 무방. */
export function approxDistanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = (b.lat - a.lat) * 111;
  const dLng = (b.lng - a.lng) * 88; // 한국 위도대 평균 cos × 111 ≈ 88
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

/** lerp 보간 — t 가 0..1 사이일 때 from → to. clamp 포함. */
export function lerpPosition(from: { lat: number; lng: number }, to: { lat: number; lng: number }, t: number): {
  lat: number;
  lng: number;
} {
  const clamped = Math.max(0, Math.min(1, t));
  return {
    lat: from.lat + (to.lat - from.lat) * clamped,
    lng: from.lng + (to.lng - from.lng) * clamped
  };
}

/**
 * 1초 tick 마다 호출되어 prev 의 phase / position / 부속 값을 advance.
 * `nowMs` 는 호출자가 주입 — 테스트 결정성 + 동일 tick 의 여러 차량이 같은
 * 기준 시각을 보도록.
 *
 * `fleetRunning` 이 false 이면 IDLE → ASSIGNED 자동 전환이 발생하지 않는다
 * (manual origin 만 살아남는다). EN_ROUTE / ARRIVED 사이클은 그대로 마저
 * 돌고 IDLE 로 가서 멈춘다.
 */
export function advanceBikeState(
  prev: SimulatedBikeState,
  nowMs: number,
  fleetRunning: boolean,
  random: () => number = Math.random
): SimulatedBikeState {
  if (nowMs < prev.phaseEndsAt) {
    // 같은 phase 안 — EN_ROUTE 면 position / odometer / battery 만 advance.
    if (prev.phase !== "EN_ROUTE" || !prev.destination) return prev;
    const total = prev.phaseEndsAt - prev.phaseStartedAt;
    const elapsed = nowMs - prev.phaseStartedAt;
    const progress = total > 0 ? elapsed / total : 1;
    const position = lerpPosition(prev.origin, prev.destination, progress);
    // 1 tick = 1초 가정. 거리 / 시간 = 속도 → 시간당 거리 / 3600 = 초당 거리.
    const distanceKm = approxDistanceKm(prev.origin, prev.destination);
    const totalSeconds = EN_ROUTE_DURATION_MS / 1_000;
    const odometerDelta = totalSeconds > 0 ? distanceKm / totalSeconds : 0;
    return {
      ...prev,
      progress,
      position,
      odometerKm: prev.odometerKm + odometerDelta,
      batteryPercent: Math.max(0, prev.batteryPercent - BATTERY_DROP_PER_TICK)
    };
  }

  // phaseEndsAt 도달 — 다음 phase 로 전환.
  switch (prev.phase) {
    case "IDLE": {
      if (!fleetRunning && !prev.manualOrigin) {
        // fleet 끄고 manual 도 아닌 IDLE 은 다시 ASSIGN 하지 않음.
        return prev;
      }
      const destination = randomSeoulPoint(random);
      return {
        ...prev,
        phase: "ASSIGNED",
        destination,
        progress: 0,
        position: prev.origin,
        phaseStartedAt: nowMs,
        phaseEndsAt: nowMs + ASSIGNED_DURATION_MS,
        speedKph: 0,
        ignitionStatus: "OFF"
      };
    }
    case "ASSIGNED": {
      return {
        ...prev,
        phase: "EN_ROUTE",
        progress: 0,
        position: prev.origin,
        phaseStartedAt: nowMs,
        phaseEndsAt: nowMs + EN_ROUTE_DURATION_MS,
        speedKph: EN_ROUTE_SPEED_KPH,
        ignitionStatus: "ON"
      };
    }
    case "EN_ROUTE": {
      const finalPosition = prev.destination ?? prev.origin;
      return {
        ...prev,
        phase: "ARRIVED",
        progress: 1,
        position: finalPosition,
        // 도착지가 다음 사이클의 origin 이 된다.
        origin: finalPosition,
        destination: null,
        phaseStartedAt: nowMs,
        phaseEndsAt: nowMs + ARRIVED_DURATION_MS,
        speedKph: 0,
        ignitionStatus: "OFF"
      };
    }
    case "ARRIVED": {
      // IDLE 로 복귀. fleet 모드면 staggered 다음 사이클; 아니면 그대로 머묾.
      const idleWindow = fleetRunning ? Math.floor(random() * IDLE_FLEET_MAX_MS) : Number.POSITIVE_INFINITY;
      return {
        ...prev,
        phase: "IDLE",
        progress: 0,
        // position 유지 — origin 자리에 있음.
        phaseStartedAt: nowMs,
        phaseEndsAt: idleWindow === Number.POSITIVE_INFINITY ? Number.POSITIVE_INFINITY : nowMs + idleWindow,
        speedKph: 0,
        ignitionStatus: "OFF"
      };
    }
  }
}

/**
 * 새로운 시뮬레이션 entry 를 만들 때 호출. fleet seed 와 manual assign 모두
 * 이 함수를 거쳐 일관된 초기값을 받는다. `phase` 는 호출자가 결정 — fleet
 * 은 IDLE (staggered), manual 은 ASSIGNED 직행.
 */
export function makeInitialState(input: {
  bikeId: string;
  origin: { lat: number; lng: number };
  nowMs: number;
  phase: "IDLE" | "ASSIGNED";
  manualOrigin: boolean;
  staggerMs?: number;
  random?: () => number;
  initialOdometerKm?: number;
  initialBatteryPercent?: number;
}): SimulatedBikeState {
  const {
    bikeId,
    origin,
    nowMs,
    phase,
    manualOrigin,
    staggerMs,
    random = Math.random,
    initialOdometerKm = 0,
    initialBatteryPercent = 90
  } = input;
  if (phase === "ASSIGNED") {
    return {
      bikeId,
      phase: "ASSIGNED",
      origin,
      destination: randomSeoulPoint(random),
      progress: 0,
      position: origin,
      phaseStartedAt: nowMs,
      phaseEndsAt: nowMs + ASSIGNED_DURATION_MS,
      speedKph: 0,
      ignitionStatus: "OFF",
      odometerKm: initialOdometerKm,
      batteryPercent: initialBatteryPercent,
      manualOrigin
    };
  }
  const stagger = staggerMs ?? Math.floor(random() * IDLE_FLEET_MAX_MS);
  return {
    bikeId,
    phase: "IDLE",
    origin,
    destination: null,
    progress: 0,
    position: origin,
    phaseStartedAt: nowMs,
    phaseEndsAt: nowMs + stagger,
    speedKph: 0,
    ignitionStatus: "OFF",
    odometerKm: initialOdometerKm,
    batteryPercent: initialBatteryPercent,
    manualOrigin
  };
}
```

- [ ] **Step 2: Static checks**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web
npm run typecheck
npm run lint
```

Both must exit 0. The file is orphaned — that's expected.

- [ ] **Step 3: Commit**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain
git add development/front-admin-web/lib/services/fleet-simulation.ts
git commit -m "Add fleet-simulation types + pure phase advance helpers

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Create `FleetSimulationContext.tsx` (provider + tick)

**Files:**
- Create: `development/front-admin-web/components/overview/FleetSimulationContext.tsx`

- [ ] **Step 1: Create the file with full content**

```tsx
"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import {
  advanceBikeState,
  makeInitialState,
  type SimulatedBikeState
} from "@/lib/services/fleet-simulation";
import type { FrontendDashboardBikePin } from "@/lib/services/service-ops-api";

/**
 * Fleet 배송 시뮬레이션 — 모든 클라이언트 트리가 공유하는 in-memory 시뮬레이터.
 * 1초 tick interval 안에서 모든 `simulated` entry 를 `advanceBikeState` 로
 * 진행시킨다. fleetRunning 이 false 이고 manual entry 도 없으면 interval 을
 * 멈춰 백그라운드 비용을 0 으로.
 */

const TICK_INTERVAL_MS = 1_000;

type FleetSimulationContextValue = {
  fleetRunning: boolean;
  setFleetRunning: (running: boolean) => void;
  /** bikeId → 시뮬레이트된 상태. fleet OFF 이고 manual 없으면 빈 Map. */
  simulated: ReadonlyMap<string, SimulatedBikeState>;
  /** 운영자가 단일 차량을 수동 배정. 이미 시뮬레이트 중이면 no-op. */
  assignSingleBike: (bikeId: string) => void;
  /** 단일 차량 배정을 운영자가 취소. EN_ROUTE 중이면 그대로 두고 IDLE 도달 시
   *  manual flag 가 false 가 되어 다음 사이클에 멈춘다. (즉시 제거하면 도중에
   *  지도 마커가 휙 텔레포트하는 부작용이 있어 사이클 종료까지 대기.) */
  cancelSingleBike: (bikeId: string) => void;
  /** OverviewMapBanner / FullscreenMapHost 가 호출 — 현재 dummy bikePins 를
   *  ref 에 저장해 두면 phase 전환 시 origin / 초기 odo / battery 를 거기서
   *  읽어 채울 수 있다. */
  seedBikePins: (pins: ReadonlyArray<FrontendDashboardBikePin>) => void;
};

const FleetSimulationContext = createContext<FleetSimulationContextValue | null>(null);

export function FleetSimulationProvider({ children }: { children: ReactNode }) {
  const [fleetRunning, setFleetRaw] = useState(false);
  const [simulated, setSimulated] = useState<ReadonlyMap<string, SimulatedBikeState>>(() => new Map());
  const pinsRef = useRef<ReadonlyArray<FrontendDashboardBikePin>>([]);

  const seedBikePins = useCallback((pins: ReadonlyArray<FrontendDashboardBikePin>) => {
    pinsRef.current = pins;
  }, []);

  // fleet on 시 모든 등록된 bike 에 대해 IDLE staggered entry 를 seed.
  // 기존에 있던 manual entry 는 보존 (덮어쓰지 않음).
  const setFleetRunning = useCallback((running: boolean) => {
    if (running) {
      const nowMs = Date.now();
      setSimulated((prev) => {
        const next = new Map(prev);
        for (const pin of pinsRef.current) {
          if (next.has(pin.bikeId)) continue;
          next.set(
            pin.bikeId,
            makeInitialState({
              bikeId: pin.bikeId,
              origin: { lat: pin.latitude, lng: pin.longitude },
              nowMs,
              phase: "IDLE",
              manualOrigin: false,
              initialOdometerKm: 0,
              initialBatteryPercent: typeof pin.batteryPercent === "number" ? pin.batteryPercent : 90
            })
          );
        }
        return next;
      });
    }
    setFleetRaw(running);
  }, []);

  const assignSingleBike = useCallback((bikeId: string) => {
    const pin = pinsRef.current.find((p) => p.bikeId === bikeId);
    if (!pin) return;
    setSimulated((prev) => {
      if (prev.has(bikeId)) return prev;
      const next = new Map(prev);
      next.set(
        bikeId,
        makeInitialState({
          bikeId,
          origin: { lat: pin.latitude, lng: pin.longitude },
          nowMs: Date.now(),
          phase: "ASSIGNED",
          manualOrigin: true,
          initialOdometerKm: 0,
          initialBatteryPercent: typeof pin.batteryPercent === "number" ? pin.batteryPercent : 90
        })
      );
      return next;
    });
  }, []);

  const cancelSingleBike = useCallback((bikeId: string) => {
    setSimulated((prev) => {
      const existing = prev.get(bikeId);
      if (!existing || !existing.manualOrigin) return prev;
      const next = new Map(prev);
      // 즉시 제거 — 운영자가 명시적 취소를 누른 거라 마커가 텔레포트해도 의도된 동작.
      next.delete(bikeId);
      return next;
    });
  }, []);

  // Tick 루프 — fleet 이 켜져 있거나 manual entry 가 하나라도 있으면 1초마다
  // 모든 entry 를 advanceBikeState 로 진행.
  useEffect(() => {
    if (!fleetRunning && simulated.size === 0) return;
    const interval = window.setInterval(() => {
      const nowMs = Date.now();
      setSimulated((prev) => {
        let mutated = false;
        const next = new Map<string, SimulatedBikeState>();
        for (const [bikeId, state] of prev) {
          const advanced = advanceBikeState(state, nowMs, fleetRunning);
          if (advanced !== state) mutated = true;
          // fleet 꺼진 후 IDLE 이고 manual 도 아니면 cleanup — 다음 fleet on 까지
          // simulated 에 머무를 이유 없음.
          if (!fleetRunning && advanced.phase === "IDLE" && !advanced.manualOrigin) {
            mutated = true;
            continue;
          }
          next.set(bikeId, advanced);
        }
        return mutated ? next : prev;
      });
    }, TICK_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [fleetRunning, simulated.size]);

  const value = useMemo<FleetSimulationContextValue>(
    () => ({ fleetRunning, setFleetRunning, simulated, assignSingleBike, cancelSingleBike, seedBikePins }),
    [fleetRunning, setFleetRunning, simulated, assignSingleBike, cancelSingleBike, seedBikePins]
  );

  return <FleetSimulationContext.Provider value={value}>{children}</FleetSimulationContext.Provider>;
}

/**
 * provider 없는 환경에서도 안전하게 호출되도록 noop fallback 반환.
 */
export function useFleetSimulation(): FleetSimulationContextValue {
  const ctx = useContext(FleetSimulationContext);
  if (!ctx) {
    const emptyMap: ReadonlyMap<string, SimulatedBikeState> = new Map();
    return {
      fleetRunning: false,
      setFleetRunning: () => {},
      simulated: emptyMap,
      assignSingleBike: () => {},
      cancelSingleBike: () => {},
      seedBikePins: () => {}
    };
  }
  return ctx;
}
```

- [ ] **Step 2: Static checks** — same `npm run typecheck` + `npm run lint`, exit 0.

- [ ] **Step 3: Commit**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain
git add development/front-admin-web/components/overview/FleetSimulationContext.tsx
git commit -m "Add FleetSimulationContext provider with 1-second tick

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Mount provider in `OverviewClientShell`

**Files:**
- Modify: `development/front-admin-web/components/overview/OverviewClientShell.tsx`

- [ ] **Step 1: Read the file**

The existing shell is a single client wrapper that mounts `<VehicleFilterProvider>` around children.

- [ ] **Step 2: Wrap children with `<FleetSimulationProvider>` inside the existing provider**

Replace the file contents with:

```tsx
"use client";

import type { ReactNode } from "react";

import { FleetSimulationProvider } from "@/components/overview/FleetSimulationContext";
import { VehicleFilterProvider } from "@/components/overview/VehicleFilterContext";

/**
 * 루트 페이지의 client-state 외각. server-render 된 children (KPI / 지도 /
 * 탭 / 패널들) 을 그대로 받되 그 안의 client 컴포넌트들이 공유해야 할 두
 * 채널을 한 번만 마운트한다:
 *   - VehicleFilterContext: 필터/선택/전체화면 토글
 *   - FleetSimulationContext: 데모 배송 시뮬레이션
 */
export function OverviewClientShell({ children }: { children: ReactNode }) {
  return (
    <VehicleFilterProvider>
      <FleetSimulationProvider>{children}</FleetSimulationProvider>
    </VehicleFilterProvider>
  );
}
```

- [ ] **Step 3: Static checks**, expect exit 0.

- [ ] **Step 4: Commit**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain
git add development/front-admin-web/components/overview/OverviewClientShell.tsx
git commit -m "Mount FleetSimulationProvider inside OverviewClientShell

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Override hooks (`useSimulatedBikePins`, `useSimulatedCurrentTelemetry`)

**Files:**
- Create: `development/front-admin-web/components/overview/use-simulated-bike-pins.ts`

- [ ] **Step 1: Create the file**

```ts
"use client";

import { useMemo } from "react";

import { useFleetSimulation } from "@/components/overview/FleetSimulationContext";
import type { FrontendDashboardBikePin } from "@/lib/services/service-ops-api";
import type { VehicleCurrentTelemetrySummary } from "@/lib/services/vehicle-maintenance-data";

/**
 * 지도 마커용 — raw bikePins 배열 위에 fleet 시뮬레이션 상태를 overlay 한다.
 * simulated 가 비어 있으면 raw 가 그대로 반환되어 비용 없음. 시뮬레이트
 * 되는 차량의 lat/lng / 시동 / 속도 / 배터리 / 연결 상태 / 마지막 수신 만
 * 갈아끼우고 다른 필드 (plateNumber, modelName 등) 는 raw 그대로.
 */
export function useSimulatedBikePins(
  rawPins: ReadonlyArray<FrontendDashboardBikePin>
): FrontendDashboardBikePin[] {
  const { simulated } = useFleetSimulation();
  return useMemo(() => {
    if (simulated.size === 0) return rawPins.slice();
    const nowIso = new Date().toISOString();
    return rawPins.map((pin) => {
      const sim = simulated.get(pin.bikeId);
      if (!sim) return pin;
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
        lastReceivedAt: nowIso
      };
    });
  }, [rawPins, simulated]);
}

/**
 * 차량 상세 패널 텔레메트리 섹션용 — bundle.currentState 위에 simulated
 * overlay. raw 가 null 이고 simulated 에도 entry 없으면 null. simulated 가
 * 있으면 거기서 합성한 summary 를 돌려준다.
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

- [ ] **Step 2: Static checks**, exit 0.

- [ ] **Step 3: Commit**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain
git add development/front-admin-web/components/overview/use-simulated-bike-pins.ts
git commit -m "Add hooks that overlay simulated state on raw bike pins / telemetry

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Wire into `OverviewMapBanner` (seed + overlay + 데모 버튼)

**Files:**
- Modify: `development/front-admin-web/components/overview/OverviewMapBanner.tsx`

- [ ] **Step 1: Read the file** to confirm the current structure (toggle row + canvas).

- [ ] **Step 2: Add imports near the top**

```tsx
import { useFleetSimulation } from "@/components/overview/FleetSimulationContext";
import { useSimulatedBikePins } from "@/components/overview/use-simulated-bike-pins";
```

- [ ] **Step 3: Inside the component, near other hooks** — read fleet context, seed pins, compute overlaid pins, derive both `effectiveBikePins` source AND any place `bikePins` is passed to `MapShell` to use the overlaid array

Find the existing `effectiveBikePins` useMemo:

```tsx
const effectiveBikePins = useMemo(() => {
  if (filteredBikeIds === null) return bikePins;
  return bikePins.filter((pin) => filteredBikeIds.has(pin.bikeId));
}, [bikePins, filteredBikeIds]);
```

Add ABOVE it:

```tsx
const { fleetRunning, setFleetRunning, seedBikePins } = useFleetSimulation();
const overlaidBikePins = useSimulatedBikePins(bikePins);

useEffect(() => {
  seedBikePins(bikePins);
}, [bikePins, seedBikePins]);
```

Then change the `effectiveBikePins` useMemo to use `overlaidBikePins` instead of `bikePins`:

```tsx
const effectiveBikePins = useMemo(() => {
  if (filteredBikeIds === null) return overlaidBikePins;
  return overlaidBikePins.filter((pin) => filteredBikeIds.has(pin.bikeId));
}, [overlaidBikePins, filteredBikeIds]);
```

`bikePinById` (used elsewhere for the search override / target location) should also use `overlaidBikePins` so target-following tracks the moving simulated position:

```tsx
const bikePinById = useMemo(() => {
  const map = new Map<string, FrontendDashboardBikePin>();
  for (const pin of overlaidBikePins) map.set(pin.bikeId, pin);
  return map;
}, [overlaidBikePins]);
```

- [ ] **Step 4: Add the `[데모 시작/정지]` pill button in the toggle row**

Find the toggle row (it has `[지도 보기]` label + `<OverviewMapSearch>` + `[⛶ 전체화면]` button + count hint). Insert the new button BETWEEN the `[⛶ 전체화면]` button and the count hint span:

```tsx
<button
  type="button"
  className={fleetRunning ? "overview-map-fleet-toggle overview-map-fleet-toggle--active" : "overview-map-fleet-toggle"}
  onClick={() => setFleetRunning(!fleetRunning)}
  aria-pressed={fleetRunning}
  title={fleetRunning ? "데모 정지" : "데모 시작"}
>
  {fleetRunning ? "데모 정지" : "데모 시작"}
</button>
```

- [ ] **Step 5: Static checks**, exit 0.

- [ ] **Step 6: Commit**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain
git add development/front-admin-web/components/overview/OverviewMapBanner.tsx
git commit -m "Wire fleet simulation overlay + 데모 토글 into OverviewMapBanner

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Wire into `FullscreenMapHost` (same overlay + 데모 버튼 in header)

**Files:**
- Modify: `development/front-admin-web/components/overview/FullscreenMapHost.tsx`

- [ ] **Step 1: Add imports**

```tsx
import { useFleetSimulation } from "@/components/overview/FleetSimulationContext";
import { useSimulatedBikePins } from "@/components/overview/use-simulated-bike-pins";
```

- [ ] **Step 2: Inside `FullscreenMapOverlay` function body**, near the top with other hooks, add:

```tsx
const { fleetRunning, setFleetRunning, seedBikePins } = useFleetSimulation();
const overlaidBikePins = useSimulatedBikePins(bikePins);

useEffect(() => {
  seedBikePins(bikePins);
}, [bikePins, seedBikePins]);
```

- [ ] **Step 3: Use the overlaid pins everywhere `bikePins` is used** for marker rendering / lookups. Replace:

```tsx
const bikePinById = useMemo(() => {
  const map = new Map<string, FrontendDashboardBikePin>();
  for (const pin of bikePins) map.set(pin.bikeId, pin);
  return map;
}, [bikePins]);
```

with:

```tsx
const bikePinById = useMemo(() => {
  const map = new Map<string, FrontendDashboardBikePin>();
  for (const pin of overlaidBikePins) map.set(pin.bikeId, pin);
  return map;
}, [overlaidBikePins]);
```

Then in the `visibleBikePins` derivation (which currently filters `bikePins`), swap to `overlaidBikePins`:

Find:
```tsx
return bikePins.filter((pin) => allowedBikeIds.has(pin.bikeId));
```
Change to:
```tsx
return overlaidBikePins.filter((pin) => allowedBikeIds.has(pin.bikeId));
```

Also pass `overlaidBikePins` to `OverviewMapSearch` so search results match the latest simulated coordinates:

```tsx
<OverviewMapSearch
  bikePins={overlaidBikePins}
  stationPins={stationPins}
  ...
/>
```

- [ ] **Step 4: Add the `[데모 시작/정지]` pill in the header**, right after the `[필터]` button:

Find the header JSX with the close button + filter reopen button + search + counts. Insert AFTER the `<button ... className="...fullscreen-map-filter-reopen...">필터</button>` block:

```tsx
<button
  type="button"
  className={fleetRunning ? "fullscreen-map-fleet-toggle fullscreen-map-fleet-toggle--active" : "fullscreen-map-fleet-toggle"}
  onClick={() => setFleetRunning(!fleetRunning)}
  aria-pressed={fleetRunning}
  title={fleetRunning ? "데모 정지" : "데모 시작"}
>
  {fleetRunning ? "데모 정지" : "데모 시작"}
</button>
```

- [ ] **Step 5: Static checks**, exit 0.

- [ ] **Step 6: Commit**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain
git add development/front-admin-web/components/overview/FullscreenMapHost.tsx
git commit -m "Wire fleet simulation overlay + 데모 토글 into FullscreenMapHost

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: 배송 section in `VehicleDetailDialog` + telemetry overlay

**Files:**
- Modify: `development/front-admin-web/components/management/VehicleDetailDialog.tsx`

- [ ] **Step 1: Add imports**

```tsx
import { useFleetSimulation } from "@/components/overview/FleetSimulationContext";
import { useSimulatedCurrentTelemetry } from "@/components/overview/use-simulated-bike-pins";
import type { SimulatedBikeState } from "@/lib/services/fleet-simulation";
```

- [ ] **Step 2: Inside the main `VehicleDetailDialog` component**, near the existing hooks, derive `bikeId` (it already exists for the maintenance fetch — look for `vehicleIdForFetch`). Add:

```tsx
const { simulated, assignSingleBike, cancelSingleBike } = useFleetSimulation();
const simState: SimulatedBikeState | null = vehicleIdForFetch ? simulated.get(vehicleIdForFetch) ?? null : null;
```

- [ ] **Step 3: Overlay simulated current state on the bundle's currentState**

Find the existing `<TelemetrySection current={maintenance?.currentState ?? null} loading={maintenance === null} />` (or similar). Wrap the current value through the new overlay hook BEFORE passing it down. Add ABOVE the return:

```tsx
const overlaidCurrent = useSimulatedCurrentTelemetry(maintenance?.currentState ?? null, vehicleIdForFetch);
```

Then change the TelemetrySection prop:

```tsx
<TelemetrySection current={overlaidCurrent} loading={maintenance === null} />
```

- [ ] **Step 4: Add the 배송 section JSX** between the IMEI field grid and the existing TelemetrySection. Find the structure where `.vehicle-detail-view` wraps the three blocks (field grid, telemetry, maintenance, actions) and insert a new `<DeliverySection ... />`:

```tsx
<DeliverySection
  bikeId={vehicleIdForFetch ?? null}
  state={simState}
  onAssign={() => vehicleIdForFetch && assignSingleBike(vehicleIdForFetch)}
  onCancel={() => vehicleIdForFetch && cancelSingleBike(vehicleIdForFetch)}
/>
```

- [ ] **Step 5: Add the `DeliverySection` component** at the bottom of the file (near `TelemetrySection`):

```tsx
function DeliverySection({
  bikeId,
  state,
  onAssign,
  onCancel
}: {
  bikeId: string | null;
  state: SimulatedBikeState | null;
  onAssign: () => void;
  onCancel: () => void;
}) {
  if (!bikeId) return null;
  if (!state) {
    return (
      <section className="delivery-section">
        <h4>배송</h4>
        <p className="muted">현재 배정된 배송이 없습니다.</p>
        <button type="button" className="button-primary delivery-section-button" onClick={onAssign}>
          이 차량에 배정
        </button>
      </section>
    );
  }
  const phaseLabel = (() => {
    switch (state.phase) {
      case "IDLE": return "대기";
      case "ASSIGNED": return "배정 완료";
      case "EN_ROUTE": return "배송 중";
      case "ARRIVED": return "방금 도착";
    }
  })();
  const remainingMs = Math.max(0, state.phaseEndsAt - Date.now());
  const remainingLabel = formatRemaining(remainingMs);
  return (
    <section className="delivery-section">
      <h4>배송</h4>
      <dl className="delivery-meta">
        <div className="delivery-meta-row">
          <dt>상태</dt>
          <dd>{phaseLabel}</dd>
        </div>
        {state.destination ? (
          <div className="delivery-meta-row">
            <dt>목적지</dt>
            <dd>{state.destination.lat.toFixed(4)}, {state.destination.lng.toFixed(4)}</dd>
          </div>
        ) : null}
        {state.phase === "EN_ROUTE" ? (
          <>
            <div className="delivery-meta-row">
              <dt>남은 시간</dt>
              <dd>{remainingLabel}</dd>
            </div>
            <div className="delivery-meta-row">
              <dt>진행률</dt>
              <dd>{Math.round(state.progress * 100)}%</dd>
            </div>
          </>
        ) : null}
      </dl>
      {state.manualOrigin && state.phase !== "EN_ROUTE" ? (
        <button type="button" className="button-neutral delivery-section-button" onClick={onCancel}>
          배정 취소
        </button>
      ) : null}
    </section>
  );
}

function formatRemaining(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min > 0) return `${min}분 ${sec}초`;
  return `${sec}초`;
}
```

- [ ] **Step 6: Static checks**, exit 0.

- [ ] **Step 7: Commit**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain
git add development/front-admin-web/components/management/VehicleDetailDialog.tsx
git commit -m "Add 배송 section + simulated telemetry overlay in VehicleDetailDialog

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: CSS

**Files:**
- Modify: `development/front-admin-web/app/globals.css`

- [ ] **Step 1: Append styles for the new buttons + 배송 section**

```css
/* 데모 배송 시뮬레이션 — 토글 pill 두 곳. 인페이지 (`OverviewMapBanner`) 와
   전체화면 (`FullscreenMapHost`) 에서 같은 시각 패턴을 유지하되 각자의
   주변 컨테이너에 맞게 크기만 조정. active 상태는 강조 색으로 칠해
   운영자가 현재 데모 진행 여부를 한눈에 파악. */
.overview-map-fleet-toggle {
  height: 32px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid var(--rm-line-subtle);
  background: var(--rm-bg-panel-soft);
  color: var(--rm-text-primary);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
}
.overview-map-fleet-toggle:hover { background: var(--rm-bg-section); }
.overview-map-fleet-toggle--active {
  background: var(--rm-accent-soft, var(--rm-bg-section));
  border-color: var(--rm-accent-outline, var(--rm-line-subtle));
  color: var(--rm-accent, var(--rm-text-primary));
}

.fullscreen-map-fleet-toggle {
  height: 36px;
  padding: 0 14px;
  border-radius: 18px;
  border: 1px solid var(--rm-line-subtle);
  background: color-mix(in srgb, var(--rm-bg-panel-soft) 92%, transparent);
  color: var(--rm-text-primary);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  backdrop-filter: blur(8px);
  box-shadow: var(--shadow-panel);
}
.fullscreen-map-fleet-toggle:hover { background: var(--rm-bg-section); }
.fullscreen-map-fleet-toggle--active {
  background: var(--rm-accent-soft, var(--rm-bg-section));
  border-color: var(--rm-accent-outline, var(--rm-line-subtle));
  color: var(--rm-accent, var(--rm-text-primary));
}

/* 차량 상세 패널의 새 "배송" 섹션 — 텔레메트리 섹션 위에 위치. 정비 섹션과
   같은 띠 톤(top border, h4 크기) 으로 한 덩어리로 읽히도록. */
.delivery-section { margin-top: 8px; padding-top: 12px; border-top: 1px solid var(--rm-line-subtle); }
.delivery-section h4 { margin: 0 0 8px; font-size: 13px; font-weight: 700; color: var(--color-text-muted); letter-spacing: .02em; }
.delivery-meta { margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.delivery-meta-row {
  display: grid;
  grid-template-columns: 80px minmax(0, 1fr);
  align-items: center;
  column-gap: 8px;
  font-size: 12px;
}
.delivery-meta-row dt { margin: 0; color: var(--color-text-muted); font-weight: 600; }
.delivery-meta-row dd { margin: 0; color: var(--color-text-primary); font-variant-numeric: tabular-nums; }
.delivery-section-button { margin-top: 8px; }
```

- [ ] **Step 2: Static checks**, exit 0.

- [ ] **Step 3: Commit**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain
git add development/front-admin-web/app/globals.css
git commit -m "Style the fleet toggle pills + delivery section

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Full static-check sweep + optional build

- [ ] **Step 1: typecheck**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web
npm run typecheck
```

Expected exit 0.

- [ ] **Step 2: lint**

```bash
npm run lint
```

Expected exit 0.

- [ ] **Step 3: optional `next build`** to catch CSS / SSR issues

```bash
npm run build
```

Expected exit 0.

---

## Task 11: Manual smoke

The user runs their own dev server. **Do not start a competing one.**

- [ ] **Step 1: Open `/` in the browser, click `[데모 시작]`** in the toggle row. Within 30 seconds, observe at least one bike marker move from its initial position toward a random Seoul-box destination.

- [ ] **Step 2: Open a moving bike's detail panel** (click the marker or row). Confirm:
  - 배송 section shows `상태: 배송 중`, 목적지 lat/lng, 남은 시간 카운트다운, 진행률 %
  - 텔레메트리 section's `시동` is ON, `현재 속도` shows ~30, `누적 주행거리` increases, 마지막 수신 stays "방금 전"

- [ ] **Step 3: Wait ~5 minutes for one cycle to complete** (or click on a bike whose phaseEndsAt is close). Verify `상태: 방금 도착` appears, then within 10s the bike enters IDLE then ASSIGNED again with a new destination.

- [ ] **Step 4: Toggle `[데모 정지]`**. Bikes that are EN_ROUTE finish their current cycle and return to deterministic state (stop moving).

- [ ] **Step 5: With fleet off, click `[이 차량에 배정]`** in a single bike's detail panel. That bike starts a one-shot cycle. After ARRIVED + 10s it stops; other bikes stay still.

- [ ] **Step 6: Toggle from fullscreen mode**. Open fullscreen, click `[데모 시작]` in the header. Bikes start moving. ESC closes fullscreen → bikes keep moving (state in shared context).

- [ ] **Step 7: Confirm static checks one more time** (`npm run typecheck`, `npm run lint`) after any inline tweaks.

---

## Task 12: PR

- [ ] **Step 1: Push branch**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain
git push -u origin cc-222-fleet-delivery-simulation-design
```

- [ ] **Step 2: Create PR**

```bash
gh pr create --base dev --head cc-222-fleet-delivery-simulation-design \
  --title "Add fleet delivery simulation with per-vehicle assign button" \
  --body "$(cat <<'EOF'
## Summary
- 새 `FleetSimulationContext` provider — 모든 등록 차량을 IDLE → ASSIGNED → EN_ROUTE → ARRIVED → IDLE 사이클로 무한 루프
- `[데모 시작/정지]` 토글 두 곳: 루트 `/` 의 `OverviewMapBanner` 토글 행 + 전체화면 헤더
- `[이 차량에 배정]` 단일 차량 버튼 — 차량 상세 floating 패널의 새 \"배송\" 섹션, fleet 모드와 독립적으로 한 사이클 실행
- 1초 tick 으로 lat/lng (origin→destination 보간), 시동, 속도, 누적 odometer, 배터리, 마지막 수신 시각이 모두 시뮬레이트
- 두 overlay hook (`useSimulatedBikePins`, `useSimulatedCurrentTelemetry`) 으로 deterministic dummy 위에 live simulation 적용 — fleet OFF + manual 0대면 비용 0

## Spec & Plan
- 디자인: `docs/superpowers/specs/2026-05-25-fleet-delivery-simulation-design.md`
- 플랜: `docs/superpowers/plans/2026-05-25-fleet-delivery-simulation.md`

## Test plan
- [x] \`npm run typecheck\`
- [x] \`npm run lint\`
- [ ] 데모 시작 → 30초 내 차량들이 staggered 시점에 출발
- [ ] 이동 중 차량 상세 → 배송 section 의 ETA 카운트다운, 텔레메트리 section 의 odometer 증가
- [ ] ~5분 후 ARRIVED → 10초 후 새 사이클
- [ ] 데모 정지 → EN_ROUTE 마치고 deterministic 복귀
- [ ] 단일 차량 배정 → fleet OFF 에서도 한 사이클 실행 후 종료
- [ ] 전체화면 헤더 토글도 동일 context 공유

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL printed.

---

## Self-Review

**Spec coverage** — checked each section of `docs/superpowers/specs/2026-05-25-fleet-delivery-simulation-design.md`:

- "Simulation engine — types + tick advance" → Task 2.
- "FleetSimulationContext provider + tick loop" → Task 3.
- "Phase durations + transitions" → Task 2 (`advanceBikeState` switch).
- "Fleet startup behavior (seed + staggered)" → Task 3 (`setFleetRunning(true)` body + `makeInitialState` with random stagger).
- "Manual single-bike assignment" → Task 3 (`assignSingleBike` + `manualOrigin` flag preserved across fleet off in `useEffect` cleanup).
- "Overriding deterministic dummy state" → Task 5 (both hooks).
- "UI trigger placement (in-page + fullscreen)" → Tasks 6 & 7.
- "Per-vehicle assignment button + 배송 section UI" → Task 8 (`DeliverySection`).
- "Phase-dependent panel content (배송 중 / 방금 도착)" → Task 8 (`DeliverySection` switch on `state.phase`).
- "Departure signal is implicit in 배송 중 phase display" → Task 8 (no separate toast — covered by section state).
- "Provider wrap in OverviewClientShell" → Task 4.

**Placeholder scan** — no "TODO", "TBD", "implement later", or "similar to Task N" references. Each code block is concrete.

**Type consistency:**
- `SimulatedBikeState` shape defined in Task 2; imported and read in Tasks 3, 5, 8.
- `makeInitialState({phase: "IDLE"|"ASSIGNED", manualOrigin, staggerMs?})` signature in Task 2; called consistently in Task 3 with matching keys.
- `useFleetSimulation()` return shape `{ fleetRunning, setFleetRunning, simulated, assignSingleBike, cancelSingleBike, seedBikePins }` defined in Task 3; consumed in Tasks 6, 7, 8 with matching destructure.
- `useSimulatedBikePins(rawPins)` returns `FrontendDashboardBikePin[]`; consumed as such in Tasks 6, 7.
- `useSimulatedCurrentTelemetry(rawCurrent, bikeId)` returns `VehicleCurrentTelemetrySummary | null`; consumed in Task 8 via `overlaidCurrent`.
- `VehicleCurrentTelemetrySummary` import path: `@/lib/services/vehicle-maintenance-data` (matches existing exports in that file).

**Scope** — single PR, ~7 modified files + 3 new files, no backend changes, no test runner additions.
