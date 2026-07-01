# 차량 이동 경로 Trail 표시 설계

**Goal:** 지도에서 마커를 클릭하면 해당 차량의 이동 경로를 파랑 실선으로 오버레이하고, 상세 패널을 닫으면 경로선도 함께 제거한다.

**Architecture:** `useTrailWaypoints` 훅이 데이터 해석을 담당(시뮬 vs 실제 차량 분기), `MapShell`이 NCP `Polyline` 렌더링을 담당. 두 부모 컴포넌트(`OverviewMapBanner`, `FullscreenMapHost`)는 훅 결과를 prop으로 전달하는 역할만 한다.

**Tech Stack:** NCP Maps Web SDK (`naver.maps.Polyline`), React hooks, TypeScript

---

## 데이터 소스

| 차량 종류 | 경로 데이터 출처 | 현재 상태 |
|---|---|---|
| IMEI=-1 시뮬 차량 | `FleetSimulationContext`의 `sim.routeWaypoints` (OSRM 경로) | 즉시 사용 가능 |
| 실제 차량 | 서버 GPS 이력 API | stub(null 반환) — 백엔드 API 완성 후 교체 |

시뮬 차량이라도 `phase === "IDLE"` 이거나 OSRM fetch 미완료(`routeWaypoints === null`)이면 경로 없음 → 선 표시 안 함.

---

## 데이터 흐름

```
마커 클릭
  → VehicleFilterContext.setSelectedBikeId(bikeId)

useTrailWaypoints(selectedBikeId)
  ├─ null          → null 반환
  ├─ 시뮬 차량
  │   ├─ EN_ROUTE + routeWaypoints 있음  → waypoints 반환
  │   └─ IDLE 또는 fetch 중             → null 반환
  └─ 실제 차량     → null 반환 (stub)

trailWaypoints prop → MapShell
  ├─ non-null, length ≥ 2  → NCP Polyline 생성/갱신
  └─ null 또는 length < 2  → Polyline 제거

상세 패널 닫기
  → setSelectedBikeId(null)
  → useTrailWaypoints → null
  → Polyline 제거
```

---

## 파일 목록

| 파일 | 변경 종류 | 내용 |
|---|---|---|
| `components/overview/use-trail-waypoints.ts` | 신규 | 훅 — 데이터 해석 |
| `lib/services/bike-location-history.ts` | 신규 | API stub (null 반환) |
| `types/naver-maps.d.ts` | 수정 | `Polyline` 타입 추가 |
| `components/dashboard/MapShell.tsx` | 수정 | `trailWaypoints` prop + Polyline 관리 |
| `components/overview/OverviewMapBanner.tsx` | 수정 | 훅 사용 + prop 전달 |
| `components/overview/FullscreenMapHost.tsx` | 수정 | 훅 사용 + prop 전달 |

---

## 상세 설계

### `use-trail-waypoints.ts`

```ts
"use client";

import { useMemo } from "react";
import { useFleetSimulation } from "@/components/overview/FleetSimulationContext";

export type TrailWaypoint = { lat: number; lng: number };

export function useTrailWaypoints(
  selectedBikeId: string | null
): ReadonlyArray<TrailWaypoint> | null {
  const { simulated } = useFleetSimulation();

  return useMemo(() => {
    if (!selectedBikeId) return null;

    // IMEI=-1 시뮬 차량: FleetSimulationContext에서 OSRM 경로 직접 읽기
    const sim = simulated.get(selectedBikeId);
    if (sim) {
      if (sim.phase === "EN_ROUTE" && sim.routeWaypoints && sim.routeWaypoints.length >= 2) {
        return sim.routeWaypoints;
      }
      return null; // IDLE 또는 OSRM fetch 중
    }

    // 실제 차량: API stub — 나중에 fetchBikeLocationHistory(selectedBikeId) 로 교체
    return null;
  }, [selectedBikeId, simulated]);
}
```

### `lib/services/bike-location-history.ts`

```ts
export type BikeLocationPoint = { lat: number; lng: number; recordedAt?: string };

/**
 * 차량 GPS 이력 조회 stub.
 * 백엔드 API `/telemetry/bikes/:bikeId/location-history` 완성 후 실제 fetch로 교체.
 */
export async function fetchBikeLocationHistory(
  _bikeId: string
): Promise<BikeLocationPoint[]> {
  return [];
}
```

### `types/naver-maps.d.ts` 추가

`NaverMapsNamespace`에 `Polyline: NaverPolylineConstructor` 추가.

새 인터페이스:
```ts
interface NaverPolylineConstructor {
  new (options: NaverPolylineOptions): NaverPolylineInstance;
}
interface NaverPolylineOptions {
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

### `MapShell.tsx` 변경

**prop 추가:**
```ts
trailWaypoints?: ReadonlyArray<{ lat: number; lng: number }> | null;
```

**ref 추가:**
```ts
const trailPolylineRef = useRef<NaverPolylineInstance | null>(null);
```

**useEffect 추가 (`[sdkReady, trailWaypoints, mapVersion]` dep):**
```ts
useEffect(() => {
  const map = mapRef.current;
  const naver = typeof window !== "undefined" ? window.naver : undefined;
  if (!map || !naver?.maps?.Polyline) return;

  // 기존 Polyline 제거
  trailPolylineRef.current?.setMap(null);
  trailPolylineRef.current = null;

  if (!trailWaypoints || trailWaypoints.length < 2) return;

  const path = trailWaypoints.map((wp) => new naver.maps.LatLng(wp.lat, wp.lng));
  trailPolylineRef.current = new naver.maps.Polyline({
    map,
    path,
    strokeColor: "#3b82f6",
    strokeWeight: 4,
    strokeOpacity: 0.85,
    zIndex: 1
  });

  return () => {
    trailPolylineRef.current?.setMap(null);
    trailPolylineRef.current = null;
  };
}, [sdkReady, trailWaypoints, mapVersion]);
```

**theme toggle(map 재생성) 시 cleanup:**
기존 marker 정리 블록에 `trailPolylineRef.current?.setMap(null); trailPolylineRef.current = null;` 추가.

### `OverviewMapBanner.tsx` / `FullscreenMapHost.tsx` (동일 패턴)

```ts
import { useTrailWaypoints } from "@/components/overview/use-trail-waypoints";

// 컴포넌트 내부
const trailWaypoints = useTrailWaypoints(selectedBikeId);

// MapShell prop
<MapShell trailWaypoints={trailWaypoints} ... />
```

---

## 경계 조건

| 케이스 | 처리 |
|---|---|
| 시뮬 차량 IDLE 중 클릭 | `routeWaypoints === null` → 선 없음 |
| OSRM fetch 완료 전 클릭 | `routeWaypoints === null` → 선 없음, fetch 완료되면 `simulated` 업데이트 → hook 재계산 → 선 표시 |
| 다른 마커 클릭 | `selectedBikeId` 교체 → 이전 선 제거 후 새 선 표시 |
| 상세 패널 닫기 | `setSelectedBikeId(null)` → null → 선 제거 |
| 테마 토글 (지도 재생성) | `mapVersion` 증가 → polyline effect 재실행 → 새 map에 polyline 재부착 |
| waypoints 1개 이하 | 조건 분기로 Polyline 생성 건너뜀 |
