# OSRM Road Routing + Delivery Status Labels (PR-C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace straight-line lerp movement with real Seoul road routes (OSRM) during EN_ROUTE, and add delivery status badges (배정됨 / 배송 중 / 배송 완료) on map markers.

**Architecture:** A new pure `fetchOsrmRoute` service fetches GeoJSON polylines from the public OSRM demo server. `SimulatedBikeState` gains a `routeWaypoints` field; the context watches `simulated` for newly-ASSIGNED bikes and injects routes asynchronously. `advanceBikeState` uses `walkPolyline` (time-proportional polyline walk) when waypoints are available, falling back to the existing `lerpPosition` if not. `useSimulatedBikePins` adds a `deliveryPhase` field so `MapShell` can render per-marker status badges.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, public OSRM API (`router.project-osrm.org`). No new runtime deps. No backend changes.

**Reference doc:** `docs/superpowers/specs/2026-05-25-osrm-road-routing-design.md`

---

## File Structure

| Path | Purpose | Action |
| ---- | ------- | ------ |
| `lib/services/osrm.ts` | Pure async OSRM fetch function with error → empty-array fallback | **Create** |
| `lib/services/fleet-simulation.ts` | Add `routeWaypoints` field, `walkPolyline` fn, use in `advanceBikeState`, init in `makeInitialState` | **Modify** |
| `components/overview/FleetSimulationContext.tsx` | `pendingFetchesRef` + `useEffect` to fire OSRM fetch on ASSIGNED transition | **Modify** |
| `components/overview/use-simulated-bike-pins.ts` | Export `SimulatedBikePin` type, add `deliveryPhase` overlay | **Modify** |
| `components/dashboard/MapShell.tsx` | Accept extended `bikePins` type, add `deliveryBadgeMarkup`, extend `bikeMarkerHtml` | **Modify** |

---

## Task 1: Branch sanity check

**Files:** none

- [ ] **Step 1: Verify branch + spec**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain
git status
git log --oneline -3
ls docs/superpowers/specs/2026-05-25-osrm-road-routing-design.md
ls docs/superpowers/plans/2026-05-25-osrm-road-routing.md
```

Expected: branch `cc-226-osrm-road-routing`, recent commit is the spec commit `96eb894`. Working tree clean. Both doc files exist.

---

## Task 2: Create `lib/services/osrm.ts`

**Files:**
- Create: `development/front-admin-web/lib/services/osrm.ts`

- [ ] **Step 1: Create the file**

```ts
/**
 * OSRM public demo 서버에서 두 좌표 간 도로 경로를 fetch.
 *
 * 반환: 경유점 배열 ({lat, lng}[]). 실패(네트워크 오류, timeout, 4xx/5xx)
 * 시 빈 배열 반환 — 호출부는 빈 배열을 받으면 routeWaypoints 를 null 로
 * 유지해 직선 lerp fallback 으로 처리한다.
 *
 * OSRM 좌표 순서는 [lng, lat] — 반환 시 {lat, lng} 로 변환.
 * `AbortSignal.timeout` 은 Node 17.3+ / 모던 브라우저에서 지원.
 */
