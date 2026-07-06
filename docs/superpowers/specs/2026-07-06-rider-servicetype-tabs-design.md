# 서비스유형별 탭 구성(대기 콜은 CALL 라이더만) Design

**Date:** 2026-07-06
**Branch:** `cc-rider-servicetype-tabs` (off `dev`)
**Status:** Approved (design)
**대상:** `development/app` (JS-only)

---

## 1. 배경 / 결정(사용자 승인)

대기 콜(offered-calls)은 백엔드가 **활성 차량 serviceType=CALL 라이더에게만** 반환한다(`RiderSelfReadController` `isCallBike` 게이팅). 비CALL 라이더는 항상 `[]`. 따라서 앱도 서비스유형에 맞춰 탭을 다르게 보여준다:

- **CALL 라이더:** 대기 콜 + 내 배차 **둘 다**(수락한 콜이 ASSIGNED로 내 배차에 들어와 완료 처리).
- **비CALL 라이더(SINGLE/순차/왕복 등):** **내 배차만**. 대기 콜 탭 숨김 + offered 폴링 생략.

## 2. 구현

### 2-1. serviceType 취득
- `riderRuntimeConfig`에 `createProfileService(config, accessToken): RiderProfileService | null` 추가(`createRiderProfileService` 래핑, `createDispatchService`와 동형).
- `RiderAppRoot`: 로그인 세션 활성 시 `profile.getVehicle()` 1회 호출 → `isCallRider: boolean | null`(null=미확정). `DispatchListScreen`에 prop 전달. 실패/차량없음 → null 유지(비CALL 취급).

### 2-2. `loadRiderDeliveries` offered 생략 옵션
- `loadRiderDeliveries(service, { includeOffered = true })`: `includeOffered`가 false면 `listOfferedCalls` 대신 `[]`. 비CALL은 offered 조회를 건너뛴다.

### 2-3. `DispatchListScreen` 게이팅
- 새 prop `isCallRider: boolean | null`. 내부 `isCallRiderRef`로 load에서 참조(load 아이덴티티 안정).
- **탭:** `isCallRider === true`일 때만 대기 콜 탭 렌더. 아니면 내 배차만 + `tab='assigned'` 고정.
- **load:** `includeOffered = isCallRiderRef.current !== false`(미확정/CALL이면 조회, 비CALL 확정 시 생략).
- **알림:** 새 콜 배너/진동은 `isCallRiderRef.current === true`일 때만.
- 지도 마커/폴링은 그대로(현재 탭 orders 기준).

## 3. 엣지
- serviceType 미확정(null) 동안: 대기 콜 탭 숨김(확정 후 CALL이면 표시). 첫 load는 offered 포함(무해, 비CALL이면 []) → 확정 후 CALL이면 이미 로드됨(재조회 불필요), 비CALL이면 이후 폴링부터 생략.
- 차량 없음/프로필 실패 → 비CALL 취급(내 배차만). 안전한 기본.

## 4. 손대는 파일
| 파일 | 변경 |
|------|------|
| `src/app/config/riderRuntimeConfig.ts` | `createProfileService` 추가 |
| `src/domain/dispatch/riderDispatch.ts` | `loadRiderDeliveries` `includeOffered` 옵션(+테스트) |
| `src/app/RiderAppRoot.tsx` | serviceType 취득 → `isCallRider` prop |
| `src/ui/screens/DispatchListScreen.tsx` | 탭/load/알림 게이팅 |

## 5. 검증
- `typecheck`/`lint`/`npx tsx --test`(loadRiderDeliveries includeOffered 테스트 + 회귀).
- 실기기: 비CALL(박상현=SINGLE) → 내 배차만, 대기 콜 탭 없음. (CALL 라이더 전환 시 두 탭은 웹에서 서비스유형 CALL로 바꿔 확인.)
