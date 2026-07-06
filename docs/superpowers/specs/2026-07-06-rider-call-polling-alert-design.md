# 대기 콜 폴링 + 인앱 알림 Design

**Date:** 2026-07-06
**Branch:** `cc-rider-call-polling` (off `dev`)
**Status:** Approved (design)
**대상:** `development/app` (JS-only, 재빌드/백엔드/FCM 불필요)

---

## 1. 배경 / 결정(사용자 승인)

운영자가 콜 배차(OFFERED)를 만들면 라이더 앱에서 **알림 + 대기 콜 등장**, 다른 라이더가 수락하면 **대기 콜에서 사라짐**을 원함.

**현황:** 백엔드 콜 lifecycle은 이미 존재(`offerCall`→OFFERED, `acceptCall`→ASSIGNED로 빠짐). 수락 시 대기 콜에서 빠지는 건 데이터상 이미 동작하나 **실시간 반영·알림이 없음**(앱에 알림 인프라 없음, 새로고침해야 반영).

**결정:** 여러 실시간 방식(폴링/SSE/WS/롱폴링/푸시) 중 **폴링 + 인앱 알림** 채택(즉시 가능, 재빌드·백엔드·FCM 불필요). 백그라운드(앱 꺼짐) 알림은 후속(푸시)로 남김.

## 2. 동작

- **폴링:** 목록 화면에서 앱이 **포그라운드(AppState active)일 때** 10초마다 `loadRiderDeliveries`(내 배차 + 대기 콜)를 **조용히**(스피너/에러 토글 없이) 재조회. 백그라운드 시 스킵. 상세 화면 진입 시 목록 언마운트 → 폴링 중단.
- **새 콜 알림:** 직전에 본 OFFERED id 집합과 비교해 **새 id 발생 시**(최초 로드 제외) → **인앱 배너** + **진동**(RN `Vibration`). 배너 탭 → 대기 콜 탭으로 전환. 배너는 몇 초 후 자동 사라짐. 어느 탭이든 알림.
- **수락 → 사라짐:** 폴링 재조회로 ASSIGNED가 된 콜이 offered에서 빠져 **최대 10초 내** 다른 라이더 화면에도 사라짐.

## 3. 컴포넌트/파일

| 파일 | 변경 |
|------|------|
| `src/domain/dispatch/offeredCallAlerts.ts` (신규) | `detectNewOfferedCallIds(seen, currentIds): string[]` 순수 헬퍼 |
| `src/domain/dispatch/offeredCallAlerts.test.ts` (신규) | 단위 테스트(신규 감지, 최초, 재등장, 사라짐) |
| `src/ui/components/CallAlertBanner.tsx` (신규) | 상단 절대배치 인앱 배너(메시지·탭·자동 사라짐) |
| `src/ui/screens/DispatchListScreen.tsx` | `load(silent)` 분리 + 10초 폴링(AppState) + 감지→배너/진동 + 배너 탭→대기콜 |

### 3-1. `detectNewOfferedCallIds`
```
export function detectNewOfferedCallIds(seen: ReadonlySet<string>, currentIds: readonly string[]): string[] {
  return currentIds.filter((id) => !seen.has(id))
}
```

### 3-2. `DispatchListScreen` 로직
- `load(silent = false)`: `!silent`일 때만 `setLoading`/`setError` 토글. 성공 시 `setAssigned`/`setOffered` + 새 콜 감지.
- 감지: `seenOfferedRef: Set<string>`, `firstLoadRef: boolean`. 최초 성공 로드는 seen만 채우고 알림 안 함. 이후 `detectNewOfferedCallIds(seen, offeredIds)` 결과 있으면 배너(`새 대기 콜 N건 · 고객명 주소`) + `Vibration.vibrate(400)`. 매 로드 후 seen=현재 offered id 집합으로 갱신(사라진 것 제거, 재등장 재알림).
- 폴링: `useEffect` → `setInterval(() => AppState.currentState === 'active' && load(true), 10000)`, 언마운트 시 clear. silent 폴링 실패(네트워크 blip)는 조용히 무시(에러 안 띄움), unauthorized는 그대로 로그아웃.
- 배너 state + `CallAlertBanner`(절대배치, 탭→`setTab('offered')`+dismiss).

## 4. 엣지 케이스
- 최초 로드 시 기존 대기 콜은 "새 콜" 아님(알림 X).
- 폴링 중 네트워크 blip → 조용히 무시(마지막 데이터 유지, 빨간 에러 X).
- 앱 백그라운드 → 폴링 스킵(배터리). 복귀 시 다음 tick부터 재개.
- `Vibration`은 권한 없거나 미지원 시 no-op(무해).

## 5. 검증
- `typecheck`/`lint`/`npx tsx --test`(detect 헬퍼 테스트 + 회귀).
- 실기기: 목록에서 10초마다 offered-calls 요청이 나가는지(logcat/network) + 배너 컴포넌트 렌더 확인. **"새 콜 도착→배너/진동" 전체 흐름은 웹 관리자에서 콜 배차를 생성**해야 실측(어드민 권한) — 그 부분은 사용자가 웹에서 콜 생성해 확인.

## 6. 비목표
- 백그라운드(앱 꺼짐) 알림 = 후속 푸시(FCM)로. 이번 범위 아님.
- 소리 알림 = expo-av 필요라 제외(진동+배너로 대체).
- 백엔드 변경 없음.
