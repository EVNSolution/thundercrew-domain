# Group C3 — 클리닝 배차 통합 (시동 알림 → dispatch 큐) Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement the plan derived from this spec.

**Goal:** CLEANING 차량의 시뮬레이션 이동·시동(출발) 알림 소스를 옛 `BikeNextCustomer`(현재/다음 고객 + promote)에서 **C0/C2의 DispatchOrder 큐 '현재 배차'**로 완전 이전한다. 백엔드 변경 없이 프론트엔드 배선만 교체한다.

**Architecture:** C0/C2가 이미 대시보드 BikePin에 `currentDispatchCustomerName/Address/Latitude/Longitude` + `dispatchQueueCount`를 실어 보내고, `completeDispatchOrderAction(id)`가 `/`·`/management`를 revalidate한다. C3는 기존 fleet-simulation + ignition-alarm(벨/말풍선) 인프라가 읽는 목적지·알림 소스를 next-customer에서 currentDispatch로 바꾸고, "완료" 클릭으로 큐가 진행되면 차량이 다음 현재 배차로 재출발하도록 연결한다.

**Tech Stack:** Next.js App Router, React Context, TypeScript. (백엔드/DB 변경 없음.)

---

## 1. 범위

### 이번 스펙 (C3)
- CLEANING 차량 시뮬레이션 목적지 소스: `nextCustomer*` → `currentDispatch*`.
- 시동(WORKING→MOVING) 알림: 현재 배차 고객명 + 주소를 벨/말풍선에 표시.
- 도착 후 운영자 "완료" 클릭 → 큐 진행 → 차량이 다음 현재 배차로 재출발(중복 출발 방지 가드).
- 차량 상세에서 CLEANING의 옛 "다음 고객" 섹션 제거(C0/C2 "배차 큐" 섹션과 중복 제거).
- 옛 `promoteNextToCurrentAction` 호출 제거(프론트에서 next-customer 경로 단절).

### 범위 외 (후속/별도)
- 실제 텔레메트리 시동 이벤트 기반 알림 (`TelemetryIgnitionStatus`)
- 고객 SMS/푸시 등 외부 메시징
- 배차형(DELIVERY)/배민(C1)/유모차(C4) 알림
- 백엔드 DB·엔티티 변경, 옛 `BikeNextCustomer` 백엔드 삭제(휴면으로 남김)

---

## 2. 핵심 동작 결정 (확정)

| 항목 | 결정 |
|---|---|
| 알림 성격 | **새 dispatch 큐와 통합** (시뮬레이션 기반, 운영자 콘솔 내부 벨/말풍선) |
| next-customer | **완전 이전** — CLEANING은 dispatch 큐로만 구동, 옛 promote 경로는 CLEANING에서 단절 |
| 도착 후 진행 | **운영자 "완료" 클릭** → 다음 건이 현재 배차로 승격 → 차량 재출발 (C0 결정과 일관) |
| 데이터 소스 | **프론트엔드 전용 (Approach A)** — 백엔드 무변경. currentDispatch 좌표/고객명/주소는 이미 BikePin에 존재 |
| 현재 배차 신원 | 복합키 `"lat,lng,customerName"` (주문 id를 pin에 추가하지 않음) |
| 알림 표시 정보 | 고객명 + 주소 (전화번호는 BikePin에 없어 미사용 — 클리닝엔 주소가 유용) |

---

## 3. 변경 파일 (모두 front-admin-web)

### 3.1 `components/overview/FleetSimulationContext.tsx` (핵심)

**목적지 소스 교체 (자동 트리거 effect + tick loop):**
CLEANING 차량의 목적지 계산을 `pin.nextCustomerLat/Lng` → **`pin.currentDispatchLatitude/Longitude`**로 변경.
```ts
const dispatchDestination =
  pin?.serviceType === "CLEANING" &&
  pin.currentDispatchLatitude != null &&
  pin.currentDispatchLongitude != null
    ? { lat: pin.currentDispatchLatitude, lng: pin.currentDispatchLongitude }
    : null;
```
이 값을 `makeInitialState({ ..., nextCustomerDestination: dispatchDestination })` 및 tick loop의 `newDest`로 전달(기존 destination 동기화 로직 재사용).

**출발(시동 ON) effect 재작성:**
- 알림: `currentDispatchCustomerName` + `currentDispatchAddress` 사용.
  ```ts
  addNotification({
    plateNumber,
    startedAt: state.ignitionOnAt,
    customerName: pin?.currentDispatchCustomerName ?? undefined,
    address: pin?.currentDispatchAddress ?? undefined,
  });
  ```
- **`promoteNextToCurrentAction(bikeId)` 호출 제거.**
- **pinsRef의 nextCustomer 초기화 블록 제거** (DB 상태를 못 지우므로 대신 가드 사용).

