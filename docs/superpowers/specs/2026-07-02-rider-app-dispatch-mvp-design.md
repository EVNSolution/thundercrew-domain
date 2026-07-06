# 썬더크루 라이더 앱 MVP-1 (배차 수행 루프) Design

**Date:** 2026-07-02
**Branch:** `cc-rider-app-dispatch-mvp` (off `dev`)
**Status:** Approved (design), pending spec review
**대상:** `development/app` (Expo/RN 라이더 앱) — clever-driver-app을 UI/UX 참고로 삼되 썬더크루-first로 재구성

---

## 1. 배경 / 결정

`development/app`의 clever-driver-app은 원래 범용 **delivery-server** 기준으로 짜인 예시 앱이다(런타임이 delivery-server URL로 mock/live를 가르고, 핵심 route/delivery 플로우가 delivery-server 클라이언트에 묶여 있음). 썬더크루 라이더 API(`/api/v1/rider/**`)와 rider 클라이언트(`riderAuthClient`, `riderDispatchClient`, `riderProfileClient`)는 이미 존재하지만 앱 메인 플로우에 완전히 배선돼 있지 않다.

**결정(사용자 승인):** clever-driver-app의 **UI/UX·컴포넌트·플랫폼 어댑터(카메라·시큐어스토어)는 재사용**하되, 앱을 **썬더크루-first로 새로 구성**한다. delivery-server 의존을 MVP 플로우에서 제거하고 `/api/v1/rider/**`에 직결한다. 첫 슬라이스는 **배차 수행 루프**다.

---

## 2. 목표 / 비목표

**목표 (MVP-1 배차 수행 루프 — 배정형 + 콜 수락형 공존)**
- 라이더 로그인(전화번호+비밀번호) → 토큰 보관.
- **두 탭 토글**(배민커넥트 참고): **"내 배차"**(`/me/dispatch-orders`, 활성 차량 배정분) / **"대기 콜"**(`/me/offered-calls`, 전역 OFFERED 콜 — **내 차량이 CALL 유형일 때만 노출**, 아니면 빈 목록/탭 숨김).
- **콜 수락**: 대기 콜 → 수락(`POST /me/offered-calls/{id}/accept`, bikeId는 라이더에서 추론) → 내 배차로 이동.
- 주문 상세: 고객·연락처·주소 + **네이티브 네이버 지도**에 목적지 핀 + **"길안내"**(네이버 지도앱 딥링크).
- **사진 촬영 → 완료**(`/me/dispatch-orders/{id}/complete`, multipart photo) → #4 웹 모니터에 "완료" 반영. (두 탭의 주문 모두 동일 완료 플로우 공유.)

**비목표 (후속 페이즈)**
- **운행 온/오프(availability) 상태** — 배민커넥트식 온/오프 게이팅은 백엔드에 라이더 가용성 개념이 없어 Phase 2(백엔드 선행 필요). MVP는 단순 탭.
- 차량/정비/보험/팁/알림 조회 — Phase 2+.
- 서명·바코드 증빙 — 후속(백엔드 완료는 사진만 요구).
- **앱 위치 추적(백그라운드 GPS 스트리밍) — 제외.** 차량 GPS 소스는 OTOPLUG 텔레메트리이므로 앱이 위치를 보낼 필요 없음. 백그라운드 위치 권한·`continuousLocationStream`·`driverEvents`(위치 이벤트) 미사용.
- delivery-server 코드 물리적 삭제 — MVP에선 **바이패스만**(새 썬더크루 root가 delivery-server 플로우를 호출하지 않음). 정리는 후속.

---

## 3. 아키텍처

**썬더크루-first 런타임 (`src/app/config/driverRuntimeConfig.ts` 교체)**
- 현재: `EXPO_PUBLIC_DELIVERY_SERVER_BASE_URL`이 mock/live 게이트, live 서비스가 delivery-server 기반.
- 변경: **썬더크루 base URL이 유일한 게이트**. 신규 config:
  - `EXPO_PUBLIC_THUNDERCREW_SERVICE_OPS_BASE_URL` 비어있으면 `mode: 'mock'`(개발용 목), 있으면 `mode: 'live'`로 썬더크루 rider 서비스 구성.
  - `deliveryServerBaseUrl`는 MVP 런타임에서 제거(참조 안 함).
