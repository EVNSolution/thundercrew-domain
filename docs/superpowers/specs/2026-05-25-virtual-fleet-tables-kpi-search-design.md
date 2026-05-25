# Virtual Fleet — Tables / KPI / Search Integration (PR-B) Design

## Goal

PR-A 가 데모 시작 시 20대 가상 차량 + 라이더를 생성하고 지도 마커로 노출
했다. 이 PR-B 는 그 가상 데이터를 **표 / KPI 카드 / 검색** 까지 통합해
데모 모드의 인상적 효과 (한 화면이 통째로 살아남) 를 완성한다. 도로
polyline (OSRM) 은 별도 PR-C.

## Non-Goals

- OSRM 도로 보간 — PR-C
- 가상 차량의 정비 / 보험 / 계약 / 교육 정보 — 표에 "—" 로 비워둠. 운영
  자가 한눈에 가상으로 식별 가능 + 가짜 데이터를 늘리는 부담 없음.
- KPI "보험 차량" 카운트에 가상 fleet 반영 — 가상 라이더는 보험 미가입
  이므로 어차피 0 기여
- 매칭 / 계약 탭의 가상 노출 — 데모 핵심 동선이 아님
- 가상 데이터를 실제 backend 에 보내는 동작 — 가상 차량 행에서 수정/
  삭제 버튼은 disable 또는 silent no-op

## Architecture

### 데이터 통합 패턴 — 클라이언트 overlay 일관 적용

기존에 `useSimulatedBikePins` / `useSimulatedCurrentTelemetry` 가 deterministic
dummy 위에 시뮬레이션을 overlay 한 패턴 그대로. 이 PR 은 가상 fleet 의
다른 필드들을 같은 패턴으로 overlay:

- 차량 표 데이터: `data.vehicles` ⊕ `virtualFleet.vehicles`
- 라이더 표 데이터: `data.riders` ⊕ `virtualFleet.riders`
- bike → rider 매핑: `bikeActiveRiderById` ⊕ `virtualFleet.bikeActiveRiderById`
- rider 조회: `riderInfoById` ⊕ `virtualFleet.riderInfoById`
- KPI 카운트: 서버 SSR 값 + 가상 fleet 보정

### Panel 단의 표 데이터 merge

`VehiclesPanel` 과 `RidersPanel` 이 각자:
```tsx
const { virtualFleet } = useFleetSimulation();
const effectiveVehicles = useMemo(() => {
  if (!virtualFleet) return data.vehicles;
  return [...data.vehicles, ...virtualFleet.vehicles];
}, [data.vehicles, virtualFleet]);
// existing filter / row 렌더링은 effectiveVehicles 사용
```

기존 `applyVehicleFilters` / `applyRiderFilters` 헬퍼가 받는 데이터만
바꾸면 됨 — 필터 동작은 그대로 작동.

### KPI 카드 — 새 클라이언트 컴포넌트로 분리

현재 `app/page.tsx` (server component) 가 `summary.totalBikes`,
`ignitionOnCount`, `insuredVehicleCount`, `totalRiders`,
`subscriptionRiderCount`, `rentalRiderCount` 6 개를 직접 JSX 로 렌더.
SSR 이라 fleet 상태를 못 봄.

해결: 새 `OverviewKpiTiles` client 컴포넌트로 추출.
- props: 서버에서 계산한 6 개 base count
- 내부에서 `useFleetSimulation()` 로 `virtualFleet` + `simulated` 읽음
- 그 위에 보정 값 계산:
  - 전체 차량: `summary.totalBikes + (virtualFleet ? 20 : 0)`
  - 시동 차량: server base + `Array.from(simulated.values()).filter(s => s.ignitionStatus === "ON" && s.bikeId.startsWith("virtual-bike-")).length`
    - 가상 차량의 시동 ON 만 더함 — 실제 차량은 SSR base 가 이미 카운트함
    - 실제 차량이 manual assign 으로 ON 인 경우는 카운팅 안 됨 (희소 케이스, 의도된 trade-off)
  - 보험 차량: 그대로 (가상은 0 기여)
  - 전체 라이더: `totalRiders + (virtualFleet ? 20 : 0)`
  - 구독 인원 / 렌탈 인원: 가상은 둘 다 0 기여 (계약 분류 없음). 그대로.

매 1초 tick 마다 시뮬레이션이 advance → context 변경 → 컴포넌트 재렌더 →
시동 차량 카운트가 자연스럽게 갱신.

### 검색 (OverviewMapSearch) — banner / fullscreen 에서 merge

`OverviewMapSearch` 는 props 로 `bikePins`, `stationPins`,
`bikeActiveRiderById`, `riderInfoById` 받음. PR-A 에서 bikePins 는 이미
merge 되어 들어감. 이 PR 은 rider 쪽 두 Map 도 merge:

