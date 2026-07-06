# 라이더 앱: 상단 safe-area + 지도 내 위치 표시 Design

**Date:** 2026-07-06
**Branch:** `cc-rider-safearea-mylocation` (off `dev`)
**Status:** Approved (design)
**대상:** `development/app` (전부 JS-only, 재빌드 불필요 — 위치권한은 이미 APK에 존재)

---

## 1. 배경

실기기 QA에서 두 개선점:
1. 상단 헤더(목록 탭/뒤로가기)가 상태바(시계)에 가려짐.
2. 주문 상세 지도가 목적지만 보여줌 — 라이더 본인 위치 기준으로 목적지를 보고 싶음.

## 2. Part 1 — 상단 safe-area

**원인:** [RiderAppRoot.tsx](development/app/src/app/RiderAppRoot.tsx) 가 `react-native` 의 `SafeAreaView` 사용 → **iOS 전용**(Android no-op). 앱이 `edgeToEdgeEnabled: true` 라 Android에서 콘텐츠가 상태바 밑으로 그려짐.

**수정:** 루트 `SafeAreaView`(iOS notch 유지) 스타일에 Android 상단 인셋 추가:
`paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0`.
루트가 로그인/목록/상세 전 화면을 감싸므로 한 번에 해결. `react-native-safe-area-context`(미설치, 네이티브 dep) 도입 안 함.

## 3. Part 2 — 내 위치(실시간 파란 점) + 목적지, 둘 다 보이게

**권한:** 상세 화면 mount 시 기존 `createExpoForegroundLocationPermissionService().requestForegroundPermission()` 로 포그라운드 위치 권한 요청. (ACCESS_FINE/COARSE_LOCATION 은 이미 APK manifest에 있음 → OS 팝업만.)

**내 좌표 스냅샷:** 권한 granted면 `createExpoForegroundLocationSnapshotService().getCurrentForegroundLocation()` 로 1회 취득(초기 카메라 fit용). 실시간 점은 네이티브가 갱신.

**지도(`NaverDestinationMap`) 확장:**
- 새 optional prop `origin?: { latitude; longitude } | null`.
- `NaverMapView` 에 `ref` + `locationTrackingMode={origin ? 'NoFollow' : 'None'}`. `NoFollow` = 실시간 파란 점(현위치 오버레이)이 사용자를 따라가되 카메라는 자동 이동 안 함. (권한 granted 시에만 점 표시.)
- 목적지 `NaverMapMarkerOverlay` 유지.
- `onInitialized` 에서 origin 있으면 `ref.animateCameraWithTwoCoords({ coord1: origin, coord2: destination })` 로 **둘 다 보이게** fit. origin 없으면 기존처럼 `camera={{ ...destination, zoom: 15 }}` 목적지 중심.
- 에러 바운더리(NCP 실패 시 좌표 폴백) 유지.

**작은 훅 `useCurrentLocation`** (`src/ui/hooks/useCurrentLocation.ts`): mount 시 권한 요청 → granted면 스냅샷. 반환 `{ origin: {latitude,longitude} | null }`. 실패/거부 시 `origin: null`(목적지만 표시). expo 위치 팩토리를 내부에서 사용.

**OrderDetailScreen:** `useCurrentLocation()` 호출 → `origin` 을 `NaverDestinationMap` 에 전달.

## 4. 손대는 파일

| 파일 | 변경 |
|------|------|
| `src/app/RiderAppRoot.tsx` | 루트 Android 상단 인셋(StatusBar.currentHeight) |
| `src/ui/components/NaverDestinationMap.tsx` | origin prop + 위치 오버레이(NoFollow) + fit-both 카메라(ref) |
| `src/ui/hooks/useCurrentLocation.ts` (신규) | 권한 요청 + 스냅샷 → origin |
| `src/ui/screens/OrderDetailScreen.tsx` | 훅 호출 + origin 전달 |

## 5. 엣지 케이스

- 권한 거부/오류 → `origin: null` → 목적지만(파란 점 없음), 카메라 목적지 중심. graceful.
- iOS → StatusBar.currentHeight 미적용(0), core SafeAreaView가 notch 처리.
- 지도 초기화 전 origin 도착 시 → `onInitialized` 에서 fit 호출(둘 다 준비된 시점).

## 6. 검증

- `npm run typecheck` + `npm run lint` + `npx tsx --test`(useCurrentLocation/맵 관련 있으면).
- 실기기: 상세 진입 → 위치 팝업 허용 → **파란 점 + 목적지 둘 다** 화면에 + 카메라 fit 확인. 상단 헤더가 시계 아래로 내려옴 확인. 권한 거부 시 목적지만 뜨는지 확인.
