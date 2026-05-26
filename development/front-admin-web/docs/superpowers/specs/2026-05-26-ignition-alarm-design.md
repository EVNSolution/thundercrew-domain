# Ignition Alarm — 시동 ON 말풍선 + 벨 알림 설계

## Goal

IMEI=-1 시뮬레이션 차량이 WORKING(작업) → MOVING(이동 중) 상태로 전환될 때(= 시동 켜짐),
지도 마커 위에 CSS 말풍선을 표시하고, 헤더 벨 아이콘 + 드롭다운 이력에 이벤트를 기록한다.
백엔드 변경 없음. 프론트엔드 전용.

## Architecture

```
fleet-simulation.ts        — ServicePhase 타입, ignitionOnAt 필드
FleetSimulationContext.tsx — tick loop에서 OFF→ON 감지 → addNotification()
NotificationContext.tsx    — ignition 이벤트 배열 + unreadCount + markAllRead
NotificationBell.tsx       — 헤더 벨 버튼 + 드롭다운 이력
use-simulated-bike-pins.ts — ignitionOnAt 필드 포함해 MapShell로 전달
MapShell.tsx               — 말풍선 HTML(CSS animation 자동 소멸)
app/page.tsx               — NotificationProvider 래핑, NotificationBell 헤더 추가
app/globals.css            — 말풍선 + 벨 CSS
```

## 파일별 상세

### 1. `lib/services/fleet-simulation.ts`

**타입 변경:**

```ts
// Before
export type DeliveryPhase = "IDLE" | "EN_ROUTE";

// After
export type ServicePhase = "WORKING" | "MOVING";
```

`SimulatedBikeState` 필드 변경:
- `phase: DeliveryPhase` → `phase: ServicePhase`
- 기존 `ignitionStatus: "ON" | "OFF"` 유지
- **신규 추가:** `ignitionOnAt: number | null`
  - WORKING→MOVING 전환 시 `nowMs` 로 설정
  - MOVING→WORKING 전환 시 `null` 로 초기화
  - `makeInitialState` 양쪽 다 `null` 로 초기화

`advanceBikeState` 내부 case 이름 `"IDLE"` → `"WORKING"`, `"EN_ROUTE"` → `"MOVING"` 변경.
WORKING→MOVING 전환 시: `ignitionOnAt: nowMs` 추가.
MOVING→WORKING 전환 시: `ignitionOnAt: null` 추가.

상수명 변경:
- `EN_ROUTE_DURATION_*` → `MOVING_DURATION_*`
- `IDLE_BETWEEN_*` → `WORKING_BETWEEN_*`

### 2. `components/layout/NotificationContext.tsx` (신규)

```ts
type IgnitionNotification = {
  id: string;           // crypto.randomUUID() 또는 `${bikeId}-${startedAt}`
  plateNumber: string;  // 번호판 (없으면 bikeId 앞 8자리)
  startedAt: number;    // ms timestamp
};

type NotificationContextValue = {
  notifications: IgnitionNotification[];
  unreadCount: number;
  addNotification: (n: Omit<IgnitionNotification, "id">) => void;
  markAllRead: () => void;
};
```

- `notifications`: 최대 20건 유지 (초과 시 오래된 것부터 제거)
- `unreadCount = Math.max(0, notifications.length - readCount)`
- `markAllRead`: `setReadCount(notifications.length)`
- Provider: `"use client"`, Context API

### 3. `components/layout/NotificationBell.tsx` (신규)

- `"use client"`, `useNotifications()` 사용
- 벨 버튼(🔔) + 읽지 않은 수 배지
- 클릭 시 드롭다운 토글
- 드롭다운: `role="list"`, 항목마다 `role="listitem"`
- 항목 내용: `"🔑 {plateNumber} 이동 시작"` + 상대 시간 (`방금`, `N분 전`)
- 드롭다운 열릴 때 `markAllRead()` 호출 → 배지 초기화
- 외부 클릭(backdrop) 시 닫힘

### 4. `components/overview/FleetSimulationContext.tsx`

