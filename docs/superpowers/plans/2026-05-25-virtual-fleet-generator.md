# Virtual Fleet Generator (PR-A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a operator clicks `[데모 시작]`, generate 20 virtual vehicles + 20 virtual riders deterministically and make them appear on the map alongside the real registered fleet, all running through the existing simulation engine.

**Architecture:** A new `lib/services/virtual-fleet.ts` produces a fully-typed snapshot (vehicles + riders + bikePins + matching lookups). `FleetSimulationContext` stores it in a new `virtualFleet` state slice when fleet is on, and seeds both real and virtual `bikePins` into the simulated Map. `OverviewMapBanner` and `FullscreenMapHost` merge `bikePins ⊕ virtualFleet.bikePins` before feeding the existing overlay hook + `MapShell`. Tables, KPI tiles, and search stay untouched — PR-B follow-up.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript. No new runtime deps. No backend changes. No test runner — verification = `npm run typecheck` + `npm run lint` + manual smoke checklist.

**Reference doc:** `docs/superpowers/specs/2026-05-25-virtual-fleet-generator-design.md`.

---

## File Structure

| Path | Purpose | Action |
| ---- | ------- | ------ |
| `lib/services/virtual-fleet.ts` | Pure deterministic generator — types + `generateVirtualFleet({ count, seedString })` returning `VirtualFleet` (vehicles, riders, bikePins, four lookup Maps) | **Create** |
| `components/overview/FleetSimulationContext.tsx` | Add `virtualFleet: VirtualFleet \| null` state slice + setter logic in `setFleetRunning`; expose via context. Iterate `[...pinsRef.current, ...virtual.bikePins]` when seeding `simulated`. | **Modify** |
| `components/overview/OverviewMapBanner.tsx` | Read `virtualFleet` from context; build `mergedRawPins = [...bikePins, ...virtualFleet.bikePins]` (or `bikePins` when no fleet); pass merged to both `seedBikePins` and `useSimulatedBikePins` | **Modify** |
| `components/overview/FullscreenMapHost.tsx` | Same merge as `OverviewMapBanner` | **Modify** |

No tests directory — verification by typecheck + lint + manual smoke.

---

## Task 1: Branch sanity check

**Files:** none

- [ ] **Step 1: Verify branch + spec committed**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain
git status
git log --oneline -3
ls docs/superpowers/specs/2026-05-25-virtual-fleet-generator-design.md
ls docs/superpowers/plans/2026-05-25-virtual-fleet-generator.md
```

Expected: branch `cc-224-virtual-fleet-generator`, most recent commit `ea79fe5` (spec). Both doc files exist. Working tree clean.

---

## Task 2: Create `virtual-fleet.ts` generator

**Files:**
- Create: `development/front-admin-web/lib/services/virtual-fleet.ts`

This is a pure module — no React, no DOM. Produces a `VirtualFleet` snapshot from a deterministic seed string. Generation rules per spec:
- `bikeId`: `virtual-bike-{NN}` where NN is 01..20
- `plateNumber`: `99서0001` .. `99서0020` (99 prefix is non-issuable, never collides with real plates)
- `modelName`: `데모 가상 1호기` .. `데모 가상 20호기`
- `engineType`: all `ELECTRIC`
- `operationStatus`: all `IN_SERVICE`
- Seoul-box origin (37.44..37.65, 126.87..127.10) per-bike hash
- Battery 70..95 per-bike hash
- `riderId`: `virtual-rider-{NN}`
- Name from a 10×10 family×given pool (deterministic index)
- Phone `010-99XX-YYYY` where the trailing 8 digits come from a hash

- [ ] **Step 1: Create the file with the exact content**

```ts
import type {
  FrontendDashboardBikePin,
  FrontendRider,
  FrontendVehicle
} from "@/lib/services/service-ops-api";

/**
 * 데모 모드의 가상 fleet — fleet 시뮬레이션이 켜질 때 한 번에 생성되는
 * 결정성 있는 가짜 데이터 스냅샷. 실제 DB / backend 와 무관, 클라이언트
 * 메모리에만 존재. 같은 seedString 이면 모든 호출에 같은 결과.
 *
 * Plate / 모델명 / phone prefix 가 99 / "데모 가상" 으로 운영자가 식별
 * 가능하게 박혀 있어 실제 데이터와 절대 혼동되지 않는다.
 */