- 신규 서비스 팩토리 `createRiderRuntimeServices({ config })`가 **rider 클라이언트만** 조립: auth, dispatch, profile.

**재사용 자산**
- API: `src/api/thundercrew/riderAuthClient.ts`(login/refresh), `riderDispatchClient.ts`(listAssigned/listCompleted/completeDelivery/…), `riderProfileClient.ts`(내 정보). — 그대로 사용, delivery-server 요청 헬퍼 의존은 유지(범용 fetch 옵션이라 무해) 또는 얇은 공용 헬퍼로 분리.
- 플랫폼 어댑터: `src/platform/expo/camera/*`(증빙 사진 캡처), `src/platform/expo/secureStore/*`(토큰 저장).
- 도메인 래퍼: `src/domain/riderAuth/*`, `src/domain/dispatch/riderDispatch.ts`, `src/domain/profile/riderProfile.ts` — 재사용.
- UI: `src/ui/components/*` 재사용, 신규 화면은 clever-driver-app 화면 스타일 참고.

**신규 앱 루트**
- `App.tsx` → 썬더크루-first 루트(예: `src/app/RiderAppRoot.tsx`)를 렌더. 기존 `AppRoot.tsx`(delivery-server 플로우)는 MVP에서 호출하지 않음(잔존 허용).
- 화면 전환은 로컬 상태 머신(로그인 여부·선택된 주문)으로 최소 구성. 무거운 라우팅 라이브러리 도입 안 함(YAGNI).

---

## 4. 화면 / 플로우

1. **로그인 화면** — 전화번호 + 비밀번호 입력 → `riderAuthService.login()` → 토큰을 secure store에 저장 → 목록으로. 실패 시 에러 표시.
2. **배차 목록 화면 (2탭 토글)** —
   - **"내 배차" 탭**: `riderDispatchClient.listAssigned()`(`GET /me/dispatch-orders`). 카드: 고객명·주소·(순번). 당겨서 새로고침. 완료 건은 빠짐. 배차 타입(콜/단일/순차/왕복) 구분 UI 없음 — 통일 목록. 탭하면 주문 상세로.
   - **"대기 콜" 탭**: `riderDispatchClient.listOfferedCalls()`(`GET /me/offered-calls`). 내 차량이 CALL 유형이 아니면 백엔드가 빈 목록 → 이 경우 탭에 "콜 배차 차량이 아닙니다" 안내(또는 탭 비활성). 카드: 고객명·주소 + **"수락"** 버튼.
   - **수락** → `riderDispatchClient.acceptCall(orderId)`(`POST /me/offered-calls/{id}/accept`) → 성공 시 "내 배차" 탭으로 이동/새로고침(해당 콜이 내 배차에 편입).
3. **주문 상세 화면** — 고객·연락처·주소 + **네이버 지도**(목적지 핀) + **"길안내"** 버튼(네이버 지도앱 딥링크) + **"완료"** 버튼. (내 배차/수락한 콜 공통.)
4. **완료(사진) 플로우** — "완료" → 카메라(`expo-camera`/`expo-image-picker`, 기존 `proofPhotoCapture` 재사용) → 사진 → `riderDispatchClient.completeDelivery(orderId, photo)`(`POST /me/dispatch-orders/{id}/complete`, multipart) → 성공 시 목록으로, 해당 주문 사라짐.

에러/오프라인: 네트워크 실패 시 재시도 안내(오프라인 큐는 후속). 완료 실패 시 사진 유지하고 재시도 가능.

---

## 5. 지도 (네이버 / NCP 재사용)

