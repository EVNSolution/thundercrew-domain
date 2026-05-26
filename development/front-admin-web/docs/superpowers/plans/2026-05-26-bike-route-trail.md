# 차량 이동 경로 Trail 표시 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 지도에서 차량 마커를 클릭하면 해당 차량의 이동 경로를 파랑 실선(`#3b82f6`, 4px)으로 오버레이하고, 상세 패널을 닫으면 경로선도 함께 제거한다.

**Architecture:** `useTrailWaypoints` 훅이 시뮬/실제 차량 데이터 분기를 담당하고, `MapShell`이 NCP `Polyline` 인스턴스를 생성·제거한다. `OverviewMapBanner`와 `FullscreenMapHost`는 훅 결과를 prop으로 전달하는 thin adapter 역할만 한다.

**Tech Stack:** NCP Maps Web SDK (`naver.maps.Polyline`), React hooks (`useMemo`, `useEffect`, `useRef`), TypeScript

---

## 파일 구조

| 파일 | 역할 |
|---|---|
| `types/naver-maps.d.ts` | NCP Polyline 타입 선언 추가 |
| `lib/services/bike-location-history.ts` | 실제 차량 GPS 이력 API stub (신규) |
| `components/overview/use-trail-waypoints.ts` | 경로 waypoints 해석 훅 (신규) |
| `components/dashboard/MapShell.tsx` | `trailWaypoints` prop + NCP Polyline 관리 |
| `components/overview/OverviewMapBanner.tsx` | 훅 사용 + MapShell prop 전달 |
| `components/overview/FullscreenMapHost.tsx` | 훅 사용 + MapShell prop 전달 |

---

### Task 1: NCP Polyline 타입 선언

**Files:**
- Modify: `types/naver-maps.d.ts`

**배경:** `types/naver-maps.d.ts`는 NCP Maps SDK의 최소 타입 선언 파일이다. 현재 `NaverPolygon`은 선언되어 있지만 열린 경로인 `NaverPolyline`은 없다. `MapShell.tsx`에서 `NaverPolylineInstance` 타입을 import해서 ref 타입으로 쓰려면 먼저 선언이 필요하다.

- [ ] **Step 1: `NaverMapsNamespace`에 Polyline 생성자 추가**

`types/naver-maps.d.ts`의 `NaverMapsNamespace` 인터페이스에 `Polyline` 프로퍼티를 추가한다. `Polygon` 선언 바로 아래에 삽입:

```ts
// 변경 전 (기존 코드 일부, ~line 30):
  Polygon: NaverPolygonConstructor;
  Event: NaverMapEventNamespace;

// 변경 후:
  Polygon: NaverPolygonConstructor;
  Polyline: NaverPolylineConstructor;
  Event: NaverMapEventNamespace;
```

- [ ] **Step 2: Polyline 인터페이스 추가**

파일 맨 끝(`NaverPolygonInstance` export 다음)에 추가:

```ts
interface NaverPolylineConstructor {
  new (options: NaverPolylineOptions): NaverPolylineInstance;
}

export interface NaverPolylineOptions {
  map?: NaverMapInstance | null;
  path: NaverLatLng[];
  strokeColor?: string;
  strokeOpacity?: number;
  strokeWeight?: number;
  strokeStyle?: "solid" | "shortdash" | "dash";
  zIndex?: number;
  clickable?: boolean;
}

export interface NaverPolylineInstance {
  setMap(map: NaverMapInstance | null): void;
  setPath?(path: NaverLatLng[]): void;
}
```

- [ ] **Step 3: 타입 검증**

```bash
cd development/front-admin-web
npm run typecheck
```

Expected: 에러 없음. (`types/naver-maps.d.ts`는 `.d.ts` 파일이라 직접 컴파일되지 않지만, 이를 import하는 `MapShell.tsx`가 컴파일될 때 검증된다. 지금은 아직 MapShell이 수정 전이라 기존 에러 없으면 OK.)

- [ ] **Step 4: 커밋**

