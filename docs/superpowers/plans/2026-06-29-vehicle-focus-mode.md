# 차량 포커스 모드 Implementation Plan

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** 차량 선택 시 포커스 모드 — 지도에 선택 차량 1대 + station/tip 유지 + 그 차량의 배송지 마커, 진입 시 1회 fitBounds 후 수동 조작, 오른쪽 차량상세 + 왼쪽 배송 리스트, 하단 패널 접힘.

**Architecture:** 프론트엔드 전용(백엔드 무변경). 데이터 소스 기존 재사용(`listDispatchOrdersAction`/`listCompletedDispatchOrdersAction`). MapShell에 배송지 마커 레이어 + 트리거 기반 focus fitBounds 추가. FullscreenMapHost가 포커스 상태(=selectedBikeId)에 따라 마커 필터·배송지 데이터·좌패널·하단접기·follow off를 조율.

**Spec:** [docs/superpowers/specs/2026-06-29-vehicle-focus-mode-design.md](../specs/2026-06-29-vehicle-focus-mode-design.md)

---

## Task 1: MapShell — 배송지 마커 레이어 + focus fitBounds

**File:** `components/dashboard/MapShell.tsx`

- [ ] **Step 1: props 추가**
  - `dispatchPins?: Array<{ id: string; lat: number; lng: number; label: string; address?: string | null; sequence?: number | null; completed: boolean }>` — 선택 차량 배송지.
  - `focusBounds?: { points: ReadonlyArray<{ lat: number; lng: number }>; trigger: number } | null` — 포커스 진입 시 1회 fit.

- [ ] **Step 2: 배송지 마커 레이어** (tip 레이어 ~578-624 패턴 복제)
  - `const dispatchMarkerCacheRef = useRef<Map<string, NaverMarkerInstance>>(new Map())`
  - 새 `useEffect` deps `[sdkReady, dispatchPins, mapVersion, currentZoom]`: incoming-id-set → update-or-create → prune. 마커 icon content = `destinationMarkerHtml(label, address, showLabel, completed, sequence)`.
  - `destinationMarkerHtml`: 진행 중 = 컬러 핀(+sequence 숫자가 있으면 표기), 완료 = 회색 + 체크(✓). 기존 `markerWrapper`/색 변수 컨벤션 따름(진행 `var(--rm-battery-mid)` 등, 완료 `var(--rm-text-muted)`). bike/tip 마커 html 헬퍼 스타일 미러.
  - cleanup 시 dispatchMarkerCacheRef도 비움(언마운트 정리 블록 ~256-261에 추가).

- [ ] **Step 3: focus fitBounds 효과** (기존 첫-fit ~319-449와 별개, hasFittedRef로 게이트하지 않음)
  - `const lastFocusTriggerRef = useRef<number>(-1)`
  - `useEffect([sdkReady, focusBounds, mapVersion])`: `if (!sdkReady || !focusBounds || focusBounds.points.length === 0) return; if (focusBounds.trigger === lastFocusTriggerRef.current) return; lastFocusTriggerRef.current = focusBounds.trigger;` → LatLngBounds 생성(첫 점으로 init, 나머지 extend) → `map.fitBounds(bounds, fitBoundsPadding)`.

- [ ] **Step 4: 타입체크/커밋**
  - `cd development/front-admin-web && npx tsc --noEmit` (focusBounds/dispatchPins는 optional이라 기존 호출 안 깨짐).
  - commit: `feat: MapShell dispatch destination markers + focus fitBounds`

---

## Task 2: 좌측 배송 리스트 패널 + 데이터 훅

**Files:**
- Create: `components/overview/DeliveryFocusPanel.tsx`
- Create: `components/overview/use-focus-dispatch-orders.ts`

- [ ] **Step 1: 데이터 훅** `useFocusDispatchOrders(bikeId: string | null)`
  - `useEffect([bikeId])`: bikeId 있으면 `Promise.all([listDispatchOrdersAction(bikeId), listCompletedDispatchOrdersAction(bikeId)])` → `{ active: ServiceOpsDispatchOrder[]; completed: ServiceOpsDispatchOrder[]; loading: boolean }`. bikeId null이면 빈 상태. cancelled 가드.
  - active는 `status==="ASSIGNED"` + `sequence` 정렬. 반환.

