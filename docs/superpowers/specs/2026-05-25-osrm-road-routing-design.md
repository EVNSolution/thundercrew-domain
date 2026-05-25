# OSRM Road Routing (PR-C) Design

## Goal

PR-A/B 가 가상 20대 + 실제 차량을 지도에 올리고 표/KPI/검색까지 통합했다.
이 PR-C 는 EN_ROUTE 중 차량 이동을 **직선 lerp → 실제 도로 경로(OSRM)**로
교체하고, 지도 마커에 **배송 상태 레이블** (배정됨 / 배송 중 / 배송 완료) 을
추가해 데모의 현실감을 완성한다.

## Non-Goals

- OSRM 자체 호스팅 — 공개 demo 서버 (`router.project-osrm.org`) 사용
- EN_ROUTE 소요 시간 변경 — 300 초 고정 유지 (경로 모양만 OSRM)
- 실제 배송 도메인 로직 — 시뮬레이션 전용
- 마커 클릭 팝업 / 상세 다이얼로그 변경
- BSS 마커 변경

## Architecture

### 새 모듈 `lib/services/osrm.ts`

```ts
/**
 * OSRM public demo 서버에서 두 좌표 간 도로 경로를 fetch.
 * 실패(네트워크 오류, timeout, rate limit) 시 빈 배열 반환 →
 * 호출부는 null routeWaypoints 로 직선 lerp fallback.
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
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const json = await res.json();
    const coords: [number, number][] = json.routes?.[0]?.geometry?.coordinates ?? [];
    // OSRM 좌표 순서: [lng, lat] → {lat, lng} 변환
    return coords.map(([lng, lat]) => ({ lat, lng }));
  } catch {
    return [];
  }
}
```

- `AbortSignal.timeout(5000)` — 5 초 내 응답 없으면 abort, 빈 배열 fallback
- CORS: `router.project-osrm.org` 는 공개 CORS 허용

### `SimulatedBikeState` 확장 (`lib/services/fleet-simulation.ts`)

새 필드 추가:

```ts
routeWaypoints: ReadonlyArray<{ lat: number; lng: number }> | null;
```

- `null` = 아직 OSRM 경로 없음 → 직선 lerp fallback
- 배열 = OSRM 경유점 배열
- ASSIGNED 진입 시 `null` 로 초기화 (이전 사이클 경로 클리어)
- ARRIVED → IDLE 전환 시에도 `null` 로 초기화

### `walkPolyline` 함수 (`lib/services/fleet-simulation.ts`)

```ts
/**
 * 0..1 의 progress t 로 polyline 위 좌표 계산.
 * N 개 waypoint → N-1 세그먼트를 시간 균등 분배.
 * t=0 → waypoints[0], t=1 → waypoints[N-1].
 */
function walkPolyline(
  waypoints: ReadonlyArray<{ lat: number; lng: number }>,
  t: number
): { lat: number; lng: number } {
  if (waypoints.length === 1) return waypoints[0];
  const clamped = Math.max(0, Math.min(1, t));
  const totalSegs = waypoints.length - 1;
  const pos = clamped * totalSegs;
  const segIndex = Math.min(Math.floor(pos), totalSegs - 1);
  const segT = pos - segIndex;
  return lerpPosition(waypoints[segIndex], waypoints[segIndex + 1], segT);
}
```

`advanceBikeState` EN_ROUTE 분기 변경:

```ts
// 기존
position: lerpPosition(state.origin, state.destination, progress),

// 변경
position: state.routeWaypoints
  ? walkPolyline(state.routeWaypoints, progress)
  : lerpPosition(state.origin, state.destination, progress),
```

### OSRM fetch 트리거 (`FleetSimulationContext.tsx`)

`pendingFetchesRef: React.MutableRefObject<Set<string>>` 를 컨텍스트 내에 추가.

새 `useEffect` — `simulated` 변경을 감시해 ASSIGNED 상태이면서 `routeWaypoints === null` 이고 아직 fetch 중이지 않은 bike 를 발견하면 fetch 실행:

```tsx
const pendingFetchesRef = useRef<Set<string>>(new Set());

useEffect(() => {
  for (const [bikeId, state] of simulated) {
    if (
      state.phase === "ASSIGNED" &&
      state.routeWaypoints === null &&
      !pendingFetchesRef.current.has(bikeId)
    ) {
      pendingFetchesRef.current.add(bikeId);
      fetchOsrmRoute(state.origin, state.destination!).then((waypoints) => {
        pendingFetchesRef.current.delete(bikeId);
        if (waypoints.length === 0) return; // fallback: null 유지 → 직선 lerp
        setSimulated((prev) => {
          const current = prev.get(bikeId);
          // stale guard: bike 가 이미 IDLE 로 돌아갔으면 무시
          if (!current || current.phase === "IDLE") return prev;
          const next = new Map(prev);
          next.set(bikeId, { ...current, routeWaypoints: waypoints });
          return next;
        });
      });
    }
  }
}, [simulated]);
```

