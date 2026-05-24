# Fleet Delivery Simulation — Design

## Goal

Add a frontend-only demo simulator that drives ALL registered vehicles
through a delivery lifecycle (IDLE → ASSIGNED → EN_ROUTE → ARRIVED →
IDLE → …) on an infinite loop while an operator toggles "데모 시작" on
or off. Each vehicle independently moves on the map, sends synthetic
departure signals + ETA updates, and shows its current delivery state
in the floating detail panel.

Also add a single-vehicle `[이 차량에 배정]` button on the floating
detail panel that manually starts one vehicle's delivery cycle — used
when an operator wants to demo just one bike without firing the whole
fleet.

The simulator is pure client-side — no backend changes. It overrides
the existing deterministic `simulateBikeTelemetry` outputs when active,
and falls back to that deterministic state when off.

## Non-Goals

- No backend involvement (no telemetry ingest API calls, no real
  routes, no real ETA computation engine).
- No actual routing engine — destinations are random points within the
  Seoul box; routes are straight-line lerps.
- No persistence — toggling off / page reload returns everything to
  the default deterministic dummy state.
- No "TM 센터에서 전화 걸기" UX (the spec image mentions a future
  follow-up where TM center calls the next customer). This PR ships
  the data layer + status display; the call action is out of scope.
- No multi-stop deliveries — one bike = one current destination at a
  time.

## Architecture

### Simulation engine — a single client-side ticking source of truth

A new module `lib/services/fleet-simulation.ts` (data + types) plus
`components/overview/FleetSimulationContext.tsx` (React context +
provider with the running tick).

```ts
export type DeliveryPhase = "IDLE" | "ASSIGNED" | "EN_ROUTE" | "ARRIVED";

export type SimulatedBikeState = {
  bikeId: string;
  phase: DeliveryPhase;
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number } | null;
  /** EN_ROUTE 진행률 0..1 */
  progress: number;
  /** 현재 lat/lng (origin → destination lerp 결과, 또는 phase 별 고정값) */
  position: { lat: number; lng: number };
  /** 현재 phase 가 시작된 시각 (ms) */
  phaseStartedAt: number;
  /** 이 phase 가 끝날 예정 시각 (ms) */
  phaseEndsAt: number;
  /** 현재 phase 의 보조 값 */
  speedKph: number;
  ignitionStatus: "ON" | "OFF";
  odometerKm: number;
  batteryPercent: number;
};

export type FleetSimulationContextValue = {
  fleetRunning: boolean;
  setFleetRunning: (running: boolean) => void;
  /** bikeId → 시뮬레이트된 상태. fleet OFF + 수동 배정 0대 면 빈 Map. */
  simulated: Map<string, SimulatedBikeState>;
  /** 수동 단일 차량 배정 트리거. fleet OFF 여도 작동. */
  assignSingleBike: (bikeId: string) => void;
};
```

### Tick loop

- A `useEffect` inside the provider starts a `setInterval` with a
  `TICK_INTERVAL_MS = 1000` (1 second) cadence as long as either
  `fleetRunning` is true OR there exists at least one manually-assigned
  bike. The interval is cleared otherwise to avoid background work.
- Each tick advances every entry in `simulated`:
  - If `Date.now() >= phaseEndsAt`: transition to next phase
  - If phase is `EN_ROUTE`: update `position` via lerp + `progress`,
    update `odometerKm`, drop `batteryPercent` 0.05 per tick

### Phase durations + transitions

| From | To | Duration | What changes |
| ---- | -- | -------- | ------------ |
| `IDLE` | `ASSIGNED` | staggered 0–30s random (fleet mode only); immediate (manual) | destination gets random point; ignition stays OFF |
| `ASSIGNED` | `EN_ROUTE` | 5s | ignition flips ON, speedKph picks ~30 |
| `EN_ROUTE` | `ARRIVED` | 5 minutes (300s) | lerp position over the 5 min; speedKph ~30; odometer +(distance / 300) per second |
| `ARRIVED` | `IDLE` | 10s | ignition OFF, speedKph 0 |
| `IDLE` | `ASSIGNED` | only re-fires if `fleetRunning` is true; manually-assigned bike returns to deterministic state | |

### Fleet startup behavior

When `setFleetRunning(true)` is called:
- For each registered vehicle that has a bike id, the provider seeds
  an entry in `simulated` with phase `IDLE` and a random
  `phaseEndsAt` between `now` and `now + 30000` (so the 20 vehicles
  start their first ASSIGNED at staggered times — the map doesn't
  show a synchronized lockstep departure).
- The origin is read from the existing
  `simulateBikeTelemetry(bikeId).latitude/longitude` so the bike
  "starts" where the static dummy says it is.

When `setFleetRunning(false)` is called:
- All bikes that were ONLY in fleet sim are removed from
  `simulated`. Manually-assigned bikes (kept track via a separate
  flag) keep going through their current cycle until ARRIVED, then
  return to deterministic state.

### Manual single-bike assignment

`assignSingleBike(bikeId)` adds an entry to `simulated` with phase
`ASSIGNED`, marked with a `manualOrigin: true` flag so it survives a
fleet stop. If the bike is already in `simulated` (e.g. fleet is
running), the call is a no-op (no double-assignment).

### Overriding deterministic dummy state

`dashboard-dummy-bikes.ts` already exposes
`simulateBikeTelemetry(bikeId)` and
`simulateBikeCurrentTelemetrySummary(bikeId)`. Two new hooks compose
the deterministic baseline with the live `simulated` map:

```ts
// In OverviewMapBanner / FullscreenMapHost
const enrichedBikePins = useSimulatedBikePins(rawBikePins, simulated);
// In VehicleDetailDialog (via the bundle loader path)
const enrichedCurrent = useSimulatedCurrentTelemetry(rawCurrent, bikeId, simulated);
```

`useSimulatedBikePins` walks `rawBikePins`, and for any bike that has
a `SimulatedBikeState`, replaces `latitude / longitude / speedKph /
ignitionStatus / batteryPercent / lastReceivedAt / connectionStatus`
with the simulated values. `useSimulatedCurrentTelemetry` does the
same for the per-bike telemetry summary used in the detail panel.

### UI surfaces

#### Trigger placement
- `OverviewMapBanner` toggle row gets a new `[데모 시작]` / `[데모 정지]`
  pill button (active style when running).
- `FullscreenMapHost` header gets the same pill next to the existing
  `[필터]` button.
- Both call the shared context setter — toggling from either place
  reflects everywhere.

#### Per-vehicle assignment button
- Inside `VehicleDetailDialog`, a new "배송" section directly above the
  "텔레메트리" section.
- Contents (state-dependent):
  - `phase` undefined / not in `simulated`: a `[이 차량에 배정]` button
  - `phase = ASSIGNED`: shows destination + estimated distance + ETA;
    button replaced with `[배정 취소]`
  - `phase = EN_ROUTE`: shows "🚚 배송 중 — 남은 시간 N분 X초 / 진행률
    Y%"; no button
  - `phase = ARRIVED`: shows "✓ 방금 도착" + button `[새 배정]` (or
    auto-clears in 10s)

#### Departure signal display
- When a bike transitions ASSIGNED → EN_ROUTE, no UI toast is fired
  (out of scope). The signal is implicit in the panel's "🚚 배송 중"
  state.
- The "ETA 송신" semantic is satisfied by the panel showing the ETA
  countdown — that's the signal operators see.

### State flow summary

```
┌─────────────────────────────────────────────────┐
│ FleetSimulationContext (provider, holds state)  │
│   - fleetRunning: bool                          │
│   - simulated: Map<bikeId, SimulatedBikeState>  │
│   - tick(): every 1s, advances all entries      │
└────┬─────────────────────────┬──────────────────┘
     │                         │
     ▼                         ▼
[OverviewMapBanner]       [VehicleDetailDialog]
[FullscreenMapHost]       - reads simulated[bikeId]
- toggle button           - shows phase + ETA
- enriches bikePins
  with simulated state
```

## User-visible behavior

- `/` or fullscreen: a `[데모 시작]` pill in the toggle row / header.
  Click → button label becomes `[데모 정지]` with active style.
- Within 0–30s of toggling on, each of the N registered vehicles
  picks a random destination, flips ignition ON, and starts moving.
- Markers on the map slide from their origin toward their
  destination over 5 minutes (linear interpolation).
- Vehicle detail panel (for any bike) updates in real time: ETA
  counts down, odometer increases, battery slowly drops, last
  received time stays "방금 전".
- After 5 minutes of motion, the bike reaches its destination —
  panel says "방금 도착", marker stops.
- After ~10s rest, the bike picks a new random destination and starts
  again.
- `[데모 정지]` click stops the cycle — bikes finish their current
  EN_ROUTE / ARRIVED phase, then return to the deterministic dummy
  state. Manually-assigned bikes (single button path) keep going
  through their current cycle.
- `[이 차량에 배정]` on the detail panel triggers a single-bike
  assignment independently of fleet mode. After the bike completes
  its ARRIVED phase, it returns to deterministic.

## Error handling & edge cases

- **Vehicle with no bike pin (no deterministic origin)**: skipped at
  fleet startup — fleet sim only animates bikes that have a known
  position to lerp from.
- **Fleet starts then user reloads**: simulation is client-only and
  in-memory; reload returns to deterministic state. No persistence.
- **Manually-assigned bike during fleet running**: the manual call is
  a no-op if the bike is already in `simulated` from the fleet path;
  the fleet cycle continues.
- **Marker selected during animation**: `selectedBikeId` channel is
  unaffected. Detail dialog re-renders on each tick so the panel
  stays in sync.
- **Page navigation to a different route**: the provider unmounts and
  the tick loop is cleared. Re-entering the page re-mounts and
  defaults to `fleetRunning: false`.

## Testing

The repo has no test runner — verification = `npm run typecheck` +
`npm run lint` + a manual smoke checklist:

- Toggle fleet on / observe bikes start staggered EN_ROUTE within 30s.
- Open a vehicle detail panel during EN_ROUTE — verify ETA counts
  down, odometer increases, ignition reads ON.
- Wait 5 minutes — at least one bike reaches ARRIVED, panel shows
  "방금 도착".
- Toggle fleet off — bikes finish current cycle and stop.
- Manually click `[이 차량에 배정]` while fleet is off — that one bike
  starts a 5-minute cycle.
- Static checks pass.

## Out-of-scope follow-ups

- Real route polylines drawn on the map (currently straight-line
  lerp).
- Multi-stop deliveries.
- TM 센터 → 고객 자동 전화 (UI button + backend handoff).
- ETA recomputation against real traffic data.
- Per-vehicle delivery history / log.
- Persistence of simulation across reloads.