export type VirtualFleet = {
  vehicles: FrontendVehicle[];
  riders: FrontendRider[];
  bikePins: FrontendDashboardBikePin[];
  /** bikeId → riderId. 가상 차량별 1:1 매칭. */
  bikeActiveRiderById: Map<string, string>;
  /** riderId → bikeId. 위의 역인덱스. */
  riderActiveBikeId: Map<string, string>;
  /** riderId → plateNumber. */
  riderActiveBikePlate: Map<string, string>;
  /** riderId → { name, phone }. 차량 상세 패널의 라이더 라벨에 사용. */
  riderInfoById: Map<string, { name: string; phone: string }>;
};

const SEOUL_LAT_MIN = 37.44;
const SEOUL_LAT_MAX = 37.65;
const SEOUL_LNG_MIN = 126.87;
const SEOUL_LNG_MAX = 127.10;

const FAMILY_NAMES = ["김", "이", "박", "정", "최", "조", "윤", "장", "임", "한"];
const GIVEN_NAMES = [
  "민수", "지영", "준호", "수빈", "예은",
  "도윤", "서아", "하준", "지우", "윤서"
];

/** 문자열 → 0..2^32-1 deterministic 정수 (cheap, not cryptographic). */
function hash32(seed: string, salt: number): number {
  let h = salt | 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

/** hash32 결과를 0..1 사이 float 로 매핑. */
function hashUnit(seed: string, salt: number): number {
  return (hash32(seed, salt) % 10_000) / 10_000;
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function pad4(n: number): string {
  return n.toString().padStart(4, "0");
}

function makeBikePin(
  bikeId: string,
  plateNumber: string,
  modelName: string,
  riderLabel: string,
  origin: { lat: number; lng: number },
  batteryPercent: number,
  nowIso: string
): FrontendDashboardBikePin {
  return {
    bikeId,
    slug: bikeId,
    bikeIdx: null,
    plateNumber,
    modelName,
    operationStatus: "IN_SERVICE",
    activeRiderLabel: riderLabel,
    deviceId: null,
    lastReceivedAt: nowIso,
    latitude: origin.lat,
    longitude: origin.lng,
    speedKph: 0,
    batteryPercent: Math.round(batteryPercent),
    ignitionStatus: "OFF",
    telemetrySource: "SIMULATED",
    drivingStatus: "PARKED",
    connectionStatus: "ONLINE",
    batteryStatus: batteryPercent < 20 ? "CRITICAL" : batteryPercent <= 50 ? "LOW" : "NORMAL",
    pinLabel: plateNumber
  };
}

function makeVehicle(
  bikeId: string,
  plateNumber: string,
  modelName: string,
  riderName: string,
  origin: { lat: number; lng: number },
  batteryPercent: number,
  nowIso: string
): FrontendVehicle {
  return {
    slug: bikeId,
    id: bikeId,
    idx: null,
    plateNumber,
    vin: null,
    model: modelName,
    engineType: "ELECTRIC",
    status: "운행",
    operationStatus: "IN_SERVICE",
    ignitionBlocked: false,
    assignmentStatus: "ASSIGNED",
    batteryPercent: Math.round(batteryPercent),
    riderName,
    locationLabel: `${origin.lat.toFixed(4)}, ${origin.lng.toFixed(4)}`,
    lastSeenAt: nowIso,
    memo: null,
    createdAt: nowIso,
    updatedAt: nowIso,
    source: "mock"
  };
}

function makeRider(
  riderId: string,
  name: string,
  phone: string,
  nowIso: string
): FrontendRider {
  return {
    slug: riderId,
    id: riderId,
    idx: null,
    name,
    phone,
    team: "데모 팀",
    area: "데모 권역",
    status: "활동",
    joinedAt: nowIso,
    appAccountLinked: false,
    appAccountId: null,
    appLinkedAt: null,
    appLinkStatus: "UNLINKED",
    memo: null,
    createdAt: nowIso,
    updatedAt: nowIso,
    source: "mock"
  };
}

export function generateVirtualFleet(input: {
  count?: number;
  seedString?: string;
  nowIso?: string;
} = {}): VirtualFleet {
  const count = input.count ?? 20;
  const seedString = input.seedString ?? "demo-fleet-2026";
  const nowIso = input.nowIso ?? new Date().toISOString();

  const vehicles: FrontendVehicle[] = [];
  const riders: FrontendRider[] = [];
  const bikePins: FrontendDashboardBikePin[] = [];
  const bikeActiveRiderById = new Map<string, string>();
  const riderActiveBikeId = new Map<string, string>();
  const riderActiveBikePlate = new Map<string, string>();
  const riderInfoById = new Map<string, { name: string; phone: string }>();

  for (let i = 1; i <= count; i++) {
    const bikeId = `virtual-bike-${pad2(i)}`;
    const riderId = `virtual-rider-${pad2(i)}`;
    const plateNumber = `99서${pad4(i)}`;
    const modelName = `데모 가상 ${i}호기`;
    const idSeed = `${seedString}|${i}`;

    const lat = SEOUL_LAT_MIN + hashUnit(idSeed, 1) * (SEOUL_LAT_MAX - SEOUL_LAT_MIN);
    const lng = SEOUL_LNG_MIN + hashUnit(idSeed, 2) * (SEOUL_LNG_MAX - SEOUL_LNG_MIN);
    const battery = 70 + hashUnit(idSeed, 3) * 25; // 70..95

    const familyName = FAMILY_NAMES[hash32(idSeed, 4) % FAMILY_NAMES.length];
    const givenName = GIVEN_NAMES[hash32(idSeed, 5) % GIVEN_NAMES.length];
    const riderName = `${familyName}${givenName}`;
    const phoneMid = pad4(hash32(idSeed, 6) % 10_000);
    const phoneTail = pad4(hash32(idSeed, 7) % 10_000);
    const phone = `010-99${phoneMid.slice(2)}-${phoneTail}`;

    bikePins.push(makeBikePin(bikeId, plateNumber, modelName, riderName, { lat, lng }, battery, nowIso));
    vehicles.push(makeVehicle(bikeId, plateNumber, modelName, riderName, { lat, lng }, battery, nowIso));
    riders.push(makeRider(riderId, riderName, phone, nowIso));

    bikeActiveRiderById.set(bikeId, riderId);
    riderActiveBikeId.set(riderId, bikeId);
    riderActiveBikePlate.set(riderId, plateNumber);
    riderInfoById.set(riderId, { name: riderName, phone });
  }

  return {
    vehicles,
    riders,
    bikePins,
    bikeActiveRiderById,
    riderActiveBikeId,
    riderActiveBikePlate,
    riderInfoById
  };
}
```

- [ ] **Step 2: Static checks**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web
npm run typecheck
npm run lint
```

Both must exit 0. Likely TS issues to watch for:
- `FrontendRider` has `phone: string` (no `phoneNumber`), `team: string`, `area: string`, `status: "활동" | "대기" | "휴면"`, `joinedAt: string` (required), `appLinkStatus?: string`. The code above matches these exactly — confirmed by reading `service-ops-api.ts:50-68`.
- `FrontendVehicle.engineType` is `"ELECTRIC" | "ICE"` literal union — assignment of string literal `"ELECTRIC"` is fine.
- `FrontendVehicle.status` is `"운행" | "대기"` literal union — using `"운행"` is fine.
- `FrontendDashboardBikePin` extends `ServiceOpsDashboardBikePin` with `latitude/longitude/speedKph/batteryPercent` widened to `number | null`. All fields provided.

- [ ] **Step 3: Commit**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain
git add development/front-admin-web/lib/services/virtual-fleet.ts
git commit -m "Add virtual fleet generator (20 vehicles + riders, deterministic seed)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Extend `FleetSimulationContext` to own `virtualFleet`

**Files:**
- Modify: `development/front-admin-web/components/overview/FleetSimulationContext.tsx`

Add a new state slice + setter logic so `setFleetRunning(true)` generates the virtual fleet and seeds both real and virtual bikePins into `simulated`.

- [ ] **Step 1: Read current file**

```bash
cat C:/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web/components/overview/FleetSimulationContext.tsx
```

Confirm: `FleetSimulationContextValue` type, `FleetSimulationProvider` body, the existing `setFleetRunning(true)` block that iterates `pinsRef.current`, the noop fallback in `useFleetSimulation`.

- [ ] **Step 2: Add imports near the top**

Append after the existing imports:

```tsx
import { generateVirtualFleet, type VirtualFleet } from "@/lib/services/virtual-fleet";
```

- [ ] **Step 3: Extend the context value type**

Find:

```tsx
type FleetSimulationContextValue = {
  fleetRunning: boolean;
  setFleetRunning: (running: boolean) => void;
  simulated: ReadonlyMap<string, SimulatedBikeState>;
  assignSingleBike: (bikeId: string) => void;
  cancelSingleBike: (bikeId: string) => void;
  seedBikePins: (pins: ReadonlyArray<FrontendDashboardBikePin>) => void;
};
```

Add `virtualFleet`:

```tsx
type FleetSimulationContextValue = {
  fleetRunning: boolean;
  setFleetRunning: (running: boolean) => void;
  simulated: ReadonlyMap<string, SimulatedBikeState>;
  assignSingleBike: (bikeId: string) => void;
  cancelSingleBike: (bikeId: string) => void;
  seedBikePins: (pins: ReadonlyArray<FrontendDashboardBikePin>) => void;
  /** fleet 이 켜져 있는 동안에만 채워지는 가상 fleet 스냅샷. fleet OFF →
   *  null. setFleetRunning(true) 가 한 번 generate 해서 stop 전까지
   *  identity 유지 — consumers 의 useMemo 가 매 tick 재발화하지 않도록. */
  virtualFleet: VirtualFleet | null;
};
```

- [ ] **Step 4: Add the new state slice in `FleetSimulationProvider`**

After:
```tsx
const [simulated, setSimulated] = useState<ReadonlyMap<string, SimulatedBikeState>>(() => new Map());
```

Add:
```tsx
const [virtualFleet, setVirtualFleet] = useState<VirtualFleet | null>(null);
```

- [ ] **Step 5: Update `setFleetRunning` to generate + seed**

Replace the existing `setFleetRunning` `useCallback`:

```tsx
const setFleetRunning = useCallback((running: boolean) => {
  if (running) {
    const nowMs = Date.now();
    const virtual = generateVirtualFleet({});
    setVirtualFleet(virtual);
    setSimulated((prev) => {
      const next = new Map(prev);
      const seedPins = [...pinsRef.current, ...virtual.bikePins];
      for (const pin of seedPins) {
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
  } else {
    // fleet 정지 — virtualFleet 즉시 비우면 다음 render 에서 mergedRawPins 가
    // 줄어들고 마커 22 → 2 로 회복. 시뮬레이션 entry 들은 기존 tick cleanup
    // 로직 (IDLE && !manualOrigin) 이 다음 IDLE 도달 시 자연스럽게 제거.
    setVirtualFleet(null);
  }
  setFleetRaw(running);
}, []);
```

- [ ] **Step 6: Include `virtualFleet` in the context `value` useMemo**

Find:
```tsx
const value = useMemo<FleetSimulationContextValue>(
  () => ({ fleetRunning, setFleetRunning, simulated, assignSingleBike, cancelSingleBike, seedBikePins }),
  [fleetRunning, setFleetRunning, simulated, assignSingleBike, cancelSingleBike, seedBikePins]
);
```

Change to:
```tsx
const value = useMemo<FleetSimulationContextValue>(
  () => ({ fleetRunning, setFleetRunning, simulated, assignSingleBike, cancelSingleBike, seedBikePins, virtualFleet }),
  [fleetRunning, setFleetRunning, simulated, assignSingleBike, cancelSingleBike, seedBikePins, virtualFleet]
);
```

- [ ] **Step 7: Update the noop fallback in `useFleetSimulation`**

Find:
```tsx
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
```

Change to:
```tsx
if (!ctx) {
  const emptyMap: ReadonlyMap<string, SimulatedBikeState> = new Map();
  return {
    fleetRunning: false,
    setFleetRunning: () => {},
    simulated: emptyMap,
    assignSingleBike: () => {},
    cancelSingleBike: () => {},
    seedBikePins: () => {},
    virtualFleet: null
  };
}
```

- [ ] **Step 8: Static checks** — both exit 0.

- [ ] **Step 9: Commit**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain
git add development/front-admin-web/components/overview/FleetSimulationContext.tsx
git commit -m "FleetSimulationContext: own virtual fleet + seed it on fleet start

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Wire `OverviewMapBanner` to merge virtual bikePins

**Files:**
- Modify: `development/front-admin-web/components/overview/OverviewMapBanner.tsx`

The banner already calls `useFleetSimulation` (Task 6 of the prior fleet PR). Now also consume `virtualFleet` and merge into the pin list before overlay + seeding.

- [ ] **Step 1: Extend the existing destructure**

Find:
```tsx
const { fleetRunning, setFleetRunning, seedBikePins } = useFleetSimulation();
```

Change to:
```tsx
const { fleetRunning, setFleetRunning, seedBikePins, virtualFleet } = useFleetSimulation();
```

- [ ] **Step 2: Build `mergedRawPins`**

ABOVE the existing line:
```tsx
const overlaidBikePins = useSimulatedBikePins(bikePins);
```

Insert:
```tsx
const mergedRawPins = useMemo(() => {
  if (!virtualFleet) return bikePins.slice();
  return [...bikePins, ...virtualFleet.bikePins];
}, [bikePins, virtualFleet]);
```

Change the next line to consume `mergedRawPins`:

```tsx
const overlaidBikePins = useSimulatedBikePins(mergedRawPins);
```

- [ ] **Step 3: Seed merged pins into the provider**

Find the existing seed effect:
```tsx
useEffect(() => {
  seedBikePins(bikePins);
}, [bikePins, seedBikePins]);
```

Change to use `mergedRawPins`:
```tsx
useEffect(() => {
  seedBikePins(mergedRawPins);
}, [mergedRawPins, seedBikePins]);
```

- [ ] **Step 4: Static checks** — both exit 0.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain
git add development/front-admin-web/components/overview/OverviewMapBanner.tsx
git commit -m "Merge virtual fleet bikePins into OverviewMapBanner map markers

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Wire `FullscreenMapHost` identically

**Files:**
- Modify: `development/front-admin-web/components/overview/FullscreenMapHost.tsx`

Mirror Task 4 for the fullscreen overlay. The component already pulls `useFleetSimulation`; just consume `virtualFleet` and merge.

- [ ] **Step 1: Extend the existing destructure inside `FullscreenMapOverlay`**

Find:
```tsx
const { fleetRunning, setFleetRunning, seedBikePins } = useFleetSimulation();
```

Change to:
```tsx
const { fleetRunning, setFleetRunning, seedBikePins, virtualFleet } = useFleetSimulation();
```

- [ ] **Step 2: Build `mergedRawPins` ABOVE the `overlaidBikePins` line**

Find:
```tsx
const overlaidBikePins = useSimulatedBikePins(bikePins);
```

Replace with:
```tsx
const mergedRawPins = useMemo(() => {
  if (!virtualFleet) return bikePins.slice();
  return [...bikePins, ...virtualFleet.bikePins];
}, [bikePins, virtualFleet]);

const overlaidBikePins = useSimulatedBikePins(mergedRawPins);
```

- [ ] **Step 3: Update the seed effect**

Find:
```tsx
useEffect(() => {
  seedBikePins(bikePins);
}, [bikePins, seedBikePins]);
```

Change to:
```tsx
useEffect(() => {
  seedBikePins(mergedRawPins);
}, [mergedRawPins, seedBikePins]);
```

- [ ] **Step 4: Verify `OverviewMapSearch` still passes overlaidBikePins** (or `bikePins`)

The search inside the fullscreen header already receives `bikePins={overlaidBikePins}` from the previous fleet PR. With Task 4/5 changes, `overlaidBikePins` now also reflects the merged-virtual set. No further edit needed.

- [ ] **Step 5: Static checks** — both exit 0.

- [ ] **Step 6: Commit**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain
git add development/front-admin-web/components/overview/FullscreenMapHost.tsx
git commit -m "Merge virtual fleet bikePins into FullscreenMapHost map markers

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Full static-check sweep + optional build

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

- [ ] **Step 3: Optional `next build`**

```bash
npm run build
```

Expected exit 0. Skip if you trust prior checks.

---

## Task 7: Manual smoke

The user runs their own dev server — do not start a competing one.

- [ ] **Step 1: Open `/` with fleet OFF**

Confirm the map (when toggled on) shows the existing real markers (2 bikes + 1 BSS). No `99서` plate labels visible.

- [ ] **Step 2: Click `[데모 시작]`**

- Within 0–30 seconds, the map should show **~22 bike markers** (real 2 + virtual 20).
- At least one virtual marker (plate `99서0001` – `99서0020`) visible.
- Some virtual markers should begin moving (EN_ROUTE phase) within a minute.

- [ ] **Step 3: Click a virtual marker**

A `VehicleDetailDialog` opens — at this stage, it'll be effectively empty because virtual `bikeId` doesn't exist in `vehicleById` lookup of the page's `vehicles` array. **That's expected for PR-A** — full detail rendering lands in PR-B. The map marker behavior alone validates this PR.

- [ ] **Step 4: Click `[데모 정지]`**

Within ~10 seconds, the virtual markers should disappear as their cycle returns to IDLE (since `virtualFleet` was set to null, mergedRawPins now drops the virtual pins on re-render, and the simulated entries are cleaned by the tick effect's IDLE-cleanup branch).

- [ ] **Step 5: Click `[데모 시작]` again**

Same 20 virtual markers reappear with **identical `99서0001`..`99서0020` plates and same origin coords** — verifies deterministic seed.

- [ ] **Step 6: Confirm fullscreen mode**

Open `[⛶ 전체화면]`, observe the same 22 markers in the fullscreen canvas. Toggling `[데모 정지]` from the fullscreen header should affect the in-page map too (shared context).

---

## Task 8: PR

- [ ] **Step 1: Push branch**

```bash
cd C:/Users/user/repositories/clever/thundercrew-domain
git push -u origin cc-224-virtual-fleet-generator
```

- [ ] **Step 2: Create PR**

```bash
gh pr create --base dev --head cc-224-virtual-fleet-generator \
  --title "Generate 20 virtual vehicles + riders for fleet demo (PR-A)" \
  --body "$(cat <<'EOF'
## Summary
- 새 \`lib/services/virtual-fleet.ts\` — 데모 시작 시 한 번에 생성되는 20대 가상 차량 + 라이더 deterministic generator
- \`FleetSimulationContext\` 에 \`virtualFleet\` state 추가 — fleet ON 동안 채워지고 OFF 시 null
- \`setFleetRunning(true)\` 가 실제 등록 차량 + 가상 20대를 한 번에 시뮬레이션 entry 로 seed
- \`OverviewMapBanner\` / \`FullscreenMapHost\` 가 \`mergedRawPins = [...bikePins, ...virtualFleet.bikePins]\` 로 합쳐 지도 마커에 노출
- 표 / KPI / 검색은 의도적으로 통합 안 함 — **PR-B** 후속
- 도로 polyline 보간 (OSRM) 도 **PR-C** 후속

## Spec & Plan
- 디자인: \`docs/superpowers/specs/2026-05-25-virtual-fleet-generator-design.md\`
- 플랜: \`docs/superpowers/plans/2026-05-25-virtual-fleet-generator.md\`

## Visual diff
- fleet OFF: 마커 ≈ 2대 (실제) + 1 BSS — 변화 없음
- fleet ON: 마커 ≈ 22대 (실제 2 + 가상 20) + 1 BSS — staggered 시점에 사이클 시작
- 가상 차량 plate: \`99서0001\` ~ \`99서0020\` — 실제 운영 plate 규약과 충돌 없음
- 가상 모델명: \`데모 가상 1~20호기\`

## Test plan
- [x] \`npm run typecheck\`
- [x] \`npm run lint\`
- [ ] 데모 시작 → 30초 안에 마커 ≈ 22개 노출, 일부 staggered 이동
- [ ] 가상 plate \`99서0001\` 한눈에 식별
- [ ] 데모 정지 → 가상 마커 사라지고 실제 2대만 남음
- [ ] 데모 재시작 → 같은 plate / origin 으로 재생성 (deterministic seed)
- [ ] 전체화면 헤더 데모 토글도 동일하게 작동

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL printed.

---

## Self-Review

**Spec coverage** — checked each section of `docs/superpowers/specs/2026-05-25-virtual-fleet-generator-design.md`:

- "New module `lib/services/virtual-fleet.ts`" → Task 2 (full file content).
- "`FleetSimulationContext` 확장 — virtualFleet channel" → Task 3 Steps 3, 6, 7.
- "`setFleetRunning(true)` 동작 변경 — generate + seed both" → Task 3 Step 5.
- "`setFleetRunning(false)` 동작 변경 — virtualFleet = null" → Task 3 Step 5 (else branch).
- "지도 마커 통합 — `mergedRawPins`" → Tasks 4 + 5.
- "Visual behavior fleet ON/OFF" → Task 7 Steps 1–5.
- "Deterministic seed verification" → Task 7 Step 5.

**Placeholder scan** — no "TODO", "TBD", "implement later", or "similar to Task N" references. Each code block is concrete.

**Type consistency:**
- `VirtualFleet` shape defined in Task 2; imported and used identically in Tasks 3, 4, 5.
- `FleetSimulationContextValue.virtualFleet: VirtualFleet | null` — Task 3 adds the field; Tasks 4/5 destructure it; noop fallback returns `null`.
- `mergedRawPins` variable name reused identically in Tasks 4 and 5.
- `generateVirtualFleet({})` invocation matches the signature `({ count?, seedString?, nowIso? } = {})` defined in Task 2.

**Scope** — single PR, 1 new file + 3 modified files, no backend changes, no test runner additions.