```bash
git add types/naver-maps.d.ts
git commit -m "feat: NCP Polyline 타입 선언 추가

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: 실제 차량 GPS 이력 API Stub

**Files:**
- Create: `lib/services/bike-location-history.ts`

**배경:** 실제 차량(IMEI≠-1)의 GPS 이력을 조회하는 백엔드 API가 아직 없다. 프론트엔드 준비를 위해 stub을 만들어두고, 백엔드 완성 후 이 파일만 교체한다.

- [ ] **Step 1: stub 파일 생성**

`lib/services/bike-location-history.ts`를 새로 만든다:

```ts
/**
 * 차량 GPS 이력 조회.
 *
 * 백엔드 API `/telemetry/bikes/:bikeId/location-history` 완성 후 실제 fetch 로 교체.
 * 현재는 항상 빈 배열 반환 → 실제 차량 경로선 미표시.
 */
export type BikeLocationPoint = {
  lat: number;
  lng: number;
  recordedAt?: string;
};

export async function fetchBikeLocationHistory(
  _bikeId: string
): Promise<BikeLocationPoint[]> {
  return [];
}
```

- [ ] **Step 2: 타입 검증**

```bash
npm run typecheck
```

Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add lib/services/bike-location-history.ts
git commit -m "feat: 실제 차량 GPS 이력 API stub 추가

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: useTrailWaypoints 훅

**Files:**
- Create: `components/overview/use-trail-waypoints.ts`

**배경:** 이 훅이 선택된 차량(`selectedBikeId`)에 맞는 경로 waypoints를 결정한다. 기존 `useSimulatedBikePins`(`components/overview/use-simulated-bike-pins.ts`)와 동일한 패턴 — `useFleetSimulation()`에서 시뮬 상태를 읽어 변환. `useFleetSimulation()`은 Provider 없이도 안전한 fallback을 반환하므로 Provider 없는 환경에서도 안전하다.

- [ ] **Step 1: 훅 파일 생성**

`components/overview/use-trail-waypoints.ts`:

```ts
"use client";

import { useMemo } from "react";

import { useFleetSimulation } from "@/components/overview/FleetSimulationContext";

export type TrailWaypoint = { lat: number; lng: number };

/**
 * 선택된 차량의 이동 경로 waypoints 반환.
 *
 * - IMEI=-1 시뮬 차량: FleetSimulationContext 의 routeWaypoints (OSRM fetch 완료분).
 *   EN_ROUTE + routeWaypoints !== null + length >= 2 일 때만 반환.
 *   IDLE 이거나 OSRM fetch 아직 진행 중(routeWaypoints === null)이면 null.
 * - 실제 차량: null (백엔드 API 완성 후 fetchBikeLocationHistory 로 교체).
 * - selectedBikeId === null → null.
 *
 * OSRM fetch 가 완료되면 simulated Map 이 갱신 → 이 훅이 재계산 → MapShell 이
 * Polyline 을 자동으로 표시한다. 별도 polling 불필요.
 */
export function useTrailWaypoints(
  selectedBikeId: string | null
): ReadonlyArray<TrailWaypoint> | null {
  const { simulated } = useFleetSimulation();

  return useMemo(() => {
    if (!selectedBikeId) return null;

    // IMEI=-1 시뮬 차량
    const sim = simulated.get(selectedBikeId);
    if (sim) {
      if (
        sim.phase === "EN_ROUTE" &&
        sim.routeWaypoints !== null &&
        sim.routeWaypoints.length >= 2
      ) {
        return sim.routeWaypoints;
      }
      return null;
    }

    // 실제 차량 — stub: 현재 null. fetchBikeLocationHistory 로 교체 예정.
    return null;
  }, [selectedBikeId, simulated]);
}
```

- [ ] **Step 2: 타입 검증**

```bash
npm run typecheck
```

Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add components/overview/use-trail-waypoints.ts
git commit -m "feat: useTrailWaypoints 훅 — 시뮬/실제 차량 경로 분기

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: MapShell — trailWaypoints prop + NCP Polyline 관리

**Files:**
- Modify: `components/dashboard/MapShell.tsx`

**배경:** `MapShell`은 NCP 지도 인스턴스를 소유하는 유일한 컴포넌트다. NCP `Polyline`도 여기서 생성·제거한다. `trailWaypoints` prop이 `null`이거나 길이 < 2이면 Polyline 없음. 유효한 waypoints가 들어오면 파랑 실선을 그린다. 테마 토글 시 NCP map이 재생성되는데(`mapVersion` 증가), 기존 marker 정리 블록에 Polyline 정리도 추가해야 한다.

- [ ] **Step 1: `NaverPolylineInstance` import 추가**

파일 상단 import 블록(현재 `NaverEventListener`, `NaverMapInstance`, `NaverMapOptions`, `NaverMarkerInstance` import):

```ts
// 변경 전:
import type {
  NaverEventListener,
  NaverMapInstance,
  NaverMapOptions,
  NaverMarkerInstance
} from "@/types/naver-maps";