```tsx
// OverviewMapBanner / FullscreenMapHost 안에서
const mergedBikeActiveRiderById = useMemo(() => {
  if (!virtualFleet) return bikeActiveRiderById;
  const m = new Map(bikeActiveRiderById ?? new Map());
  for (const [k, v] of virtualFleet.bikeActiveRiderById) m.set(k, v);
  return m;
}, [bikeActiveRiderById, virtualFleet]);

const mergedRiderInfoById = useMemo(() => {
  if (!virtualFleet) return riderInfoById;
  const m = new Map(riderInfoById ?? new Map());
  for (const [k, v] of virtualFleet.riderInfoById) m.set(k, v);
  return m;
}, [riderInfoById, virtualFleet]);
```

`<OverviewMapSearch>` 에 merged 값을 전달 → 가상 plate `99서0001` 도 검색
매칭, 가상 라이더 이름/연락처도 매칭.

### 차량 표 가상 row 의 시각적 식별

PR-A 의 sentinel pattern (`99서` plate, `데모 가상 N호기` 모델) 이 이미
시각적으로 명확. 추가 배지 없이도 운영자가 분간 가능.

행 클릭 시 `VehicleDetailDialog` 가 열리지만, 가상 차량은 maintenance
fetch (`/api/overview/vehicle-maintenance/{bikeId}`) 가 backend 에서 404
또는 빈 응답이 돌아옴 → 패널의 정비 섹션은 "정비 품목 없음" 으로 fallback.
의도된 동작 (가상 데이터에 정비 이력 없음).

라이더 표의 가상 row 도 행 클릭으로 `RiderDetailDialog` 가 열리되 본인
정보 + 매칭 차량 plate 외 다른 필드는 비어 있음.

### 가상 row 의 편집 / 삭제 차단

차량 / 라이더 표 행에는 삭제 버튼이 있음 (`DeleteVehicleButton`,
`DeleteRiderButton`). 가상 bikeId / riderId 가 `virtual-*` prefix 라 backend
에 보내면 404. 이 PR 에선 버튼을 그냥 두고 (운영자가 클릭해도 toast 로
실패 안내) — sentinel prefix 검사로 silent disable 하지 않음. 데모 중
삭제 시도는 흔치 않은 시나리오.

(차후 개선 여지: 가상 row 에 삭제 버튼 hidden / disabled 처리 — 이 PR
범위 밖.)

## User-visible behavior

- 페이지 진입 (데모 OFF): 평소대로 — 차량 표 2 행, 라이더 표 1 행, KPI
  실제 값
- `[데모 시작]` 클릭:
  - 즉시 KPI "전체 차량" 2 → 22, "전체 라이더" 1 → 21
  - 차량 표가 22 행으로 확장 (`99서0001`~`99서0020` 추가)
  - 라이더 표가 21 행으로 확장 (가상 라이더 20명 추가)
  - 검색 인풋에 `99서0005` 또는 가상 라이더 이름 (`김민수` 등) 타이핑 → 매칭 노출, 클릭 시 지도 자동 이동
  - 매 초 시동 차량 카운트가 시뮬레이션 진행에 따라 갱신 (가상 차량들이
    staggered 로 EN_ROUTE 진입할 때마다 +1, ARRIVED → IDLE 시 -1)
- `[데모 정지]`:
  - KPI / 표 / 검색 모두 원상 복구

## Error handling & edge cases

- **가상 row 클릭 → detail 다이얼로그 열림 → 정비/계약/보험 빈 상태**:
  의도된 동작. 패널 내부 fallback 메시지가 이미 처리.
- **가상 row 삭제 버튼 클릭**: backend 가 404 반환, server action 의 catch
  분기가 redirect 로 silent fail. 운영자는 데모 모드라 무시.
- **데모 시작/정지 사이 빠른 토글**: 각 토글마다 새 deterministic seed 가
  같으므로 같은 결과. 표 / KPI 즉시 반영.
- **표 필터로 가상 차량 검색**: `99서` 로 검색하면 가상 20대만, `123마`
  같은 실제 plate 로 검색하면 실제 1대만. 필터 helper 가 추출되어 있어
  자연스럽게 작동.
- **소트**: 차량 표 / 라이더 표가 기본 정렬을 갖는다면 가상 row 가 정렬
  키에 따라 적당한 위치에 삽입됨. 별도 처리 없음.

## Testing

- `npm run typecheck`, `npm run lint` clean
- 수동 smoke 체크리스트 (PR body 에 옮김)

## Out-of-scope follow-ups

- 가상 row 의 삭제 / 편집 버튼 hidden 처리
- 가상 차량에 maintenance / contract / insurance 가짜 데이터 첨가
- 매칭 / 계약 / 정비 catalog 탭에 가상 노출
- PR-C: OSRM 도로 polyline 보간