export async function fetchOsrmRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<ReadonlyArray<{ lat: number; lng: number }>> {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${origin.lng},${origin.lat};${destination.lng},${destination.lat}` +
    `?overview=full&geometries=geojson`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      routes?: Array<{
        geometry?: { coordinates?: Array<[number, number]> };
      }>;
    };
    const coords = json.routes?.[0]?.geometry?.coordinates ?? [];
    return coords.map(([lng, lat]) => ({ lat, lng }));
  } catch {
    return [];
  }
}
```

- [ ] **Step 2: Static checks**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web
npm run typecheck
npm run lint
```

Both must exit 0.

- [ ] **Step 3: Commit**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain
git add development/front-admin-web/lib/services/osrm.ts
git commit -m "Add fetchOsrmRoute service for road-following paths

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Extend `fleet-simulation.ts`

**Files:**
- Modify: `development/front-admin-web/lib/services/fleet-simulation.ts`

This task makes four targeted edits:
1. Add `routeWaypoints` field to `SimulatedBikeState` type
2. Add `walkPolyline` helper function after `lerpPosition`
3. Modify EN_ROUTE within-phase position update to use `walkPolyline` when waypoints are present
4. Add `routeWaypoints: null` to IDLE→ASSIGNED, EN_ROUTE→ARRIVED, ARRIVED→IDLE transitions, and both `makeInitialState` returns

- [ ] **Step 1: Read the file to confirm current line numbers**

```bash
grep -n "routeWaypoints\|manualOrigin\|lerpPosition\|walkPolyline\|case \"IDLE\"\|case \"EN_ROUTE\"\|case \"ARRIVED\"\|makeInitialState" C:/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web/lib/services/fleet-simulation.ts
```

Confirm: no `routeWaypoints` yet, `manualOrigin` is the last field in `SimulatedBikeState` (~line 33), `lerpPosition` ends ~line 81.

- [ ] **Step 2: Add `routeWaypoints` field to `SimulatedBikeState`**

In the `SimulatedBikeState` type, after the `manualOrigin` field (currently line 33):

```ts
  /** 운영자가 단일 차량 수동 배정으로 만든 entry 인지. fleet 정지 후에도 살아 있는다. */
  manualOrigin: boolean;
  /**
   * OSRM 경로 waypoints. ASSIGNED 진입 시 fetch, EN_ROUTE 중 이동 경로 결정.
   * null = 아직 경로 없음 또는 fetch 실패 → 직선 lerp fallback.
   */
  routeWaypoints: ReadonlyArray<{ lat: number; lng: number }> | null;
```

- [ ] **Step 3: Add `walkPolyline` after `lerpPosition`**

After the closing `}` of `lerpPosition` (currently ~line 81), insert:

```ts

/**
 * progress t (0..1) 로 polyline 위 좌표를 계산.
 * N 개 waypoint → N-1 세그먼트를 시간 균등 분배:
 *   t=0 → waypoints[0], t=1 → waypoints[N-1].
 * 1개 이하면 첫 번째(또는 서울 기본) 좌표 반환.
 */
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
```

- [ ] **Step 4: Modify EN_ROUTE within-phase position update**

Find the EN_ROUTE within-phase section (currently ~lines 98-116). The line:
```ts
    const position = lerpPosition(prev.origin, prev.destination, progress);
```

Replace with:
```ts
    const position = prev.routeWaypoints
      ? walkPolyline(prev.routeWaypoints, progress)
      : lerpPosition(prev.origin, prev.destination, progress);
```

- [ ] **Step 5: Add `routeWaypoints: null` to phase transitions**

**IDLE → ASSIGNED** (currently ~lines 126-136): add `routeWaypoints: null` after `ignitionStatus: "OFF"`:

```ts
      return {
        ...prev,
        phase: "ASSIGNED",
        destination,
        progress: 0,
        position: prev.origin,
        phaseStartedAt: nowMs,
        phaseEndsAt: nowMs + ASSIGNED_DURATION_MS,
        speedKph: 0,
        ignitionStatus: "OFF",
        routeWaypoints: null
      };
```

**EN_ROUTE → ARRIVED** (currently ~lines 152-164): add `routeWaypoints: null` after `ignitionStatus: "OFF"`:

```ts
      return {
        ...prev,
        phase: "ARRIVED",
        progress: 1,
        position: finalPosition,
        origin: finalPosition,
        destination: null,
        phaseStartedAt: nowMs,
        phaseEndsAt: nowMs + ARRIVED_DURATION_MS,
        speedKph: 0,
        ignitionStatus: "OFF",
        routeWaypoints: null
      };
```

**ARRIVED → IDLE** (currently ~lines 169-178): add `routeWaypoints: null` after `ignitionStatus: "OFF"`:

```ts
      return {
        ...prev,
        phase: "IDLE",
        progress: 0,
        phaseStartedAt: nowMs,
        phaseEndsAt: idleWindow === Number.POSITIVE_INFINITY ? Number.POSITIVE_INFINITY : nowMs + idleWindow,
        speedKph: 0,
        ignitionStatus: "OFF",
        routeWaypoints: null
      };
