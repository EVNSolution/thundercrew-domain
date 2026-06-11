# Group C3 — 클리닝 배차 통합 (시동 알림 → dispatch 큐) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CLEANING 차량의 시뮬레이션 이동·시동(출발) 알림 소스를 옛 `BikeNextCustomer`(promote)에서 C0/C2의 DispatchOrder 큐 '현재 배차'로 완전 이전한다 (프론트엔드 전용, 백엔드 무변경).

**Architecture:** 대시보드 BikePin은 이미 `currentDispatchCustomerName/Address/Latitude/Longitude` + `dispatchQueueCount`를 싣고 있고 `completeDispatchOrderAction`이 `/`를 revalidate한다. `FleetSimulationContext`가 CLEANING 차량의 목적지를 `nextCustomer*` 대신 `currentDispatch*`에서 읽고, 이미 출발한 현재 배차는 복합키 가드로 재출발을 막는다. 운영자가 "완료" 클릭 → 큐 진행 → 새 현재 배차 → 새 키 → 재출발. 옛 next-customer UI/promote 경로는 CLEANING에서 제거한다.

**Tech Stack:** Next.js App Router, React Context, TypeScript. (백엔드/DB 변경 없음.)

**검증 방식 (이 코드베이스 관례):** 이 사이클의 파일들(시뮬레이션 Context, 다이얼로그, 지도 마커, 알림)은 단위 테스트가 없고 — 기존 동일 작업(시동 알림/next-customer 사이클, 완료 task #51–79)과 마찬가지로 `npm run typecheck && npm run lint`(태스크별) + 최종 `npm run build` + 프로덕션 QA로 검증한다. 핵심 로직(이동 목적지 소스·재출발 가드)은 React 훅 안에 있어 RTL 없이 단위 테스트가 어렵다(프로젝트에 RTL 미설정). 따라서 TDD 대신 타입체크/빌드/QA로 검증한다.

**작업 디렉터리:** 모든 명령은 `cd /c/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web` 기준 (PowerShell이 아닌 Bash 툴 사용, cwd가 호출마다 리셋되므로 절대경로 cd를 매 명령에 포함).

**브랜치:** 시작 전 `dev`에서 feature 브랜치 생성:
```bash
cd /c/Users/user/repositories/clever/thundercrew-domain && git checkout dev && git pull && git checkout -b cc-c3-cleaning-dispatch
```

---

## 파일 구조 (변경 대상)

| 파일 | 책임 | 변경 |
|---|---|---|
| `components/layout/NotificationContext.tsx` | 알림 상태 | `IgnitionNotification`에 `address?` 추가 |
| `components/layout/NotificationBell.tsx` | 알림 드롭다운 | 표시를 "출발 → 고객명(주소)"로 |
| `components/management/VehicleDetailDialog.tsx` | 차량 상세 | 옛 `NextCustomerSection` + 미사용 import 제거 |
| `components/overview/FleetSimulationContext.tsx` | 시뮬레이션 구동 | 목적지 소스 currentDispatch로, 재출발 가드, 알림 재작성, promote/updatePinNextCustomer 제거 |
| `components/dashboard/MapShell.tsx` | 지도 마커 | 시동 말풍선 텍스트에 현재 배차 고객명 (선택 폴리시) |

`lib/services/fleet-simulation.ts`는 **변경 없음** — `nextCustomerDestination` 필드를 "CLEANING 목적지"로 그대로 재사용하며 소스만 Context에서 교체된다.

---

### Task 1: NotificationContext + NotificationBell — 주소 필드 + 출발 문구

**Files:**
- Modify: `components/layout/NotificationContext.tsx:11-18`
- Modify: `components/layout/NotificationBell.tsx:56-72`

- [ ] **Step 1: `IgnitionNotification` 타입에 `address` 추가**

`NotificationContext.tsx` 11-18행을 다음으로 교체:
```ts
export type IgnitionNotification = {
  id: string;
  plateNumber: string;
  startedAt: number;
  /** CLEANING 차량 출발 시 현재 배차(dispatch) 고객명. 없으면 "출발"만 표시. */
  customerName?: string;
  /** CLEANING 차량 출발 시 현재 배차 주소. 벨 항목에 괄호로 표기. */
  address?: string;
  /** @deprecated C3 이후 미사용 — 과거 next-customer 알림 호환용. */
  customerPhone?: string;
};
```

- [ ] **Step 2: 벨 드롭다운 표시를 dispatch 출발 문구로 교체**

`NotificationBell.tsx` 56-72행(`[...notifications].reverse().map(...)` 블록)을 다음으로 교체:
```tsx
            [...notifications].reverse().map((n) => (
              <div key={n.id} className="notif-item" role="listitem">
                <span className="notif-item-text">
                  🔑 {n.plateNumber} 출발
                  {n.customerName ? ` → ${n.customerName}` : ""}
                  {n.address ? ` (${n.address})` : ""}
                </span>
                <span className="notif-item-time">{formatRelativeTime(n.startedAt)}</span>
              </div>
            ))
```

- [ ] **Step 3: 타입체크 + 린트**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web && npm run typecheck && npm run lint
```
Expected: 통과 (에러 0). `customerPhone` 미사용 경고 없음(타입 필드 잔존은 무해).

- [ ] **Step 4: 커밋**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain && git add development/front-admin-web/components/layout/NotificationContext.tsx development/front-admin-web/components/layout/NotificationBell.tsx && git commit -m "feat(c3): notification carries dispatch address, '출발' wording"
```

---

### Task 2: VehicleDetailDialog — 옛 NextCustomerSection 제거

`DispatchQueueSection`(배차 큐, C0/C2)가 이미 현재/대기 + 완료/취소를 제공하므로 CLEANING의 옛 "다음 고객" 섹션은 중복. 제거하고 이 섹션만 쓰던 import도 정리한다.

**Files:**
- Modify: `components/management/VehicleDetailDialog.tsx` (import 5,13,16행 · 렌더 212-214행 · 함수 905-1079행)

- [ ] **Step 1: `NextCustomerSection` 렌더 제거**

212-214행:
```tsx
          {vehicle.serviceType === "CLEANING" && vehicleIdForFetch && (
            <NextCustomerSection bikeId={vehicleIdForFetch} />
          )}
```
→ 이 3줄을 **삭제**. (바로 아래 `{vehicleIdForFetch && <DispatchQueueSection bikeId={vehicleIdForFetch} />}`는 유지.)

- [ ] **Step 2: `NextCustomerSection` 함수 정의 제거**

905-1079행 전체 — 주석 헤더 `// === 현재 고객 / 다음 고객 섹션 (CLEANING 전용) ===`(901-903행)부터 `NextCustomerSection` 함수 닫는 `}`(1079행)까지 **삭제**. (1081행부터의 `// === 배차 큐 섹션 ===`와 `DispatchQueueSection`은 유지.)

- [ ] **Step 3: 미사용 import 제거**

5행 삭제:
```tsx
import { AddressSearchButton } from "@/components/management/AddressSearchButton";
```
13·16행 — `@/app/actions` import에서 `getNextCustomerAction`, `setNextCustomerAction` 제거. 결과:
```tsx
import {
  markVehicleMaintenanceServicedAction,
  setRiderInsuranceFromVehicleAction,
  updateVehicleFromOverviewAction
} from "@/app/actions";
```
(155행 `const { simulated } = useFleetSimulation();`는 그대로 — `simState`에 쓰임. `updatePinNextCustomer`는 destructure하지 않으므로 이 파일에서 더는 참조 없음.)

- [ ] **Step 4: 타입체크 + 린트**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web && npm run typecheck && npm run lint
```
Expected: 통과. `AddressSearchButton`/`getNextCustomerAction`/`setNextCustomerAction`/`useState`·`useRef` 미사용 경고가 없어야 함 — 남은 import가 다른 곳(편집 폼 등)에서 쓰이는지 린트가 확인. 만약 `useEffect` 등 hook import가 `NextCustomerSection`에서만 쓰였다면 린트가 잡으므로 해당 미사용 import도 함께 제거.

- [ ] **Step 5: 커밋**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain && git add development/front-admin-web/components/management/VehicleDetailDialog.tsx && git commit -m "feat(c3): drop legacy next-customer section from vehicle detail (dispatch queue replaces it)"
```

---

### Task 3: FleetSimulationContext — currentDispatch 소스 + 재출발 가드 + 알림 재작성

핵심 태스크. CLEANING 목적지를 `pin.currentDispatch*`에서 읽고, 이미 출발한 현재 배차는 복합키로 가드해 재출발을 막으며, 알림은 현재 배차 고객명+주소를 쓴다. `promoteNextToCurrentAction`·`updatePinNextCustomer`를 제거한다.

**Files:**
- Modify: `components/overview/FleetSimulationContext.tsx`

- [ ] **Step 1: import + 가드 ref + 헬퍼 추가**

15행 `import { promoteNextToCurrentAction } from "@/app/actions";` **삭제**.

`lastNotifiedIgnitionOnAtRef` 선언(64-65행) 아래, `lastDeliveryCountRef`(66-67행)를 **제거**하고 대신 다음 ref를 추가:
```ts
  /** bikeId → 마지막으로 출발(시동 ON)한 현재 배차의 복합키. 같은 건으론 재출발하지 않도록 한다. */
  const lastDepartedDispatchKeyRef = useRef<Map<string, string>>(new Map());
```

파일 하단 모듈 스코프(예: `const EMPTY_SIMULATED` 근처, 314행 부근)에 헬퍼 추가:
```ts
/** 현재 배차의 신원 복합키. 좌표·고객명이 모두 없으면 null(배차 없음). */
function dispatchKeyOf(pin: FrontendDashboardBikePin | undefined): string | null {
  if (!pin || pin.currentDispatchLatitude == null || pin.currentDispatchLongitude == null) return null;
  return `${pin.currentDispatchLatitude},${pin.currentDispatchLongitude},${pin.currentDispatchCustomerName ?? ""}`;
}
```

- [ ] **Step 2: 자동 트리거 effect — 초기 목적지를 currentDispatch에서**

125-168행 `useEffect`(matchedImeiSet 진입 시 시뮬 추가) 안에서, 136-146행의 `nextCustomerDestination`/`initialPhase` 계산을 다음으로 교체:
```ts
        // CLEANING: 현재 배차(dispatch) 좌표가 있으면 그곳으로 출발, 없으면 IDLE 대기.
        const dispatchDestination =
          pin?.serviceType === "CLEANING" &&
          pin.currentDispatchLatitude != null &&
          pin.currentDispatchLongitude != null
            ? { lat: pin.currentDispatchLatitude, lng: pin.currentDispatchLongitude }
            : null;
        const initialPhase: "MOVING" | "IDLE" =
          pin?.serviceType === "CLEANING" && dispatchDestination === null
            ? "IDLE"
            : "MOVING";
```
그리고 161행 `nextCustomerDestination` 인자를 교체:
```ts
            nextCustomerDestination: dispatchDestination
```
(149-150행 `maxOffsetMs`/`offsetMs`는 그대로 — CLEANING 분기 유지.)

- [ ] **Step 3: 출발 감지 effect — 알림(현재 배차 고객+주소) + 가드 기록**

175-207행 `useEffect`(WORKING→MOVING 감지) 전체를 다음으로 교체:
```ts
  // 시동 ON(WORKING→MOVING) 감지 — CLEANING 차량에 한해:
  //   1. 알림 발송 (현재 배차 고객명 + 주소)
  //   2. lastDepartedDispatchKeyRef 에 이번 출발한 현재 배차 키 기록 → tick 루프가
  //      같은 건으로 재출발(재트리거)하지 않도록 함. 운영자 "완료" → 다음 건이
  //      현재 배차가 되면 키가 바뀌어 다시 출발한다.
  useEffect(() => {
    for (const [bikeId, state] of simulated) {
      if (state.serviceType !== "CLEANING") continue;
      if (state.ignitionOnAt == null) continue;
      const last = lastNotifiedIgnitionOnAtRef.current.get(bikeId);
      if (last === state.ignitionOnAt) continue;
      lastNotifiedIgnitionOnAtRef.current.set(bikeId, state.ignitionOnAt);
      const pin = pinsRef.current.find((p) => p.bikeId === bikeId);
      const plateNumber = pin?.plateNumber ?? bikeId.slice(0, 8);
      addNotification({
        plateNumber,
        startedAt: state.ignitionOnAt,
        customerName: pin?.currentDispatchCustomerName ?? undefined,
        address: pin?.currentDispatchAddress ?? undefined
      });
      const key = dispatchKeyOf(pin);
      if (key) lastDepartedDispatchKeyRef.current.set(bikeId, key);
    }
    // 시뮬레이션에서 빠진 bike 의 ref 항목 정리
    for (const bikeId of lastNotifiedIgnitionOnAtRef.current.keys()) {
      if (!simulated.has(bikeId)) lastNotifiedIgnitionOnAtRef.current.delete(bikeId);
    }
    for (const bikeId of lastDepartedDispatchKeyRef.current.keys()) {
      if (!simulated.has(bikeId)) lastDepartedDispatchKeyRef.current.delete(bikeId);
    }
  }, [simulated, addNotification]);
```

- [ ] **Step 4: MOVING→WORKING effect(212-222행) 제거**

이 effect는 `lastDeliveryCountRef`만 갱신하던 dead 코드(가드가 재출발을 대신 처리). 209-222행(주석 포함 `// Detect MOVING→WORKING transitions ...`부터 닫는 `}, [simulated]);`까지)을 **삭제**.

- [ ] **Step 5: tick 루프 — newDest를 currentDispatch + 가드로**

228-274행 tick 루프 안, 242-254행의 `pin`/`newDest`/`prevDest`/`destChanged`/`stateForAdvance` 계산 블록에서 `newDest` 산출(243-248행)을 다음으로 교체:
```ts
          const pin = pinsRef.current.find((p) => p.bikeId === bikeId);
          // 현재 배차 키가 이번 차량이 마지막으로 출발한 키와 같으면(이미 다녀옴)
          // 목적지를 주지 않아 도착 후 같은 건으로 재출발하지 않게 한다.
          const dKey = dispatchKeyOf(pin);
          const alreadyDeparted =
            dKey != null && lastDepartedDispatchKeyRef.current.get(bikeId) === dKey;
          const newDest =
            pin?.serviceType === "CLEANING" && dKey != null && !alreadyDeparted
              ? { lat: pin.currentDispatchLatitude as number, lng: pin.currentDispatchLongitude as number }
              : null;
```
(249-254행 `prevDest`/`destChanged`/`stateForAdvance`는 그대로 유지 — `newDest`만 소스가 바뀜.)

- [ ] **Step 6: `updatePinNextCustomer` 제거 (타입·정의·value·fallback)**

- 41행 `FleetSimulationContextValue`의 `updatePinNextCustomer: (...) => void;` 멤버 + 그 위 35-40행 JSDoc 삭제.
- 80-92행 `const updatePinNextCustomer = useCallback(...)` 정의 삭제.
- 306-309행 `useMemo` value에서 `updatePinNextCustomer` 제거:
```ts
  const value = useMemo<FleetSimulationContextValue>(
    () => ({ simulated, seedBikePins }),
    [simulated, seedBikePins]
  );
```
- 316-317행 `const NOOP_UPDATE = () => {};` 삭제, 322-328행 fallback에서 `updatePinNextCustomer: NOOP_UPDATE` 제거:
```ts
  if (!ctx) {
    return { simulated: EMPTY_SIMULATED, seedBikePins: NOOP_SEED };
  }
```

- [ ] **Step 7: 타입체크 + 린트**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web && npm run typecheck && npm run lint
```
Expected: 통과. `promoteNextToCurrentAction` 미사용 import 없음, `updatePinNextCustomer` 잔존 참조 없음(Task 2에서 마지막 consumer 제거됨).

- [ ] **Step 8: 커밋**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain && git add development/front-admin-web/components/overview/FleetSimulationContext.tsx && git commit -m "feat(c3): drive CLEANING simulation from dispatch queue, re-depart guard, dispatch-customer notification"
```

---

### Task 4: MapShell — 시동 말풍선에 현재 배차 고객명 (선택 폴리시)

말풍선 텍스트 "🔑 이동 시작" → "🔑 {고객명} 출발". 고객명은 운영자 엑셀 자유 텍스트라 HTML 이스케이프한다.

**Files:**
- Modify: `components/dashboard/MapShell.tsx` (779-781행 · 865-880행 · 호출부 468행)

- [ ] **Step 1: `ignitionBubbleMarkup`에 고객명 인자 + 이스케이프**

779-781행을 다음으로 교체:
```ts
function escapeMarkerText(value: string): string {
  return value.replace(/[<>&"]/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : "&quot;"
  );
}

function ignitionBubbleMarkup(customerName?: string | null): string {
  const who = customerName ? `${escapeMarkerText(customerName)} ` : "";
  return `<div class="map-ignition-bubble">🔑 ${who}출발</div>`;
}
```

- [ ] **Step 2: `bikeMarkerHtml` 시그니처에 고객명 추가 + 전달**

865-872행 시그니처 마지막에 인자 추가:
```ts
function bikeMarkerHtml(
  plateNumber: string,
  showLabel: boolean,
  servicePhase?: ServicePhase | null,
  deliveryCount?: number,
  ignitionOnAt?: number | null,
  serviceType?: ServiceType,
  selected?: boolean,
  currentDispatchCustomerName?: string | null
): string {
```
879행 `const bubble = showBubble ? ignitionBubbleMarkup() : "";`를 교체:
```ts
  const bubble = showBubble ? ignitionBubbleMarkup(currentDispatchCustomerName) : "";
```

- [ ] **Step 3: 호출부에 고객명 전달**

468행:
```ts
      const html = bikeMarkerHtml(pin.pinLabel ?? pin.plateNumber, showLabel, pin.servicePhase, pin.deliveryCount, pin.ignitionOnAt, pin.serviceType, isSelected);
```
→ 마지막 인자 추가 (`pin`은 `FrontendDashboardBikePin` 확장형이라 `currentDispatchCustomerName` 보유):
```ts
      const html = bikeMarkerHtml(pin.pinLabel ?? pin.plateNumber, showLabel, pin.servicePhase, pin.deliveryCount, pin.ignitionOnAt, pin.serviceType, isSelected, pin.currentDispatchCustomerName);
```

- [ ] **Step 4: 타입체크 + 린트**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web && npm run typecheck && npm run lint
```
Expected: 통과.

- [ ] **Step 5: 커밋**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain && git add development/front-admin-web/components/dashboard/MapShell.tsx && git commit -m "feat(c3): show dispatch customer name in ignition bubble"
```

---

### Task 5: 최종 빌드 검증 + PR

**Files:** 없음 (검증/PR만)

- [ ] **Step 1: 풀 빌드**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web && npm run typecheck && npm run lint && npm run build
```
Expected: 세 단계 모두 통과, Next.js 프로덕션 빌드 성공.

- [ ] **Step 2: 변경 요약 확인**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain && git diff dev --stat
```
Expected: 5개 파일 변경 (NotificationContext, NotificationBell, VehicleDetailDialog, FleetSimulationContext, MapShell), 백엔드/마이그레이션 변경 0.

- [ ] **Step 3: 푸시 + PR (→ dev)**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain && git push -u origin cc-c3-cleaning-dispatch && gh pr create --base dev --title "Group C3: CLEANING 배차 통합 (시동 알림 → dispatch 큐)" --body "$(cat <<'EOF'
## Summary
- CLEANING 차량 시뮬레이션 이동·시동 알림 소스를 옛 next-customer에서 C0/C2 dispatch 큐의 현재 배차로 완전 이전 (프론트 전용, 백엔드 무변경)
- 차량 상세에서 옛 "다음 고객" 섹션 제거 — "배차 큐" 섹션으로 통합
- 출발 시 벨/지도 말풍선에 현재 배차 고객명(+주소) 표시
- 재출발 가드(복합키)로 도착 후 같은 건 재출발 방지, 운영자 "완료" 시 다음 건으로 재출발

## Test Plan
- [ ] typecheck + lint + build 통과
- [ ] 프로덕션 QA: CLEANING 차량 배차 엑셀(C2) 업로드 → 라이더 매칭 → 출발 시 벨/말풍선에 현재 배차 고객명+주소 → 차량 상세 배차 큐 "완료" → 다음 건으로 재출발

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

**1. Spec coverage:**
- 목적지 소스 currentDispatch → Task 3 (Step 2,5). ✓
- 시동 알림 현재 배차 고객+주소 → Task 1 + Task 3 (Step 3). ✓
- 도착 후 운영자 완료 → 큐 진행 → 재출발 → Task 3 가드(Step 1,3,5) + 기존 `completeDispatchOrderAction` revalidate. ✓
- 옛 "다음 고객" 섹션 제거 → Task 2. ✓
- `promoteNextToCurrentAction` 호출 제거 → Task 3 (Step 1,3). ✓
- 말풍선 다듬기 → Task 4. ✓
- 백엔드/DB 무변경 → 전 태스크 프론트만. ✓

**2. Placeholder scan:** 모든 코드 블록 구체적, TBD/TODO 없음. 빈 단계 없음.

**3. Type consistency:** `dispatchKeyOf(pin)` 헬퍼는 Task 3 Step 1에서 정의되어 Step 3·5에서 사용 — 일관. `lastDepartedDispatchKeyRef`는 Step 1 정의 → Step 3·5 사용. `FleetSimulationContextValue`에서 `updatePinNextCustomer` 제거(Step 6)는 Task 2가 마지막 consumer를 제거한 뒤라 안전. `IgnitionNotification.address`(Task 1) ↔ `addNotification({ address })`(Task 3 Step 3) ↔ 벨 표시(Task 1 Step 2) 일치. `currentDispatchCustomerName`/`currentDispatchAddress`/`currentDispatchLatitude`/`currentDispatchLongitude`는 `FrontendDashboardBikePin`의 기존 필드명과 일치(service-ops-api.ts 792-796행 확인).

**주의(구현자에게):** Task 2와 Task 3 사이 중간 커밋에서는 CLEANING 차량이 일시적으로 움직이지 않는다(옛 next-customer 제거됨, currentDispatch 배선 전). 각 커밋은 컴파일/실행되지만 기능 완성은 Task 3 이후다 — feature 브랜치 전체를 PR하므로 문제 없음. Task 2를 Task 3보다 먼저 해야 `updatePinNextCustomer` 제거가 안전하다(순서 고정).