- **네이티브 Naver 지도 RN SDK 도입**: 커뮤니티 네이버 지도 RN SDK(예: `@mj-studio/react-native-naver-map`). **구현 착수 시 Expo config plugin 지원 + new-arch/RN0.81 + expo 54 호환을 먼저 검증**하고, 안 맞으면 동등 대안(webview-embed) 폴백. 확정 패키지의 config plugin을 `app.json` `plugins`에 추가.
- **인증**: 웹과 **동일 NCP "Maps" 애플리케이션의 client ID 재사용**. NCP 콘솔에서 그 애플리케이션에 **Mobile Dynamic Map** 활성화 + **Android 패키지명 `com.evns.cleverdriverapp` / iOS 번들 ID `com.evns.cleverdriverapp` 등록**(사용자가 콘솔에서 수행). 앱은 `EXPO_PUBLIC_NCP_MAP_CLIENT_ID` env로 client ID만 주입(값은 사용자 제공, 코드/문서에 하드코딩 금지).
- **react-native-maps 제거**: 현재 `app.json` `plugins`의 `react-native-maps`(1.20.1은 config plugin 없어 prebuild 실패 원인)와 `android.config.googleMaps` 제거. 의존성에서 react-native-maps 제거(또는 미사용 유지). — 구글 지도 경로 완전 제거.
- **지도 용도(MVP)**: 목적지 좌표 핀 표시(주문 상세). 인앱 턴바이턴 없음 — **"길안내"는 네이버 지도앱 딥링크**(`nmap://route/car?...` 또는 좌표 기반 URL scheme, 미설치 시 웹 fallback).
- 좌표: 주문 응답의 `latitude`/`longitude` 사용(이미 존재).

---

## 6. 데이터 / API 매핑

| 화면/동작 | 백엔드 | 기존 클라이언트 |
|-----------|--------|-----------------|
| 로그인 | `POST /api/v1/rider-auth/login` (phoneNumber, password) | `riderAuthClient.login` |
| 토큰 갱신 | `POST /api/v1/rider-auth/refresh` | `riderAuthClient.refresh` |
| 내 배차 목록 | `GET /api/v1/rider/me/dispatch-orders` | `riderDispatchClient.listAssigned` |
| 대기 콜 목록 | `GET /api/v1/rider/me/offered-calls` (CALL 차량만 비어있지 않음) | `riderDispatchClient.listOfferedCalls` |
| 콜 수락 | `POST /api/v1/rider/me/offered-calls/{id}/accept` (bikeId는 서버가 라이더로 추론) | `riderDispatchClient.acceptCall` |
| 사진 완료 | `POST /api/v1/rider/me/dispatch-orders/{id}/complete` (multipart photo) | `riderDispatchClient.completeDelivery` |
| (후속) 완료 목록 | `GET /api/v1/rider/me/dispatch-orders/completed` | `riderDispatchClient.listCompleted` |
| (후속) 내 프로필/차량 | `GET /api/v1/rider/me`, `/me/vehicle` | `riderProfileClient` |

주문 필드(리스트/상세): `id, customerName, customerPhone, address, latitude, longitude, sequence, status, completedAt` — `riderDispatchClient`의 `RiderDispatchOrder` 타입에 이미 존재(필요 시 확인/보강).

---

## 7. 인증 / 토큰

- 로그인 성공 시 `accessToken`/`refreshToken`/만료를 **secure store**(`expo-secure-store`, 기존 `createExpoSecureDriverAccessTokenStore` 재사용)에 저장.
- 요청 시 `Authorization: Bearer <accessToken>`. 401/만료 시 refresh 시도 → 실패하면 로그인 화면으로.
- 로그아웃(후속 최소): 토큰 삭제. `POST /api/v1/rider-auth/logout`는 후속.

---

## 8. 재사용 / 드롭 요약

**재사용**: thundercrew rider 클라이언트(auth/dispatch/profile), `platform/expo/camera`·`secureStore`, `domain/riderAuth`·`domain/dispatch/riderDispatch`·`domain/profile/riderProfile`, `ui/components`, 기존 화면 **스타일**.
**MVP에서 바이패스(호출 안 함, 잔존)**: `api/deliveryServer/*`, `domain/route`·`routeAccess`·`consent`·`delivery`·`driverFlow`·`events`·`location`(continuousLocationStream)·`offline`, 기존 `AppRoot.tsx`의 delivery-server 플로우.
**제거**: `react-native-maps` config plugin + `android.config.googleMaps`(app.json).
**추가**: `@mj-studio/react-native-naver-map`(+ config plugin), 썬더크루-first `driverRuntimeConfig` + `RiderAppRoot` + 4개 화면.