**신규 중복 출발 방지 가드:**
```ts
// bikeId → 마지막으로 출발한 현재 배차의 복합키. 같은 건으론 재출발하지 않음.
const lastDepartedDispatchKeyRef = useRef<Map<string, string>>(new Map());

function dispatchKey(pin): string | null {
  if (pin?.currentDispatchLatitude == null || pin?.currentDispatchLongitude == null) return null;
  return `${pin.currentDispatchLatitude},${pin.currentDispatchLongitude},${pin.currentDispatchCustomerName ?? ""}`;
}
```
시동 ON 감지 시 현재 배차 키가 `lastDepartedDispatchKeyRef`와 다를 때만 알림+출발로 간주하고 키를 갱신. 운영자 완료 → 큐 진행 → currentDispatch 좌표/고객이 다음 건으로 바뀜 → 키 변경 → 재출발. 시뮬레이션에서 사라진 bike의 ref 항목은 정리.

**`updatePinNextCustomer`:** CLEANING의 next-customer 즉시 갱신용이었으나 더 이상 next-customer를 쓰지 않으므로 제거하거나 no-op로 유지. (제거 시 호출처 정리 필요 — 3.3 참조.)

### 3.2 `lib/services/fleet-simulation.ts`

내부 `nextCustomerDestination` 필드는 CLEANING 이동 목적지로 그대로 재사용한다(소스만 currentDispatch로 교체되므로 필드 의미는 "현재 배차지"로 일반화됨). 명확성을 위해 `dispatchDestination`로 리네임하는 것은 선택 — 리네임 시 `makeInitialState`/`advanceBikeState`/`SimulatedBikeState`의 모든 참조를 함께 변경. **기본 방침: 리네임하지 않고 재사용**(churn 최소화), 주석으로 "currentDispatch 좌표가 들어온다"를 명시. 도착→대기(IDLE, phaseEndsAt=Infinity) 로직은 변경 없음.

### 3.3 `components/management/VehicleDetailDialog.tsx`

- CLEANING 차량의 **옛 "다음 고객"(NextCustomerSection) UI 제거** — C0/C2에서 추가한 "배차 큐"(DispatchQueueSection) 섹션이 현재/대기 + 완료/취소를 이미 제공하므로 중복.
- DispatchQueueSection의 "완료" 버튼은 `completeDispatchOrderAction(id)` → `revalidatePath("/")`로 pin이 갱신되어 시뮬레이션이 다음 현재 배차로 재출발. (즉시성 보강용 client-side pin 갱신 헬퍼 추가 여부는 plan 단계에서 결정 — 기본은 revalidate 의존.)
- `getNextCustomerAction`/`setNextCustomerAction`/`promoteNextToCurrentAction`이 이 다이얼로그 외 사용처가 없으면 import/호출 제거.

### 3.4 `components/layout/NotificationContext.tsx` + `NotificationBell.tsx`

- `IgnitionNotification`에 선택적 `address?: string` 추가.
- 벨 항목 텍스트: `"🔑 {plateNumber} 출발"` + 고객명 있으면 `" → {customerName}"`, 주소 있으면 `" ({address})"`.
- 기존 `customerPhone` 필드는 유지하되 C3에서는 set하지 않음(undefined).

### 3.5 `components/dashboard/MapShell.tsx` (선택, 다듬기)

지도 말풍선 텍스트 `"🔑 이동 시작"` → 현재 배차 고객이 있으면 `"🔑 {고객명} 출발"`. bikePin에 이미 `currentDispatchCustomerName`이 있으므로 `bikeMarkerHtml` 시그니처에 해당 값을 넘겨 말풍선에 반영. 데이터 없으면 기존 문구 유지.

---

## 4. 데이터 흐름

```
[엑셀(C2)] CLEANING 차량들에 DispatchOrder 큐 적재(ASSIGNED, sequence)
[대시보드] map-state → BikePin.currentDispatch*(첫 ASSIGNED) + dispatchQueueCount
[시뮬레이션] CLEANING + 매칭 + currentDispatch 좌표 있음 → MOVING(현재 배차지로)
   시동 ON(WORKING→MOVING) & 현재 배차 키 변경 → 벨/말풍선(고객명+주소)
[차량] 현재 배차지 도착 → IDLE(대기), 같은 건으론 재출발 안 함
[운영자] 차량 상세 "배차 큐" → 완료 클릭 → completeDispatchOrderAction
   → 해당 건 COMPLETED, 다음 ASSIGNED가 현재 배차로 → revalidate("/")
[시뮬레이션] 새 currentDispatch 키 감지 → 다음 배차지로 재출발 (반복)
큐 소진(currentDispatch 없음) → 대기 유지
```

## 5. 배포 영향
- **DB 변경 없음, 백엔드 변경 없음.** 프론트엔드 전용 → 프론트 빌드/타입체크/lint만.
- 옛 `BikeNextCustomer` 백엔드는 휴면(엔드포인트 잔존, 프론트 미사용).

## 6. 테스트/검증
- 신규 백엔드 계약 테스트 없음(무변경).
- 프론트 `npm run typecheck && npm run lint && npm run build`.
- 프로덕션 QA: CLEANING 차량 배차 엑셀 업로드(C2) → 라이더 매칭 → 출발 시 벨/말풍선에 현재 배차 고객명+주소 표시 → 차량 상세 배차 큐에서 완료 → 다음 건으로 재출발 확인.

## 7. 비범위 재확인
실제 텔레메트리 시동, 고객 SMS, 배차형/배민/유모차 알림, 백엔드 DB 변경, 옛 next-customer 백엔드 삭제는 이 스펙에 포함하지 않는다.