```

- [ ] **Step 6: Add `routeWaypoints: null` to `makeInitialState`**

`makeInitialState` has two return statements — the ASSIGNED path (~lines 211-225) and the IDLE path (~lines 228-242). Add `routeWaypoints: null` to both, after `manualOrigin`:

ASSIGNED path:
```ts
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
      manualOrigin,
      routeWaypoints: null
    };
```

IDLE path:
```ts
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
    manualOrigin,
    routeWaypoints: null
  };
```

- [ ] **Step 7: Static checks**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web
npm run typecheck
npm run lint
```

Both must exit 0. Fix any issues (likely missing `routeWaypoints` in some spread).

- [ ] **Step 8: Commit**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain
git add development/front-admin-web/lib/services/fleet-simulation.ts
git commit -m "fleet-simulation: add routeWaypoints field and walkPolyline for road routing

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: OSRM fetch trigger in `FleetSimulationContext.tsx`

**Files:**
- Modify: `development/front-admin-web/components/overview/FleetSimulationContext.tsx`

- [ ] **Step 1: Read the file**

Read `C:/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web/components/overview/FleetSimulationContext.tsx` fully (177 lines).

- [ ] **Step 2: Add the import**

After the existing imports at the top of the file, add:

```tsx
import { fetchOsrmRoute } from "@/lib/services/osrm";
```

- [ ] **Step 3: Add `pendingFetchesRef` inside `FleetSimulationProvider`**

Inside the `FleetSimulationProvider` component body, near the other `useRef` calls:

```tsx
/**
 * OSRM fetch 중인 bikeId Set. 동일 bike 에 중복 fetch 방지.
 * ref 라 React 렌더를 트리거하지 않음.
 */
const pendingFetchesRef = useRef<Set<string>>(new Set());
```

- [ ] **Step 4: Add the OSRM fetch `useEffect`**

After the existing tick `useEffect` (the `setInterval` effect), add a new effect:

```tsx
// ASSIGNED 상태이면서 routeWaypoints 가 아직 없는 bike 를 발견하면
// OSRM 경로를 fetch 해서 state 에 주입. pendingFetchesRef 로 중복 방지.
useEffect(() => {
  for (const [bikeId, state] of simulated) {
    if (
      state.phase !== "ASSIGNED" ||
      state.routeWaypoints !== null ||
      pendingFetchesRef.current.has(bikeId)
    ) {
      continue;
    }
    if (!state.destination) continue; // ASSIGNED 에서 destination 은 항상 있지만 타입 guard

    pendingFetchesRef.current.add(bikeId);
    fetchOsrmRoute(state.origin, state.destination).then((waypoints) => {
      pendingFetchesRef.current.delete(bikeId);
      if (waypoints.length === 0) return; // 빈 배열 = 실패 → null 유지, 직선 fallback
      setSimulated((prev) => {
        const current = prev.get(bikeId);
        // stale guard: bike 가 이미 IDLE 로 돌아갔으면 주입 무시
        if (!current || current.phase === "IDLE") return prev;
        const next = new Map(prev);
        next.set(bikeId, { ...current, routeWaypoints: waypoints });
        return next;
      });
    });
  }
}, [simulated]);
```

- [ ] **Step 5: Static checks**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web
npm run typecheck
npm run lint
```

Both must exit 0. If ESLint flags the `for...of` with `continue` pattern, note that the existing codebase (FleetSimulationContext tick loop) already uses this pattern — it is lint-approved.

- [ ] **Step 6: Commit**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain
git add development/front-admin-web/components/overview/FleetSimulationContext.tsx
git commit -m "FleetSimulationContext: fetch OSRM route on ASSIGNED and inject into state

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Add `deliveryPhase` overlay to `use-simulated-bike-pins.ts`

**Files:**
- Modify: `development/front-admin-web/components/overview/use-simulated-bike-pins.ts`

Current file (75 lines): `useSimulatedBikePins` returns `FrontendDashboardBikePin[]`. We extend the return type to include `deliveryPhase`.

- [ ] **Step 1: Add the import and export the new type**

After existing imports at the top of the file (currently lines 1-7), add:

```ts
import type { DeliveryPhase } from "@/lib/services/fleet-simulation";

