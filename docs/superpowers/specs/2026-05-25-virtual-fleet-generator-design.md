# Virtual Fleet Generator (PR-A) — Design

## Goal

Demo 시작 시 실제 등록 차량 (현재 2대) 위에 가상의 20대 차량 + 라이더를
얹어 지도에서 함께 시뮬레이션. 이 PR 은 **데이터 생성 + 지도 마커 노출
+ 시뮬레이션 진입** 까지. 표/KPI/검색 통합은 PR-B, 도로 따라 이동
(OSRM) 은 PR-C.

## Non-Goals (이 PR)

- 차량 표 / 라이더 표에 가상 데이터 노출 — **PR-B**
- KPI 카운트 (전체 차량, 시동 차량 등) 에 가상 +20 반영 — **PR-B**
- 검색 (`OverviewMapSearch`) 에서 가상 차량/라이더 매칭 — **PR-B**
- 도로 polyline 보간 (OSRM) — **PR-C**
- 영구 저장 / 페이지 reload 후 데모 상태 복원 — 데이터는 클라이언트
  메모리만, 불필요

## Architecture

### 새 모듈 `lib/services/virtual-fleet.ts`

20대 가상 차량 + 20명 가상 라이더 + matching lookup 들을 deterministic
seed 로 한 번에 생성하는 pure 함수.

```ts
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
  /** riderId → { name, phone }. OverviewMapSearch / detail panel 의 라이더
   *  display 에 사용. */
  riderInfoById: Map<string, { name: string; phone: string }>;
};

export function generateVirtualFleet(input: {
  count?: number;        // default 20
  seedString?: string;   // default "demo-fleet-2026"
}): VirtualFleet;
```

생성 규칙:
- `bikeId`: `virtual-bike-${index}` (UUID 모양 prefix 로 실제 DB id 와 절대
  충돌 안 함)
- `plateNumber`: `99서0001` ~ `99서0020` (실제 운영자가 못 쓰는 99 시작
  번호 — DB id 와 마찬가지로 충돌 방지)
- `model`: `데모 가상 1호기` ~ `데모 가상 20호기` — 한눈에 가상 차량
  식별 가능
- `engineType`: 모두 `ELECTRIC`
- `operationStatus`: 모두 `IN_SERVICE` (시뮬레이션 대상이므로)
- `origin lat/lng`: 서울 박스 (37.44 ~ 37.65, 126.87 ~ 127.10) 내 seed
  해시 기반 deterministic random
- `batteryPercent`: 70~95 사이 seed 해시 기반
- `riderId`: `virtual-rider-${index}`
- `rider.name`: 한국 풀 (성: 김/이/박/정/최/조/윤/장/임/한, 이름: 민수/지영/
  준호/수빈/예은 ...) 에서 seed 해시로 deterministic 선택
- `rider.phone`: `010-99XX-YYYY` (99 prefix 로 가상 표시)

### `FleetSimulationContext` 확장

새 채널 추가:

```ts
type FleetSimulationContextValue = {
  // 기존
  fleetRunning: boolean;
  setFleetRunning: (running: boolean) => void;
  simulated: ReadonlyMap<string, SimulatedBikeState>;
  assignSingleBike: (bikeId: string) => void;
  cancelSingleBike: (bikeId: string) => void;
  seedBikePins: (pins: ReadonlyArray<FrontendDashboardBikePin>) => void;

  // 신규 — fleet OFF 면 null, fleet ON 면 generateVirtualFleet 결과
  virtualFleet: VirtualFleet | null;
};
```

`setFleetRunning(true)` 동작 변경:
1. `generateVirtualFleet()` 호출 → `virtualFleet` state set
2. 시뮬레이션 entry seed 시 `[...pinsRef.current, ...virtual.bikePins]` 순회
3. 가상 20대 + 실제 N대 모두 IDLE staggered entry 생성

`setFleetRunning(false)` 동작 변경:
1. `virtualFleet = null` set
2. 기존 tick cleanup 로직 (IDLE && !manualOrigin → cleanup) 이 가상 entry
   들도 다음 사이클에 자연스럽게 제거 — virtual bikeId 는 `pinsRef.current`
   에 없지만 cleanup 조건은 manualOrigin 만 보므로 영향 없음

### 지도 마커 통합

`OverviewMapBanner` / `FullscreenMapHost` 모두 동일 패턴으로 수정:

```tsx
const { virtualFleet } = useFleetSimulation();
const mergedRawPins = useMemo(() => {
  if (!virtualFleet) return bikePins;
  return [...bikePins, ...virtualFleet.bikePins];
}, [bikePins, virtualFleet]);
const overlaidBikePins = useSimulatedBikePins(mergedRawPins);
```

즉:
- fleet OFF: `bikePins` (실제 N대 + 기존 더미)
- fleet ON: `[...bikePins, ...virtualFleet.bikePins]` (실제 N대 + 가상 20대)
- 이후 `useSimulatedBikePins` 가 sim 상태로 위치를 overlay

`seedBikePins(mergedRawPins)` 도 같이 호출 → provider 의 `pinsRef.current`
가 가상 차량까지 포함하게 됨 (assignSingleBike 가 가상 차량에도 작동
가능 — bonus).

**중요**: `useEffect(() => seedBikePins(mergedRawPins), [mergedRawPins, seedBikePins])`
가 fleet on 시 가상 핀까지 포함해서 seed. 그러나 `setFleetRunning(true)`
은 그 effect 실행 BEFORE 호출되므로, fleet 시작 시점엔 pinsRef 에 아직
실제 차량만 있다. 해결: `setFleetRunning(true)` 가 자체적으로 virtual.bikePins
도 동시에 iterate (위 동작 변경 항목과 일치).

### 데이터 흐름 정리

```
[데모 시작] click
   ↓
setFleetRunning(true)
   ↓
generateVirtualFleet() → VirtualFleet 생성, state 에 저장
   ↓
seed simulated Map:
   - pinsRef.current (실 2대) → 2 entries
   - virtualFleet.bikePins (가상 20대) → 20 entries
   ↓ (rerender)
OverviewMapBanner / FullscreenMapHost 의 mergedRawPins 가 22개로 늘어남
   ↓
useSimulatedBikePins(mergedRawPins) 가 시뮬레이션 위치를 overlay
   ↓
MapShell 이 22개 마커 렌더
   ↓ 1초 tick
sim 상태 advance → 새 lat/lng → mergedRawPins 의 overlaid 결과 갱신 →
MapShell 마커 위치 업데이트
```

## User-visible behavior

- 페이지 진입: 평소대로 (실제 2대 + 더미 + 1 BSS)
- `[데모 시작]` 클릭:
  - 지도 위에 **즉시 22개 차량 마커** (실제 2대 + 가상 20대) 가 노출
  - 가상 20대 중 일부는 staggered 시점에 ASSIGNED → EN_ROUTE 전환
  - 5분 사이클로 무한 루프
  - **표 / KPI / 검색은 변화 없음** (PR-B 까지)
- `[데모 정지]` 클릭:
  - 가상 차량들이 현재 사이클 완료 후 IDLE 도달 시 사라짐
  - `virtualFleet` 가 null 로 — mergedRawPins 가 다시 실제 2대만
  - 마커 22개 → 2개 로 자연스럽게 줄어듦

## Error handling & edge cases

- **`generateVirtualFleet` 가 동기 (순수)** — 실패 케이스 없음
- **마커 plate 라벨 충돌**: virtual 차량의 `99서0001` 은 실제 운영자
  plate 와 절대 안 겹침. 99 prefix 가 운영 규약상 사용 안 됨
- **fleet 중간 페이지 reload**: virtualFleet state 사라짐, 데모 OFF 상태로
  복귀 (의도된 동작)
- **manual `[이 차량에 배정]` 가상 차량에**: 지도 마커 클릭이나 패널을
  통해 가상 bikeId 에 manual 배정도 가능. 단, 현재 PR 에선 가상 차량의
  detail panel 자체가 안 열림 (PR-B 에서 표/검색 통합 후) — 마커 직접
  클릭은 작동하나 사용자 입장에선 의미 적음. 그냥 두는 게 안전.

## Testing

- `npm run typecheck`, `npm run lint` clean
- 수동 smoke:
  - 데모 시작 → 지도에 ~22개 마커 노출, 일부 staggered 이동
  - 가상 마커 plate 라벨이 `99서0001` 등 — 한눈에 식별 가능
  - 데모 정지 → 가상 마커들 사라짐
  - 데모 다시 시작 → 같은 plate 라벨로 다시 등장 (deterministic seed)
  - 회귀: 실제 2대는 평소대로 (이름/계약/표 표시 정상)

## Out-of-scope follow-ups

- PR-B: 표 / KPI / 검색 / 라이더 detail 통합
- PR-C: OSRM polyline 보간
- 가상 차량의 maintenance / 보험 / 계약 정보 — PR-B 에서 결정
