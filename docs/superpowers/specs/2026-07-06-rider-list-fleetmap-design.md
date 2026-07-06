# 라이더 목록 화면: 상단 함대 지도 (내 위치 중앙 + 주문 마커) Design

**Date:** 2026-07-06
**Branch:** `cc-rider-list-fleetmap` (off `dev`)
**Status:** Approved (design)
**대상:** `development/app` (JS-only, 재빌드 불필요)

---

## 1. 배경 / 결정(사용자 승인)

배차 목록 화면([DispatchListScreen](development/app/src/ui/screens/DispatchListScreen.tsx))을 재구성한다.
- 지도를 화면 **상단**에 배치, "내 배차 / 대기 콜" 탭 + 리스트는 지도 **아래**.
- 지도는 **내 위치를 항상 중앙(Follow)**.
- **최초 로딩 시** 내 위치 중심으로 현재 탭의 **모든 주문 마커가 다 보이도록** 줌.
- 마커 = **현재 탭 목록만**(탭 전환 시 갱신).

## 2. 컴포넌트

### 2-1. `computeMeCenteredRegion(me, orders, options?)` (순수 헬퍼, 테스트 대상)
- 반환 `Region`(네이버맵: **SW 코너 + delta** 규약 — `latitude/longitude`=south-west, `latitudeDelta/longitudeDelta`=NE까지 span).
- `latHalf = max(minDelta, max_over_orders|order.lat − me.lat|) × padding`, `lngHalf` 동일.
- 반환: `{ latitude: me.lat − latHalf, longitude: me.lng − lngHalf, latitudeDelta: 2·latHalf, longitudeDelta: 2·lngHalf }` → **중심 = me**, 모든 주문 포함.
- 기본값 `minDelta=0.01°(~1km)`, `padding=1.3`. 주문 0개 → me 중심 소형 region.

### 2-2. `NaverFleetMap` (신규 `src/ui/components/NaverFleetMap.tsx`)
- props: `origin: LatLng | null`, `orders: { id; latitude; longitude; label }[]`.
- `NaverMapView`(ref) + 주문마다 `NaverMapMarkerOverlay`(caption=label).
- **origin 있을 때:** 지도 init 및 (origin·orders 준비/변경) 시 → `ref.setLocationTrackingMode('Follow')`(내 위치 항상 중앙, 이동 시 따라옴) + `ref.animateRegionTo(computeMeCenteredRegion(origin, orders))`(줌=전체 fit).
- **origin 없을 때(권한 거부/GPS off):** Follow·파란 점 없음. 주문 있으면 첫 주문 중심 camera, 마커만 표시. 리스트는 정상.
- 네이버맵 throw(NCP 실패 등) → 에러 바운더리가 **null 렌더**(지도만 숨김, 리스트 정상).

## 3. `DispatchListScreen` 변경
- `useCurrentLocation()` → `origin`.
- 상단에 `NaverFleetMap`(고정 비율 ~상단 40%), 현재 탭 `orders`를 `{id, latitude, longitude, label: customerName}`로 매핑해 전달.
- 기존 탭바 + `FlatList`는 그 아래(나머지 60%).
- 레이아웃: column 컨테이너 → 지도 wrap(flex 2) + 콘텐츠 wrap(flex 3, 기존 탭+리스트).

## 4. 엣지 케이스
- 권한 거부/GPS off → origin null → 파란 점·Follow 없음, 주문 마커만 + 리스트 정상.
- 주문 0개 → 내 위치만(Follow), 소형 region.
- 탭 전환 → 마커 집합 변경 → 재fit(me 중심, 새 탭 주문).
- Follow와 animateRegionTo 순서: Follow 설정 후 region 애니메이션(중심=me로 일관). 실기기에서 줌 반영 확인.

## 5. 손대는 파일
| 파일 | 변경 |
|------|------|
| `src/ui/geo/meCenteredRegion.ts` (신규) | `computeMeCenteredRegion` 순수 헬퍼 |
| `src/ui/geo/meCenteredRegion.test.ts` (신규) | 헬퍼 단위 테스트(중심=me, 주문 포함, 0개, padding) |
| `src/ui/components/NaverFleetMap.tsx` (신규) | 상단 함대 지도(Follow + 마커 + fit) |
| `src/ui/screens/DispatchListScreen.tsx` | 상단 지도 추가 + useCurrentLocation + 현재 탭 주문 전달 |

## 6. 검증
- `typecheck`/`lint`/`npx tsx --test`(region 헬퍼 테스트 포함, 회귀 없음).
- 실기기: 상단 지도에 파란 점 중앙 + 현재 탭 주문 마커 전부 표시 + 최초 전체 fit + 탭 전환 시 마커 갱신 확인. 권한 off 시 마커만/리스트 정상.