---

## 9. 설정 / 시크릿

- `.env`(EXPO_PUBLIC_*, 값은 사용자 제공):
  - `EXPO_PUBLIC_THUNDERCREW_SERVICE_OPS_BASE_URL` — 썬더크루 rider API 오리진(prod 붙이려면 실서버, mock이면 미설정).
  - `EXPO_PUBLIC_NCP_MAP_CLIENT_ID` — NCP Maps client ID(웹과 동일 애플리케이션, 모바일 등록 필요).
- **위치 권한 제외**: `app.json`에서 백그라운드/포그라운드 위치 플러그인·권한을 MVP 범위에서 제거하거나 유지하되 미사용(카메라 권한은 유지 — 사진 완료용).
- ⚠️ 비밀키/시크릿(NCP secret, 서명 키 등)은 코드·문서에 넣지 않음. NCP 등록·키 발급은 사용자가 콘솔에서 수행.

---

## 10. 테스트

- 앱은 자체 테스트 러너(`npm run test`, `scripts/run-tests.mjs`) + `typecheck`(`tsc --noEmit`) + `lint`(`expo lint`) 존재.
- **단위/도메인 테스트**: 신규 썬더크루-first config·화면 상태 머신·주문 매핑에 대해 기존 패턴(`*.test.ts`)으로 테스트 추가. rider 클라이언트는 이미 테스트 존재(재사용).
- **네이티브 빌드 게이트**: `npx expo prebuild -p android` + 로컬 `expo run:android`로 prebuild/컴파일 성공 확인(지도 SDK config plugin 포함). 실기기 스모크는 사용자.
- 런타임 QA: mock 모드로 화면 흐름 확인 → live 모드(실 NCP client ID + 썬더크루 URL)에서 로그인·목록·완료 확인.

---

## 11. 손대는 파일 (요약)

| 파일 | 변경 |
|------|------|
| `app.json` | react-native-maps plugin + googleMaps config 제거, `@mj-studio/react-native-naver-map` plugin 추가, 위치 권한 정리 |
| `package.json` | react-native-maps 제거(선택), naver-map 추가 |
| `src/app/config/driverRuntimeConfig.ts` | 썬더크루-first(게이트=thundercrew URL), rider 서비스 팩토리 |
| `src/app/RiderAppRoot.tsx` (신규) | 앱 루트 상태 머신(로그인/목록/상세/완료) |
| `src/ui/screens/LoginScreen.tsx` 등 (신규 화면) | 로그인 · **목록(2탭: 내 배차/대기 콜 + 콜 수락)** · 상세 · 완료 |
| `src/ui/components/NaverMap*.tsx` (신규) | 네이버 지도 핀 + 길안내 딥링크 |
| `App.tsx` | RiderAppRoot 렌더 |
| 신규 `*.test.ts` | config·상태·매핑 테스트 |

## 12. 검증 계획
- 앱: `npm run typecheck` + `npm run lint` + `npm run test`.
- 네이티브: `expo prebuild -p android` + `expo run:android` 로컬 빌드 성공(지도 plugin 포함).
- 런타임: mock 흐름 → live(실 NCP/썬더크루) 로그인·목록·사진완료 → #4 웹 모니터 반영 확인.

## 13. 후속 페이즈
- P2: **운행 온/오프(availability) 상태**(백엔드 라이더 가용성 개념 선행 필요), 완료 목록 탭, 내 차량/프로필.
- P3: 정비/보험/팁/알림, 서명·바코드 증빙, 오프라인 완료 큐, 실시간 콜 푸시 알림.
- 정리: delivery-server 코드·미사용 도메인 제거.