- [ ] **Step 2: 패널 컴포넌트** `DeliveryFocusPanel({ bikeId, isSequential, onClose, onSelectDestination })`
  - 훅으로 active/completed 받아 렌더. 읽기 전용(완료/취소 버튼 없음 — YAGNI).
  - 진행 중 섹션: 순차면 순번 + "현재/대기", 단일이면 평면 목록. 각 행: 고객명 + 종류 배지(수거/배송) + 주소. 행 클릭 → `onSelectDestination({lat,lng})`(지도 팬).
  - 완료 섹션: 회색/접기(`완료 내역 ▼`) — 옛 `CompletedOrdersSection` 구조 차용. 완료 시각 표시.
  - 헤더 "배송" + 닫기(X) → `onClose`.
  - 기존 CSS 클래스 재사용(`dispatch-queue-section`, `dispatch-queue-list`, `dispatch-order-row`, `delivery-meta`, `dispatch-kind-badge`, `dispatch-completed-*` 등) + 패널 래퍼 새 클래스.

- [ ] **Step 3: 타입체크/커밋**
  - `npx tsc --noEmit`. commit: `feat: DeliveryFocusPanel + focus dispatch orders hook`

---

## Task 3: FullscreenMapHost 포커스 배선 + CSS

**Files:**
- Modify: `components/overview/FullscreenMapHost.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: 포커스 상태 파생**
  - `const focusMode = selectedBikeId != null`.
  - 포커스 시 MapShell `bikePins`: `focusMode ? overlaidBikePins.filter(p => p.bikeId === selectedBikeId) : [...visibleBikePins]`. (station/tip 그대로.)

- [ ] **Step 2: 배송지 데이터**
  - 훅 `useFocusDispatchOrders(selectedBikeId)`로 active+completed 받음.
  - `dispatchPins` 계산: 실차량 = active+completed 각 주문 → `{id, lat:latitude, lng:longitude, label:customerName, address, sequence, completed: status==="COMPLETED"}`, 좌표 없음/`0,0` 스킵. 시뮬 차량(IMEI "-", 선택 pin의 `currentDispatchLatitude/Longitude` 존재 시) → 그 1건만 active 배송지로. MapShell에 전달.

- [ ] **Step 3: focusBounds + follow off**
  - `targetLocation`에서 "선택 차량 따라가기" 분기 제거 → searchOverride + 배송행 클릭(one-shot)만 남김. (포커스 중 연속 재중심 안 함.)
  - `focusBounds`: `useMemo` — focusMode면 `{ points: [선택차량 좌표, ...dispatchPins 좌표], trigger: <selectedBikeId 바뀔 때 증가하는 카운터> }` else null. trigger는 `useEffect([selectedBikeId])`로 증가시키는 ref/state.
  - MapShell에 `dispatchPins`, `focusBounds` 전달.

- [ ] **Step 4: 좌패널 + 하단 접기**
  - focusMode면 `<DeliveryFocusPanel bikeId={selectedBikeId} isSequential={isCleaningServiceType(selectedVehicle.serviceType)} onClose={() => setSelectedBikeId(null)} onSelectDestination={(p) => setSearchOverride(p)} />` 를 `<main className="fullscreen-map-canvas">` 안 MapShell 뒤에 마운트.
  - 포커스 진입 시 `setBottomPanelOpen(false)` (`useEffect([selectedBikeId])`).

- [ ] **Step 5: CSS** (`app/globals.css`)
  - `.vehicle-focus-left-panel`: `.vehicle-floating-panel` 스타일 미러하되 `left:16px`(레일 있으면 그대로 overlay가 이미 left:rail-width 오프셋), `top:80px`(헤더 아래). max-width/maxheight 동일.
  - `.map-marker-destination` (+ `--completed` 변형): 배송지 핀 색/체크/순번 배지 스타일.

- [ ] **Step 6: 검증/커밋**
  - `npx tsc --noEmit && npm run lint && npm run test:service-ops` 모두 clean.
  - commit: `feat: vehicle focus mode wiring in overview map`

---

## Task 4: 최종 검증 + PR
- [ ] 전체 `tsc`/`lint`/`test:service-ops` 재확인.
- [ ] 런타임은 배포 후 prod에서 관측(프리뷰 경쟁서버 금지 [[feedback_preview_workflow]]) — 차량 선택 → 1대만+배송지마커+좌패널+하단접힘, 해제 복원.
- [ ] PR → dev.

## Self-Review
- Spec 항목 매핑: 마커 필터(T3)·배송지 레이어(T1)·fit-then-manual(T1+T3)·좌패널(T2)·완료구분(T2 리스트 + T1 마커)·하단접기(T3)·해제복원(T3). ✅
- 백엔드/마이그레이션 없음. 기존 CSS·액션 최대 재사용.
- YAGNI: 배송 완료/취소 액션, 마커↔행 양방향 하이라이트, 다중 포커스 제외.