/**
 * MapShell / OverviewMapSearch 에 전달하는 클라이언트 전용 확장 타입.
 * FrontendDashboardBikePin 위에 deliveryPhase 를 overlay 한다.
 */
export type SimulatedBikePin = FrontendDashboardBikePin & {
  deliveryPhase: DeliveryPhase | null;
};
```

- [ ] **Step 2: Change `useSimulatedBikePins` return type and body**

Replace the entire `useSimulatedBikePins` function (lines 15-43) with:

```ts
export function useSimulatedBikePins(
  rawPins: ReadonlyArray<FrontendDashboardBikePin>
): SimulatedBikePin[] {
  const { simulated } = useFleetSimulation();
  return useMemo(() => {
    if (simulated.size === 0) {
      return rawPins.map((pin) => ({ ...pin, deliveryPhase: null }));
    }
    const nowIso = new Date().toISOString();
    return rawPins.map((pin) => {
      const sim = simulated.get(pin.bikeId);
      if (!sim) return { ...pin, deliveryPhase: null };
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
        deliveryPhase: sim.phase
      };
    });
  }, [rawPins, simulated]);
}
```

Leave `useSimulatedCurrentTelemetry` (lines 50-74) completely untouched.

- [ ] **Step 3: Static checks**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web
npm run typecheck
npm run lint
```

Both must exit 0. TypeScript will verify that `SimulatedBikePin[]` is assignable to existing consumers (`MapShell.bikePins`, `OverviewMapSearch.bikePins`) — since `SimulatedBikePin extends FrontendDashboardBikePin`, structural compatibility holds. If any consumer errors, check whether its prop type needs updating (covered in Task 6 for MapShell).

- [ ] **Step 4: Commit**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain
git add development/front-admin-web/components/overview/use-simulated-bike-pins.ts
git commit -m "useSimulatedBikePins: overlay deliveryPhase for map marker badges

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Add delivery status badge to `MapShell.tsx`

**Files:**
- Modify: `development/front-admin-web/components/dashboard/MapShell.tsx`

- [ ] **Step 1: Add the import**

Near the top of the file, after existing imports, add:

```tsx
import type { DeliveryPhase } from "@/lib/services/fleet-simulation";
```

- [ ] **Step 2: Extend `MapShellProps.bikePins` type**

`MapShellProps.bikePins` is currently (line 70):
```ts
  bikePins?: FrontendDashboardBikePin[];
```

Change to:
```ts
  bikePins?: Array<FrontendDashboardBikePin & { deliveryPhase?: DeliveryPhase | null }>;
```

This is backward compatible: `FrontendDashboardBikePin[]` still satisfies the new type (optional field can be absent), and `SimulatedBikePin[]` (from Task 5) satisfies it too.

- [ ] **Step 3: Add `deliveryBadgeMarkup` helper**

After the `labelMarkup` function (currently lines 553-560), add:

```ts
/**
 * 배송 상태 배지 HTML. IDLE 이면 빈 문자열.
 * 마커 컨테이너(relative 28×28) 아래에 absolute 로 위치 — 아이콘 밑에 노출.
 */
function deliveryBadgeMarkup(phase: DeliveryPhase): string {
  if (phase === "IDLE") return "";
  const config: Record<Exclude<DeliveryPhase, "IDLE">, { text: string; bg: string }> = {
    ASSIGNED: { text: "배정됨", bg: "#f59e0b" },
    EN_ROUTE: { text: "배송 중", bg: "#3b82f6" },
    ARRIVED: { text: "배송 완료", bg: "#22c55e" }
  };
  const { text, bg } = config[phase];
  return (
    `<div style="position:absolute;top:100%;left:50%;transform:translateX(-50%);` +
    `margin-top:2px;padding:1px 5px;border-radius:3px;font-size:9px;font-weight:600;` +
    `color:#fff;white-space:nowrap;background:${bg};pointer-events:none;">` +
    `${text}</div>`
  );
}
```

- [ ] **Step 4: Modify `bikeMarkerHtml` to accept and render the badge**

Replace the current `bikeMarkerHtml` (lines 606-610):

```ts
function bikeMarkerHtml(plateNumber: string, showLabel: boolean): string {
  const wrapped = markerWrapper(bikeIconSvg(), "--rm-accent");
  if (!showLabel) return wrapped;
  return `<div style="position:relative;pointer-events:auto;width:${ICON_PX}px;height:${ICON_PX}px;">${labelMarkup(plateNumber)}${wrapped}</div>`;
}
```

With:

```ts
function bikeMarkerHtml(
  plateNumber: string,
  showLabel: boolean,
  deliveryPhase?: DeliveryPhase | null
): string {
  const wrapped = markerWrapper(bikeIconSvg(), "--rm-accent");
  const badge = deliveryPhase ? deliveryBadgeMarkup(deliveryPhase) : "";
  if (!showLabel && !badge) return wrapped;
  return (
    `<div style="position:relative;pointer-events:auto;width:${ICON_PX}px;height:${ICON_PX}px;">` +
    `${showLabel ? labelMarkup(plateNumber) : ""}${wrapped}${badge}` +
    `</div>`
  );
}
```

- [ ] **Step 5: Pass `deliveryPhase` in the marker creation loop**

In the marker creation loop (~lines 418-445), find:

```ts
      const html = bikeMarkerHtml(pin.pinLabel ?? pin.plateNumber, showLabel);
```

Change to:

```ts
      const html = bikeMarkerHtml(pin.pinLabel ?? pin.plateNumber, showLabel, pin.deliveryPhase);
```

`pin` is now typed as `FrontendDashboardBikePin & { deliveryPhase?: DeliveryPhase | null }` (from the updated `MapShellProps`), so `pin.deliveryPhase` is type-safe.

- [ ] **Step 6: Static checks**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web
npm run typecheck
npm run lint
```

Both must exit 0.

- [ ] **Step 7: Commit**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain
git add development/front-admin-web/components/dashboard/MapShell.tsx
git commit -m "MapShell: add delivery status badge on bike markers

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Full static-check sweep

