# 드라이버 앱 ↔ 웹 연동 설계 (Driver app integration)

**Date:** 2026-06-29
**Status:** Design (approved) — Phase 1(백엔드 드라이버 API)부터 구체화
**Repos:** `thundercrew-domain`(백엔드 + 웹), `clever-driver-app`(Expo/RN Android·iOS)

## 확정 전제 (사용자 승인)
- 백엔드: **thundercrew `service-ops-api` 직결** (별도 delivery-server 미사용).
- 위치: 앱은 **본인 위치 표시만**. 웹 지도 차량위치/텔레메트리/OTOPLUG는 **변경 없음**.
- 배차 전달: **MVP=폴링** → 2차 FCM 푸시.
- 인증: **rider-auth (전화+비밀번호, RIDER JWT)** — 기존 구현 재사용.
- 앱 지도: **react-native-maps** (Expo 친화). 추후 필요 시 Naver 전환.

## 앱이 제공할 기능 (사용자 요구)
1. 웹에서 배정된 배차/콜과 연동 (수신 + 콜 수락 + 완료 보고)
2. 팁 · 누적주행거리 · 정비 알림을 웹에서 받아 표시
3. 웹에서 적용된 팁 · 충전소를 앱 지도에 표시
4. 본인 위치가 찍힌 지도

---

## 아키텍처
```
clever-driver-app (Expo/RN)
  └─ rider-auth 로그인 → RIDER JWT (secure-store)
  └─ HTTPS REST 폴링 → thundercrew service-ops-api  (/api/v1/rider/** = ROLE_RIDER)
웹(front-admin-web): 배정·생성·모니터링.  앱: 현장 수행(수락·완료).
위치: 앱 expo-location 자체 표시 (백엔드 미수집).
```

기존 패턴: `RiderSelfReadController`(`/api/v1/rider`)가 `@AuthenticationPrincipal Jwt` → `riderId` claim → `riderVehicleReadService.activeBikeIdOrNull(riderId)`로 내 차량을 찾고, 기존 dispatch/tip/station 서비스를 **재사용**한다. 신규 엔드포인트도 동일 패턴.

---

## Phase 1 — thundercrew 드라이버 API 계약 (핵심)

모든 경로 `/api/v1/rider/**` (ROLE_RIDER). JWT `riderId` → 내 활성 차량 `bikeId` 해석 후 동작. 활성 차량 없으면 빈 결과/409.

### 읽기 (기존 Read 서비스 재사용)
| 엔드포인트 | 동작 | 재사용 |
|---|---|---|
| `GET /rider/me` | 내 프로필 | 기존 |
| `GET /rider/me/vehicle` **확장** | 내 차량 + **누적주행거리(odometer)** + 연결상태 + 마지막수신 | `RiderVehicleResponse`에 필드 추가 (bike_current_states) |
| `GET /rider/me/dispatch-orders` | 내 진행 중(ASSIGNED) 배차 | 기존 |
| `GET /rider/me/dispatch-orders/completed` | 내 완료 배차 | `dispatchOrderReadService.listCompletedByBike(bikeId)` |
| `GET /rider/me/offered-calls` | 내 차종(CALL)으로 온 미배정(OFFERED) 콜 | `DispatchOrderReadService` 확장 |
| `GET /rider/me/tips` | 공개(PUBLISHED) 팁 — 지도 마커 | `tipRepository` 재사용, status=PUBLISHED만 |
| `GET /rider/me/stations` | 충전소 — 지도 마커 | `battery_stations` 재사용 |
| `GET /rider/me/maintenance` | 내 차량 정비 임박/지연 요약 | `MaintenanceReadService` 재사용(bikeId) |
| `GET /rider/me/notifications` | 내 알림(배차/정비) | `notifications` where ref_rider_id/ref_bike_id |

### 쓰기 (신규 Command — 본인 소유 검증 필수, ArchUnit write-allowlist 등록)
| 엔드포인트 | 동작 | 위임 |
|---|---|---|
| `POST /rider/me/offered-calls/{id}/accept` | 내 차량으로 오퍼 콜 수락 | `deliveryCallService.acceptCall(id, myBikeId)` — 단 **myBikeId 강제**(요청 bikeId 무시) + CALL 차종 검증 |
| `POST /rider/me/dispatch-orders/{id}/complete` (multipart photo) | 내 배차 완료(사진) | 주문이 **myBikeId 소속인지 검증** 후 `dispatchOrderCommandService.complete(id, photo, contentType, completedBy=riderId)` |

> 어드민 버전(`/dispatch-orders/{id}/complete`, `/calls/{id}/accept`)은 그대로 두고, 라이더 버전은 **소유권 검증을 추가**한 별도 컨트롤러 메서드로 신설한다(서비스 로직은 재사용).

### 계약 테스트
`RiderSelfApiContractTests`(신설/확장): rider JWT로 각 엔드포인트 200 + 소유권 위반 시 403/404 + 활성차량 없음 빈 결과.

---

## Phase 2 — 웹 "업무관리" 수정 (작음)

수락·완료 주체가 웹 → 앱(현장 라이더)으로 이동. 웹은 배정/생성 + 모니터링.

| 패널 | 수정 |
|---|---|
| 콜배차(BaeminCallPanel) | 오퍼 생성 유지. **수락은 앱**으로 — 웹은 "수락 대기/수락됨(누가)" 모니터링 표시. (웹 수동 수락은 fallback로 유지 가능) |
| 단일/순차/왕복 배차 | 변경 거의 없음 (배정 결과가 앱 `/me/dispatch-orders`로 흐름) |
| 배송 완료 | 앱에서 완료(사진). 웹은 완료내역/사진 **조회 전용**(이미 차량상세 완료버튼은 제거됨) |
| 정비·주행거리·지도(관제) | 변경 없음 |

---

## Phase 3+ — 앱 (clever-driver-app, 별도 레포)
- 인증: 전화번호 lookup → **rider-auth 로그인(전화+비번)** + JWT secure-store.
- **인앱 지도(react-native-maps)**: 본인 위치(expo-location) + 팁/충전소/배차목적지 마커.
- 화면: 로그인 → 홈(지도) → 내 콜/배차(폴링) → 콜 수락 / 배송 상세 → **완료(사진)** → 내 차량(주행거리·정비).
- API 클라이언트 재배선: `clever-delivery-server /driver/*` → thundercrew `/api/v1/rider*`.
- 재사용: expo-camera/image-picker(완료사진), 오프라인 큐(완료 이벤트 재시도), secure-store.
- 기존 route/company/stop/consent 도메인은 dispatch 모델로 대체(동의 화면은 스토어 심사 위해 유지).

---

## 비목표 (이번 범위 제외)
- 앱 GPS → 웹 지도 차량위치 (위치는 앱 표시만으로 결정).
- FCM 푸시 (2차).
- Naver 지도 SDK (react-native-maps로 시작).
- 정산/고객알림/관제 고도화.

## 리스크 / 미해결
- 앱 리팩터 규모(다른 백엔드 모델 → thundercrew). 인프라는 재사용, 도메인은 교체.
- 한국 지도 디테일/길찾기: 구글맵 한국 제약 → 인앱은 개요용 + 길찾기 외부 핸드오프로 우회.
- 두 레포 동시 작업 → 각자 spec/plan/PR. 백엔드 계약(Phase 1)을 먼저 고정해 앱·웹이 그 위에 빌드.