- 상단 import: `ServicePhase` (기존 `DeliveryPhase` 제거)
- `useNotifications()` import 추가 — Provider 안에 있으므로 안전
- tick loop (`setSimulated` 내부):
  ```ts
  const prevIgnition = state.ignitionStatus;
  const advanced = advanceBikeState(state, nowMs, isMatched);
  if (prevIgnition === "OFF" && advanced.ignitionStatus === "ON") {
    const pin = pinsRef.current.find(p => p.bikeId === bikeId);
    const plateNumber = pin?.plateNumber ?? bikeId.slice(0, 8);
    addNotification({ plateNumber, startedAt: nowMs });
  }
  ```
  주의: `addNotification`은 setState 외부에서 호출해야 함 (setState 안에서 다른 setState 호출 금지). 전환 이벤트 수집 후 setSimulated 완료 후 별도 호출.

  구체적 패턴:
  ```ts
  const events: { plateNumber: string; startedAt: number }[] = [];
  setSimulated(prev => {
    ...
    if (prevIgnition === "OFF" && advanced.ignitionStatus === "ON") {
      events.push({ plateNumber, startedAt: nowMs });
    }
    ...
  });
  // setSimulated 후
  events.forEach(e => addNotification(e));
  ```
  단, `setInterval` 콜백 안에서 `addNotification`이 stale 되지 않도록 ref로 안정화.

### 5. `components/overview/use-simulated-bike-pins.ts`

`SimulatedBikePin` 타입 확장:
```ts
export type SimulatedBikePin = FrontendDashboardBikePin & {
  servicePhase: ServicePhase | null;   // deliveryPhase → servicePhase
  deliveryCount?: number;
  ignitionOnAt?: number | null;        // 신규
};
```

`useSimulatedBikePins` 반환 시:
- `deliveryPhase: sim.phase` → `servicePhase: sim.phase`
- `ignitionOnAt: sim.ignitionOnAt` 추가

### 6. `components/dashboard/MapShell.tsx`

**props 타입 변경:**
```ts
bikePins?: Array<
  FrontendDashboardBikePin & {
    servicePhase?: ServicePhase | null;
    deliveryCount?: number;
    ignitionOnAt?: number | null;  // 신규
  }
>
```

`prevDeliveryPhaseRef` → `prevServicePhaseRef` (타입도 `ServicePhase | null`).

`bikeMarkerHtml` 시그니처:
```ts
function bikeMarkerHtml(
  plateNumber: string,
  showLabel: boolean,
  servicePhase?: ServicePhase | null,
  deliveryCount?: number,
  ignitionOnAt?: number | null   // 신규
): string
```

**말풍선 포함 조건:**
```ts
const showBubble = ignitionOnAt != null && Date.now() - ignitionOnAt < 4_000;
```
`showBubble` 이 true 이면 `markerWrapper` 에 말풍선 HTML 추가.

**말풍선 HTML 예시:**
```html
<div class="map-ignition-bubble">🔑 이동 시작</div>
```
CSS `animation: ignition-bubble-fade 4s forwards` 으로 자동 소멸.

**`deliveryBadgeMarkup` → `serviceBadgeMarkup` 이름 변경:**
- `"EN_ROUTE"` / `"배송 중"` → `"MOVING"` / `"이동 중"`
- `"IDLE"` / `"대기"` → `"WORKING"` / `"작업"`

**마커 재생성 트리거 추가:**
현재 `prevDeliveryPhaseRef` 비교만으로 재생성 여부 결정. 말풍선은 CSS animation으로 자동 소멸하므로 추가 재생성 트리거 불필요. 단, phase가 WORKING→MOVING으로 바뀔 때 자연스럽게 마커가 재생성되어 말풍선 HTML이 포함됨.

### 7. `app/page.tsx`

- `NotificationProvider`로 전체 반환을 래핑
- `NotificationBell`을 헤더 내 적절한 위치에 추가 (overview-tab-action 영역 등)
- `FleetSimulationProvider`는 `NotificationProvider` 안에 위치

### 8. `app/globals.css`

말풍선 CSS:
```css
.map-ignition-bubble {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  background: #1d4ed8;
  color: #fff;
  font-size: 11px;
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

벨 + 드롭다운 CSS: `.notif-bell-btn`, `.notif-badge`, `.notif-dropdown`, `.notif-item` 등.

## 렌더 트리

```
NotificationProvider
  FleetSimulationProvider       ← useNotifications() 사용 가능
    OverviewClientShell
      ...
      NotificationBell          ← 헤더
      OverviewMapBanner / FullscreenMapHost
        MapShell (bikePins with servicePhase + ignitionOnAt)
```

## 엣지 케이스

- **페이지 재방문 시 말풍선 재노출 방지:** `ignitionOnAt`이 4초를 초과하면 `showBubble = false` → 마커 재생성 시 말풍선 HTML 미포함.
- **addNotification stale closure:** `addNotificationRef`로 최신 함수 참조 유지.
- **notifications 최대 20건:** 초과 항목은 `slice(-20)` 또는 최신 20건 유지.
- **plateNumber 없는 경우:** `bikeId.slice(0, 8)` fallback.