- [ ] **Step 1: typecheck**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web
npm run typecheck
```

Expected: exit 0, no errors.

- [ ] **Step 2: lint**

```bash
npm run lint
```

Expected: exit 0, no warnings.

---

## Task 8: Manual smoke

The user runs their own dev server on localhost. **Do not** start a competing one.

- [ ] **Step 1: Fleet OFF baseline**

Open `/`. Map shows 2 real bike markers with no delivery badges. Normal behavior.

- [ ] **Step 2: 데모 시작 → ASSIGNED badge**

Click `[데모 시작]`. Within 5 seconds, virtual bike markers should show `배정됨` (amber) badge. Check the browser Network tab — OSRM requests to `router.project-osrm.org` appear for each bike.

- [ ] **Step 3: EN_ROUTE → road movement + 배송 중 badge**

After ~5 seconds (ASSIGNED phase), markers should:
- Switch to `배송 중` (blue) badge
- Begin moving — **following Seoul roads** rather than flying in a straight line
- Open the browser Network tab and confirm each bike made an OSRM request returning coordinates

Compare with PR-A/B behavior: bikes should visibly curve around streets rather than cutting across buildings.

- [ ] **Step 4: ARRIVED badge**

After 5 minutes (EN_ROUTE), markers should show `배송 완료` (green) badge for ~10 seconds, then badge disappears (IDLE). Verify the cycle repeats.

- [ ] **Step 5: OSRM failure fallback**

In DevTools, block `router.project-osrm.org` (Network tab → right-click → Block request domain). Start/restart demo. Bikes should still move (straight-line lerp) with badges showing — no errors in console beyond the blocked-network 브라우저 message.

Unblock the domain after this test.

- [ ] **Step 6: 데모 정지**

Click toggle. Virtual markers disappear. Real bikes (if in sim) revert to their last simulated position or go static. No `배정됨`/`배송 중`/`배송 완료` badges remain on any marker.

---

## Task 9: PR

- [ ] **Step 1: Push branch**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain
git push -u origin cc-226-osrm-road-routing
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --base dev --head cc-226-osrm-road-routing \
  --title "Road-following movement + delivery status badges (PR-C)" \
  --body "$(cat <<'EOF'
## Summary
- EN_ROUTE 이동이 직선 lerp → OSRM 실제 도로 경로로 교체 — 서울 도로망을 따라 이동
- 지도 마커에 배송 상태 배지 추가: 배정됨(노랑) → 배송 중(파랑) → 배송 완료(초록)
- 실패 시 자동 직선 fallback (OSRM 응답 없으면 기존 lerp 그대로)
- 가상 차량 + 실제 차량 모두 적용

## Architecture
- `lib/services/osrm.ts`: OSRM fetch 순수 함수 (5 초 timeout, 에러 → 빈 배열 fallback)
- `SimulatedBikeState.routeWaypoints`: OSRM 경유점 배열 | null
- `FleetSimulationContext`: ASSIGNED 전환 감지 → async fetch → state 주입
- `useSimulatedBikePins`: `SimulatedBikePin` 타입으로 확장, `deliveryPhase` overlay
- `MapShell`: `deliveryBadgeMarkup` + `bikeMarkerHtml` 확장

## Spec & Plan
- 디자인: `docs/superpowers/specs/2026-05-25-osrm-road-routing-design.md`
- 플랜: `docs/superpowers/plans/2026-05-25-osrm-road-routing.md`

## Test plan
- [x] `npm run typecheck`
- [x] `npm run lint`
- [ ] 데모 시작 → OSRM API 호출 확인 (Network 탭)
- [ ] 차량이 서울 도로를 따라 이동 (직선 X)
- [ ] 배정됨 → 배송 중 → 배송 완료 배지 순서 확인
- [ ] OSRM 차단 시 직선 이동 fallback 정상 작동
- [ ] 데모 정지 → 배지 사라짐

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

**Spec coverage** — `docs/superpowers/specs/2026-05-25-osrm-road-routing-design.md`:

- "새 모듈 `lib/services/osrm.ts`" → Task 2. ✅
- "`SimulatedBikeState` 확장 (`routeWaypoints`)" → Task 3 step 2. ✅
- "`walkPolyline` 함수" → Task 3 step 3. ✅
- "`advanceBikeState` EN_ROUTE 분기 변경" → Task 3 step 4. ✅
- "ASSIGNED 진입 시 / ARRIVED→IDLE 시 null 초기화" → Task 3 step 5. ✅
- "`makeInitialState` 에 `routeWaypoints: null`" → Task 3 step 6. ✅
- "OSRM fetch 트리거 (`FleetSimulationContext`)" → Task 4. ✅
- "배송 상태 레이블 — 마커 overlay" → Tasks 5 + 6. ✅
- "Error handling: 5초 timeout, 빈 배열 fallback, stale guard" → Task 2 (timeout in osrm.ts), Task 4 (stale guard + empty array check). ✅
- "OSRM 실패 시 직선 이동 fallback" → Task 3 step 4 (null check before walkPolyline). ✅

**Placeholder scan** — no "TBD", "TODO", "implement later". All code blocks are concrete. ✅

**Type consistency**:
- `routeWaypoints: ReadonlyArray<{ lat: number; lng: number }> | null` — matches `fetchOsrmRoute` return type `Promise<ReadonlyArray<{ lat: number; lng: number }>>`. ✅
- `walkPolyline(waypoints: ReadonlyArray<{ lat: number; lng: number }>, t: number)` — same shape. ✅
- `SimulatedBikePin = FrontendDashboardBikePin & { deliveryPhase: DeliveryPhase | null }` — `deliveryPhase` is `DeliveryPhase | null` (non-optional). `MapShellProps.bikePins` uses `deliveryPhase?: DeliveryPhase | null` (optional) — `SimulatedBikePin` satisfies this since required ⊂ optional. ✅
- `deliveryBadgeMarkup(phase: DeliveryPhase)` — called with `pin.deliveryPhase` typed as `DeliveryPhase | null | undefined`. The guard `deliveryPhase ? deliveryBadgeMarkup(deliveryPhase) : ""` narrows to `DeliveryPhase` before the call. ✅

**Scope** — 1 new file + 4 modified files, no backend changes, no new runtime deps. ✅