- ASSIGNED 5 초 → OSRM 응답 보통 200–500 ms → EN_ROUTE 진입 전 경로 준비 완료
- 응답 미도착 시 EN_ROUTE 진입 → 직선 이동 → route 도착 시 남은 구간부터 도로 경로 전환 (자연스러운 점진 교체)

### 배송 상태 레이블 — 마커 overlay

`useSimulatedBikePins` 훅이 `FrontendDashboardBikePin[]` 를 반환하는 대신
클라이언트 전용 타입 `SimulatedBikePin` 을 반환하도록 확장:

```ts
// hooks/useSimulatedBikePins.ts (또는 현재 위치)
export type SimulatedBikePin = FrontendDashboardBikePin & {
  deliveryPhase: "IDLE" | "ASSIGNED" | "EN_ROUTE" | "ARRIVED" | null;
};
```

`useSimulatedBikePins` 내부에서 `simulated.get(bikeId)?.phase` 를 읽어
`deliveryPhase` 를 overlay. simulated 에 없으면 `null`.

`MapShell` (또는 마커 렌더링 레이어) 에서 `deliveryPhase` 에 따라 마커 HTML
에 배지 추가:

| `deliveryPhase` | 배지 텍스트 | 색상 |
|---|---|---|
| `null` / `"IDLE"` | (없음) | — |
| `"ASSIGNED"` | `배정됨` | 노란색 |
| `"EN_ROUTE"` | `배송 중` | 파란색 |
| `"ARRIVED"` | `배송 완료` | 초록색 |

마커 HTML 구조 (현재 plate 라벨 아래에 배지 추가):
```html
<div class="bike-marker">
  <div class="bike-marker__plate">99서0001</div>
  <!-- deliveryPhase 가 ASSIGNED/EN_ROUTE/ARRIVED 일 때만 렌더 -->
  <div class="bike-marker__badge bike-marker__badge--en-route">배송 중</div>
</div>
```

마커 아이콘은 Naver Maps `naver.maps.Marker` 의 `icon.content` (HTML string)
방식으로 교체하거나, 기존 방식에 맞게 적용. 현재 마커 렌더 방식을 먼저
확인하고 최소 변경으로 적용.

## 파일 구조

| 경로 | 목적 | Action |
|---|---|---|
| `lib/services/osrm.ts` | OSRM fetch 순수 함수 | **Create** |
| `lib/services/fleet-simulation.ts` | `routeWaypoints` 필드, `walkPolyline`, `advanceBikeState` 수정 | **Modify** |
| `components/overview/FleetSimulationContext.tsx` | `pendingFetchesRef` + OSRM fetch `useEffect` | **Modify** |
| `hooks/useSimulatedBikePins.ts` (위치 확인 필요) | `SimulatedBikePin` 타입, `deliveryPhase` overlay | **Modify** |
| `components/dashboard/MapShell.tsx` | 마커 HTML에 배송 배지 추가 | **Modify** |
| (CSS) | `.bike-marker__badge` 스타일 | **Modify** |

## User-visible behavior

- **fleet OFF**: 평소대로 — 마커 레이블 없음, 직선 이동
- **데모 시작 → 차량 ASSIGNED**: 마커에 `배정됨` 배지 노출
- **EN_ROUTE**: `배송 중` 배지 + 서울 도로망을 따라 이동 (직선 X)
- **ARRIVED**: `배송 완료` 배지 + 차량 멈춤 (10초)
- **IDLE**: 배지 사라짐, 다음 사이클 대기
- **OSRM 실패**: 배지는 그대로, 이동만 직선 — 사용자가 차이를 느끼기 어려움

## Error handling & edge cases

- **OSRM 응답 5 초 초과**: abort → 빈 배열 → 직선 lerp fallback
- **fetch 중 fleet 정지**: stale guard (`phase === "IDLE"` 체크) → 무시
- **EN_ROUTE 진입 전 route 미도착**: 직선 이동 → route 도착 시 도로 경로로 점진 전환
- **동일 bikeId 중복 fetch**: `pendingFetchesRef` Set 으로 방지
- **가상 + 실제 차량 모두 적용**: `routeWaypoints` 로직은 bikeId prefix 무관하게 동작

## Testing

- `npm run typecheck`, `npm run lint` clean
- 수동 smoke:
  - 데모 시작 → 차량이 도로를 따라 이동하는지 확인
  - 배지 ASSIGNED → 배송 중 → 배송 완료 → 사라짐 순서 확인
  - 네트워크 탭에서 OSRM API 호출 확인
  - 오프라인 모드 or OSRM 차단 시 직선 이동으로 graceful fallback 확인

## Out-of-scope follow-ups

- OSRM 자체 호스팅 / Kakao 지도 Directions API 교체
- EN_ROUTE 소요 시간을 OSRM 실제 duration 으로 스케일
- 경로 polyline 을 지도에 선으로 표시 (차량 이동 궤적 시각화)