// 변경 후:
import type {
  NaverEventListener,
  NaverMapInstance,
  NaverMapOptions,
  NaverMarkerInstance,
  NaverPolylineInstance
} from "@/types/naver-maps";
```

- [ ] **Step 2: `MapShellProps`에 `trailWaypoints` 추가**

`fitBoundsPadding` 프로퍼티 다음에 삽입:

```ts
// 변경 전:
  fitBoundsPadding?: { top: number; right: number; bottom: number; left: number };
}

// 변경 후:
  fitBoundsPadding?: { top: number; right: number; bottom: number; left: number };
  /**
   * 선택된 차량의 이동 경로 waypoints. non-null + length >= 2 이면 파랑 실선 표시.
   * null 이면 경로선 제거. useTrailWaypoints 훅 결과를 그대로 전달.
   */
  trailWaypoints?: ReadonlyArray<{ lat: number; lng: number }> | null;
}
```

- [ ] **Step 3: MapShell 함수 destructuring에 `trailWaypoints` 추가**

`fitBoundsPadding = DEFAULT_FIT_BOUNDS_PADDING,` 다음:

```ts
// 변경 전:
  fitBoundsPadding = DEFAULT_FIT_BOUNDS_PADDING,
}: MapShellProps) {

// 변경 후:
  fitBoundsPadding = DEFAULT_FIT_BOUNDS_PADDING,
  trailWaypoints = null,
}: MapShellProps) {
```

- [ ] **Step 4: `trailPolylineRef` ref 추가**

`onStationSelectRef` 다음에 삽입:

```ts
// 변경 전:
  const onBikeSelectRef = useRef(onBikeSelect);
  const onStationSelectRef = useRef(onStationSelect);

// 변경 후:
  const onBikeSelectRef = useRef(onBikeSelect);
  const onStationSelectRef = useRef(onStationSelect);
  const trailPolylineRef = useRef<NaverPolylineInstance | null>(null);
```

- [ ] **Step 5: 테마 토글 시 기존 marker 정리 블록에 Polyline 정리 추가**

`prevDeliveryPhaseRef.current.clear();` 다음에 삽입:

```ts
// 변경 전:
    if (existing) {
      for (const m of bikeMarkerCacheRef.current.values()) m.setMap(null);
      for (const m of stationMarkerCacheRef.current.values()) m.setMap(null);
      bikeMarkerCacheRef.current.clear();
      stationMarkerCacheRef.current.clear();
      prevDeliveryPhaseRef.current.clear();
    }

// 변경 후:
    if (existing) {
      for (const m of bikeMarkerCacheRef.current.values()) m.setMap(null);
      for (const m of stationMarkerCacheRef.current.values()) m.setMap(null);
      bikeMarkerCacheRef.current.clear();
      stationMarkerCacheRef.current.clear();
      prevDeliveryPhaseRef.current.clear();
      trailPolylineRef.current?.setMap(null);
      trailPolylineRef.current = null;
    }
```

- [ ] **Step 6: Polyline 관리 useEffect 추가**

station markers `useEffect` (deps: `[sdkReady, stationPins, mapVersion, currentZoom]`) 바로 다음, `if (!NCP_CLIENT_ID)` 블록 바로 앞에 삽입:

```ts
  // 경로 trail Polyline — trailWaypoints 가 바뀔 때마다 재생성.
  // mapVersion dep 으로 테마 토글(NCP map 재생성) 시 새 map 에 재부착.
  useEffect(() => {
    if (!sdkReady) return;
    const map = mapRef.current;
    const naver = typeof window !== "undefined" ? window.naver : undefined;
    if (!map || !naver?.maps?.Polyline) return;

    // 이전 Polyline 제거 — waypoints 변경 시 항상 먼저 정리
    trailPolylineRef.current?.setMap(null);
    trailPolylineRef.current = null;

    if (!trailWaypoints || trailWaypoints.length < 2) return;

    const path = trailWaypoints.map((wp) => new naver.maps.LatLng(wp.lat, wp.lng));
    const polyline = new naver.maps.Polyline({
      map,
      path,
      strokeColor: "#3b82f6",
      strokeWeight: 4,
      strokeOpacity: 0.85,
      zIndex: 1
    });
    trailPolylineRef.current = polyline;

    return () => {
      trailPolylineRef.current?.setMap(null);
      trailPolylineRef.current = null;
    };
  }, [sdkReady, trailWaypoints, mapVersion]);
```

- [ ] **Step 7: 타입 검증**

```bash
npm run typecheck
```

Expected: 에러 없음.

- [ ] **Step 8: 커밋**

```bash
git add components/dashboard/MapShell.tsx
git commit -m "feat: MapShell — trailWaypoints prop + NCP Polyline 경로선 관리

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: OverviewMapBanner — 훅 연결

**Files:**
- Modify: `components/overview/OverviewMapBanner.tsx`

**배경:** `OverviewMapBanner`에서 `selectedBikeId`는 `useVehicleFilter()`에서 가져온다. 이미 있으므로 훅만 추가하고 결과를 MapShell에 넘기면 된다.

- [ ] **Step 1: import 추가**

파일 상단 import 블록에 추가:

```ts
// 기존 import들 다음에 추가:
import { useTrailWaypoints } from "@/components/overview/use-trail-waypoints";
```

- [ ] **Step 2: 훅 호출 추가**

`OverviewMapBanner` 함수 내부, `const overlaidBikePins = useSimulatedBikePins(bikePins);` 바로 다음에 삽입:

```ts
// 변경 전:
  const overlaidBikePins = useSimulatedBikePins(bikePins);

// 변경 후:
  const overlaidBikePins = useSimulatedBikePins(bikePins);
  const trailWaypoints = useTrailWaypoints(selectedBikeId);
```

- [ ] **Step 3: MapShell에 prop 전달**

`<MapShell` 에 `trailWaypoints={trailWaypoints}` 추가:

```tsx
// 변경 전:
          <MapShell
            bikePins={[...effectiveBikePins]}
            stationPins={[...stationPins]}
            targetLocation={targetLocation}
            onBikeSelect={setSelectedBikeId}
          />

// 변경 후:
          <MapShell
            bikePins={[...effectiveBikePins]}
            stationPins={[...stationPins]}
            targetLocation={targetLocation}
            onBikeSelect={setSelectedBikeId}
            trailWaypoints={trailWaypoints}
          />
```

- [ ] **Step 4: 타입 검증**

```bash
npm run typecheck
```

Expected: 에러 없음.

- [ ] **Step 5: 커밋**

```bash
git add components/overview/OverviewMapBanner.tsx
git commit -m "feat: OverviewMapBanner — trailWaypoints 훅 연결

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: FullscreenMapHost — 훅 연결

**Files:**
- Modify: `components/overview/FullscreenMapHost.tsx`

**배경:** `FullscreenMapHost`는 외부 shell(`FullscreenMapHost`)과 내부 렌더러(`FullscreenMapOverlay`) 두 컴포넌트로 나뉜다. `selectedBikeId`는 `FullscreenMapOverlay`가 prop으로 받으므로, 훅 호출도 `FullscreenMapOverlay` 안에 해야 한다. `FullscreenMapOverlay`는 이미 `useFleetSimulation()`을 직접 호출하므로 Provider가 있음을 보장한다.

- [ ] **Step 1: import 추가**

파일 상단 import 블록에 추가:

```ts
import { useTrailWaypoints } from "@/components/overview/use-trail-waypoints";
```

- [ ] **Step 2: `FullscreenMapOverlay` 내부에 훅 호출 추가**

`FullscreenMapOverlay` 함수 내부, `const overlaidBikePins = useSimulatedBikePins(bikePins);` 바로 다음:

```ts
// 변경 전:
  const overlaidBikePins = useSimulatedBikePins(bikePins);

// 변경 후:
  const overlaidBikePins = useSimulatedBikePins(bikePins);
  const trailWaypoints = useTrailWaypoints(selectedBikeId);
```

- [ ] **Step 3: MapShell에 prop 전달**

`FullscreenMapOverlay` 내부 `<MapShell`에 `trailWaypoints={trailWaypoints}` 추가:

```tsx
// 변경 전:
        <MapShell
          bikePins={[...visibleBikePins]}
          stationPins={[...visibleStationPins]}
          targetLocation={targetLocation}
          onBikeSelect={setSelectedBikeId}
          fitBoundsPadding={FULLSCREEN_FIT_BOUNDS_PADDING}
        />

// 변경 후:
        <MapShell
          bikePins={[...visibleBikePins]}
          stationPins={[...visibleStationPins]}
          targetLocation={targetLocation}
          onBikeSelect={setSelectedBikeId}
          fitBoundsPadding={FULLSCREEN_FIT_BOUNDS_PADDING}
          trailWaypoints={trailWaypoints}
        />
```

- [ ] **Step 4: 타입 검증**

```bash
npm run typecheck
```

Expected: 에러 없음.

- [ ] **Step 5: 커밋**

```bash
git add components/overview/FullscreenMapHost.tsx
git commit -m "feat: FullscreenMapHost — trailWaypoints 훅 연결

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: 최종 검증 + PR

**Files:** 없음 (검증 및 PR 생성만)

- [ ] **Step 1: 전체 타입 검증**

```bash
npm run typecheck
```

Expected: 에러 없음.

- [ ] **Step 2: lint 검증**

```bash
npm run lint
```

Expected: 에러 없음. (새 파일들이 ESLint 규칙 준수 확인)

- [ ] **Step 3: 빌드 검증**

```bash
npm run build 2>&1 | tail -20
```

Expected: `Route (app)` 테이블 출력 후 에러 없이 완료.

- [ ] **Step 4: PR 생성**

```bash
gh pr create \
  --title "feat: 차량 마커 클릭 시 이동 경로 trail 표시" \
  --body "$(cat <<'EOF'
## Summary
- 지도에서 차량 마커 클릭 → 해당 차량의 이동 경로를 파랑 실선(#3b82f6, 4px)으로 표시
- 상세 패널 닫기(또는 다른 마커 클릭) → 경로선 제거
- IMEI=-1 시뮬 차량: OSRM routeWaypoints 즉시 사용 (EN_ROUTE + fetch 완료 시)
- 실제 차량: API stub(null) — 백엔드 엔드포인트 완성 후 \`fetchBikeLocationHistory\` 교체

## Components
- \`useTrailWaypoints\` 훅: 시뮬/실제 차량 데이터 분기
- \`MapShell\`: NCP Polyline 생성·제거 (테마 토글 대응 포함)
- \`OverviewMapBanner\` / \`FullscreenMapHost\`: 훅 결과 prop 전달

## Test plan
- [ ] IMEI=-1 + EN_ROUTE 차량 마커 클릭 → 파랑 경로선 표시 확인
- [ ] 상세 패널 X 클릭 → 경로선 제거 확인
- [ ] 다른 마커 클릭 → 이전 경로선 제거 + 새 경로선 표시 확인
- [ ] 전체화면 모드에서도 동일하게 동작 확인
- [ ] 테마 토글(라이트/다크) 후 경로선 유지 확인

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)" \
  --base main \
  --head dev
```
