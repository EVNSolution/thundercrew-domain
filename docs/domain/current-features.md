# 현행 기능 명세 — 화면 기준 (as-is)

**기준: 운영 배포된 상태.** 커밋 `3b0fd3a`, 스키마 V54, 2026-08-18 배포.

지금 코드에 있는 것을 있는 그대로 적는다. 무엇이 어때야 하는지는 적지 않는다 —
그건 이 문서를 고쳐서 정한다.

## 고치는 방법

각 항목의 `판정` 칸에 적어 주세요.

| 표기 | 뜻 |
|---|---|
| `유지` | 그대로 둔다 |
| `삭제` | 없앤다 |
| `통합→X` | X 로 합친다 |
| `개명→X` | 이름만 X 로 바꾼다 |
| `보류` | 나중에 정한다 |

빈칸은 "아직 안 봤다" 로 읽습니다.

## 읽는 법

화면의 UI 요소마다 그것이 실제로 호출하는 백엔드를 붙였다. 호출 사슬은
`버튼 → 서버 액션 → API 클라이언트 → 백엔드` 인데, 중간 두 단계는 배관이라
생략하고 **버튼과 엔드포인트만** 적는다.

백엔드 경로는 `/api/v1` 을 생략한다. `POST /bikes` 는 `POST /api/v1/bikes` 다.
`—` 는 백엔드를 부르지 않는 화면 안 동작(필터·정렬·모달 열기 등)이다.

## 범위 — 앱 넷

### 운영 (실제 서비스 중)

| 앱 | 정체 | 이 문서 |
|---|---|---|
| `development/frontend` | Next.js 운영 콘솔 + 라이더 웹 | §1~§6 |
| `development/backend` | Spring Boot API | 각 화면에 붙여둠 + §8 |
| `development/app` | `clever-driver-app` — Expo 모바일 | §7 |

### 시험 (서비스하지 않음)

| 앱 | 정체 | 이 문서 |
|---|---|---|
| `development/web` | 새 관리자 웹 (Vite SPA). 목업 데이터, 백엔드 미연결 | §12 |

**판정 대상은 운영뿐이다.**

---

## 0. 이미 정한 것 / 아직 안 정한 것

### 정한 것

1. **용도와 배차 방식은 한 축이다.** 직교하는 두 축이 아니다. 코드 주석과 V51
   마이그레이션에 "직교한다" 고 적혀 있는데 **틀렸다.**
2. 배송 = 콜 배차 방식을 쓰는 시스템. 클리닝 = 시간 기반 순차 배차.
3. **다른 배차 방식은 없앤다.** 배송 / 클리닝 두 값으로 통일.
4. 업무 관리 화면을 **배송 · 클리닝 두 섹션**으로 재편. 왕복 배차는 코드까지 걷어낸다.

### 안 정한 것

- 이 한 축을 **누가 소유하는가** — 차량(`bikes.purpose`) / 계약
  (`rider_bike_contracts.service_type`) / 라이더(`riders.role`) 세 곳에 흩어져 있다.
- 라이더 직무(`RiderRole`)를 차량 용도와 같은 축으로 볼 것인지.
- **지도 스택** — §1.1.
- 배송이 **주문 풀 모델**(§12 문서)인지 **운영자 지정 배차**(현재 콘솔)인지.

---

## 1. 운영 콘솔 — 로그인 `/login`

| UI 요소 | 동작 | 백엔드 | 판정 |
|---|---|---|---|
| 로그인 ID · 비밀번호 입력 | | — | |
| **로그인** 버튼 | 세션 쿠키 발급 | `POST /auth/login` | |
| (자동) 토큰 만료 시 | 갱신 | `POST /auth/refresh` | |
| **로그아웃** (상단바) | 세션 종료 | `POST /auth/logout` | |
| 비밀번호 변경 | | `PATCH /auth/me/password` | |

### 1.1 지도 스택 — 운영과 시험이 갈리는 지점

**원칙이었던 것: 운영은 NAVER, 시험은 MapLibre.** 2026-08-18 배포로 콘솔 메인 지도가
MapLibre 가 되면서 이 원칙이 깨졌다. 배포 후 운영 지도가 정상 렌더되는 것을 확인했다
(2026-08-18, 사용자 확인). 즉 **되돌릴 이유는 없어졌고, 남은 것은 나머지 세 지도를
어떻게 할지다.**

| 지도 화면 | 소속 | 현재 스택 | 판정 |
|---|---|---|---|
| 콘솔 메인 지도 | 운영 | **MapLibre + OpenFreeMap** (8/18 배포로 변경) | |
| 라이더 웹 지도 | 운영 | NAVER NCP Maps | |
| 팁 좌표 미니맵 | 운영 | NAVER NCP Maps | |
| 모바일 앱 지도 | 운영 | NAVER 네이티브 SDK | |
| SPA 지도 | 시험 | MapLibre + OpenFreeMap | |

옮긴 이유는 지도 품질이 아니라 프리뷰가 막혀서였다. NCP 는 호출 오리진이 콘솔에
등록돼 있지 않으면 인증을 거부하고, 그때 SDK 가 자기 정리 코드에서 터져 렌더러를
죽인다(교차 출처라 앱 코드로 막을 수 없다).

지금 상태의 문제는 **한 제품 안에 지도 스택이 둘**이라는 것이다. 라이더 웹·팁 미니맵·
모바일 앱이 아직 NAVER 라서 NCP 키와 오리진 등록이 계속 필요하고, 지도 관련 버그를
두 번씩 고쳐야 한다.

| 항목 | 판정 |
|---|---|
| 라이더 웹 지도를 MapLibre 로 옮길 것인가 | |
| 팁 좌표 미니맵을 MapLibre 로 옮길 것인가 | |
| 모바일 앱 지도(네이티브 SDK)는 어떻게 할 것인가 | |

---

## 2. 운영 콘솔 — 지도 `/`

### 2.1 화면이 열릴 때 (서버 렌더)

| 불러오는 것 | 백엔드 | 판정 |
|---|---|---|
| 지도 상태(차량 핀 · 충전소 핀) | `GET /dashboard/map-state` | |
| 차량 목록 | `GET /bikes` | |
| 라이더 목록 | `GET /riders` | |
| 충전소 목록 | `GET /battery-stations` | |
| 계약 목록 | `GET /rider-bike-contracts` | |
| 정비 카탈로그 · 기록 | `GET /maintenance-items` · `GET /maintenance-records` | |
| 보험 | `GET /insurance-items` · `GET /rider-insurances` | |
| 팁 | `GET /tips` | |

폴링은 Next.js 라우트 `/api/dashboard/map-state` 를 거쳐 같은 백엔드를 다시 부른다.

### 2.2 지도 캔버스

| UI 요소 | 동작 | 백엔드 | 판정 |
|---|---|---|---|
| 상단 배차 방식 탭 | 전체/콜/단일/순차/왕복/기타 필터 | — | |
| 차량 마커 | 아이콘(2륜 스쿠터·4륜 박스트럭) + 번호판 라벨 | — | |
| 차량 마커 상태 배지 | 배송형 `배송 중`/`대기` · 청소형 `이동 중`/`작업 중`/`대기 중` | — | |
| 차량 마커 상태 칩 | 연결·미연결 · 시동 ON/OFF | — | |
| 시동 출발 말풍선 | 청소형만, 4초 표시 | — | |
| 마커 클릭 | 차량 상세 패널 열기 | — | |
| 이동 경로선 | 선택 차량 최근 waypoint | — | |
| 충전소 마커 · 팁 마커 · 배송지 마커 | | — | |
| 지도 검색 | 좌표 이동 | — | |
| 라이트/다크 토글 | | — | |

### 2.3 차량 상세 패널 (마커 또는 표 행 클릭)

| UI 요소 | 동작 | 백엔드 | 판정 |
|---|---|---|---|
| 텔레메트리 표시 | 위치·속도·시동·연결 | `GET /api/overview/vehicle-device/{bikeId}` (Next 라우트) | |
| 정비 상태 목록 | 품목별 임박/지연 | `GET /api/overview/vehicle-maintenance/{bikeId}` (Next 라우트) | |
| **교환 완료** 버튼 | 정비 실시 기록 | `POST /bikes/{bikeId}/maintenance-records` | |
| **운영 상태** 토글 | 운행 ↔ 대기 | `PATCH /bikes/{id}/operation-status` | |
| **시동 차단** 스위치 | | `PATCH /bikes/{id}/ignition-block` | |
| **수정** 버튼 | 차량 정보 변경 | `PATCH /bikes/{id}` (+ 단말 연결 시 `POST /devices` · `POST /bike-device-installations` · `PATCH /bike-device-installations/{id}/remove`) | |
| 보험 메모 저장 | | `PATCH /riders/{id}` | |
| (자동) 변경 기록 | | `POST /audit-logs` | |

### 2.4 하단 탭

| 탭 | UI 요소 | 백엔드 | 판정 |
|---|---|---|---|
| 차량 | 표(차량번호·구분·운영상태·IMEI·라이더·연락처·교육·구독렌탈·형태·기간·보험) | — (2.1 에서 받은 것) | |
| 차량 | 필터 드롭다운(운영상태 · 정비상태 임박/지연) | — | |
| 충전소 | 목록 · 상세 다이얼로그 | `PATCH /battery-stations/{id}` · `PATCH /battery-stations/{id}/battery-counts` | |
| 충전소 | 등록 / 삭제 | `POST /battery-stations` · `DELETE /battery-stations/{id}` | |
| 팁 | 목록 | `GET /tips` | |
| 팁 | **팁 추가** | `POST /tips` | |
| 팁 | 수정 | `PUT /tips/{id}` | |
| 팁 | 삭제 | `DELETE /tips/{id}` | |
| 팁 | **게시** | `POST /tips/{id}/publish` | |

### 2.5 상단 · 기타

| UI 요소 | 동작 | 백엔드 | 판정 |
|---|---|---|---|
| 알림 벨 | 목록 | `GET /notifications` | |
| 알림 확인 | | `POST /notifications/{id}/acknowledge` | |
| 배송 상태 패널 | 진행 중 배차 | `GET /dispatch-orders/active` | |
| 플릿 시뮬레이션 | 가상 차량 이동(IMEI 가 `-` 로 시작) | — | |
| 시뮬 재점화 알림 | | `POST /reignition-notifications` | |

---

## 3. 운영 콘솔 — 자원 관리 `/management/resources`

### 3.1 차량 섹션

| UI 요소 | 동작 | 백엔드 | 판정 |
|---|---|---|---|
| 표 | 차량번호 · **용도** · 구분(휠) · 엔진 · IMEI · 단말기ID | `GET /bikes` | |
| **차량 등록** | 용도·휠·엔진·운영상태 선택 | `POST /bikes` (+ `GET/POST /devices`, `POST /bike-device-installations`) | |
| 행 클릭 → 상세 | 수정 | `PATCH /bikes/{id}` | |
| **삭제** | | `DELETE /bikes/{id}` (+ `GET /bike-device-installations`, `PATCH .../remove`) | |
| **내려받기** | 엑셀 | `GET /bikes/export` (Next 라우트 경유) | |
| **업로드** → 미리보기 | | `POST /bikes/bulk-preview` | |
| 미리보기 → **적용** | | `POST /bikes/bulk-apply` | |

### 3.2 라이더 섹션

| UI 요소 | 동작 | 백엔드 | 판정 |
|---|---|---|---|
| 표 | 이름 · **직무** · 연락처 · 교육이수 · 팀 | `GET /riders` | |
| **라이더 등록** | | `POST /riders` (+ `POST /rider-education-records`) | |
| 수정 | | `PATCH /riders/{id}` | |
| **삭제** | | `DELETE /riders/{id}` | |
| 비밀번호 초기화 | | `PATCH /riders/{id}/credential` | |
| **내려받기** / **업로드** | | `GET /riders/export` · `POST /riders/bulk-preview` · `bulk-apply` | |

### 3.3 매칭(계약) 섹션

| UI 요소 | 동작 | 백엔드 | 판정 |
|---|---|---|---|
| 표 | 차량번호 · **서비스 유형** · 라이더 · 연락처 · 계약형태 · 인수방식 · 시작/종료일 · 상태 | `GET /rider-bike-contracts` | |
| 계약 생성 폼 | | `POST /rider-bike-contracts` | |
| **종료** 버튼 | | `PATCH /rider-bike-contracts/{id}/terminate` | |
| **내려받기** | | `GET /contracts/export` | |
| **매칭로그** | | `GET /contracts/log-export` | |
| **업로드** → 미리보기 → 적용 | | `POST /contracts/bulk-preview` · `bulk-apply` | |

### 3.4 작업 로그 섹션

| UI 요소 | 동작 | 백엔드 | 판정 |
|---|---|---|---|
| 표 | 발생시각 · 작업자 · 대상 · 항목 · 변경 | `GET /audit-logs` | |
| 필터 칩 | 전체/차량/라이더/매칭/배차/운영상태/정비/보험 | — | |

### 3.5 단말 데이터 수신

| UI 요소 | 동작 | 백엔드 | 판정 |
|---|---|---|---|
| 상태 표시 | 수신 중 / 중지됨 | `GET /otoplug/observers` | |
| **단말 데이터 수신 시작** | observer 등록 | `POST /otoplug/observers/register` | |
| **수신 중지** | observer 해제 | `POST /otoplug/observers/ignore` | |

---

## 4. 운영 콘솔 — 업무 관리 `/management/operations`

### 4.1 콜 배차

| UI 요소 | 동작 | 백엔드 | 판정 |
|---|---|---|---|
| 제안된 콜 목록 | | `GET /dispatch-orders/calls/offered` | |
| **시스템 배차** | 자동 배차 | `POST /dispatch-orders/calls/system` | |
| **콜 제안** | 차량 지정 제안 | `POST /dispatch-orders/calls/offer` | |
| **수락** | | `POST /dispatch-orders/calls/{id}/accept` | |
| 후보 차량 목록 | `serviceType` 이 CALL 또는 SINGLE 인 차량만 | — (차량 목록에서 필터) | |

### 4.2 단일 배차

| UI 요소 | 동작 | 백엔드 | 판정 |
|---|---|---|---|
| 활성 배차 모니터 표 | | `GET /dispatch-orders/active` | |
| **업로드** → 미리보기 | | `POST /dispatch-orders/bulk-preview` | |
| 미리보기 → **적용** | | `POST /dispatch-orders/bulk-apply` | |
| 행 **수정** 다이얼로그 | 고객·주소 변경 | `PATCH /dispatch-orders/{id}` | |
| **취소** | | `DELETE /dispatch-orders/{id}` | |
| **내려받기** | | `GET /dispatch-orders/export` | |

### 4.3 순차 배차

| UI 요소 | 동작 | 백엔드 | 판정 |
|---|---|---|---|
| **업로드** → 미리보기 | | `POST /dispatch-orders/bulk-preview-sequential` | |
| 미리보기 → **적용** | | `POST /dispatch-orders/bulk-apply-sequential` | |

### 4.4 왕복 배차 — **운영 사용 0건**

| UI 요소 | 동작 | 백엔드 | 판정 |
|---|---|---|---|
| 진행 중 배치 | | `GET /dispatch-batches/active` | 삭제 확정 |
| **왕복 생성** | 수거 단계 시작 | `POST /dispatch-batches/round` | 삭제 확정 |
| **배송 시작** | 2단계 전환 | `POST /dispatch-batches/{id}/start-delivery` | 삭제 확정 |

---

## 5. 운영 콘솔 — 정비 관리 `/management/maintenance`

| UI 요소 | 동작 | 백엔드 | 판정 |
|---|---|---|---|
| 카탈로그 표 | 품목 · 휠 · 엔진 · 교환주기 | `GET /maintenance-items` | |
| 휠 필터 | 전체 / 2륜 / 4륜 | — | |
| 엔진 필터 | 전체 / 전기 / 내연 / LPG | — | |
| **+ 항목 추가** | 휠 × 엔진 토글로 분류 지정 | `POST /maintenance-items` | |
| 행 클릭 → 수정 | | `PATCH /maintenance-items/{id}` | |
| **삭제** | | `DELETE /maintenance-items/{id}` | |

---

## 6. 운영 — 라이더 웹 `/rider/*`

| 라우트 | UI 요소 | 백엔드 | 판정 |
|---|---|---|---|
| `/rider/register` | 가입 폼 | `POST /rider-auth/register` | |
| `/rider/login` | 로그인 | `POST /rider-auth/login` | |
| `/rider/password` | 비밀번호 변경 | `POST /rider/me/password` | |
| `/rider` | 내 정보 | `GET /rider/me` | |
| `/rider` | 내 배차 · 완료 배차 | `GET /rider/me/dispatch-orders` · `/completed` | |
| `/rider` | 제안된 콜 · 수락 | `GET /rider/me/offered-calls` · `POST /rider/me/offered-calls/{id}/accept` | |
| `/rider` | 내 차량 · 정비 | `GET /rider/me/vehicle` · `/maintenance` | |
| `/rider` | 팁 · 충전소 · 알림 | `GET /rider/me/tips` · `/stations` · `/notifications` | |
| `/rider` | 지도 | — (NAVER SDK) | |

---

## 7. 운영 — 모바일 앱 `clever-driver-app` (Expo)

**한 코드베이스에 앱이 둘이다.**

| 루트 | 대상 | 백엔드 |
|---|---|---|
| `AppRoot.tsx` | 기사(driver) | **외부 배송 서버** + 썬더크루(선택) |
| `RiderAppRoot.tsx` | 라이더 | 썬더크루만 |

### 7.1 기사 앱 — 외부 배송 서버 계통

| 화면 | 역할 | 백엔드 | 판정 |
|---|---|---|---|
| `login` | 회사 코드 → 전화번호 단계 로그인 | 외부 배송 서버 | |
| `routes` | 배정 노선 목록 (활성/완료/예정) | 외부 배송 서버 | |
| `routeDetail` → `stopDetails` | 노선·정차지 상세 | 외부 배송 서버 | |
| `arrivalCheck` → `stopCompleted` | 도착 확인 · 증빙 제출 | 외부 배송 서버 | |
| `completedDeliveries` | 완료 이력 | 외부 배송 서버 | |
| `liveTracking` | 실시간 위치 | 외부 배송 서버 | |

**기사 앱의 노선·정차지·증빙은 썬더크루가 아니라 외부 배송 서버에서 온다.**

### 7.2 라이더 앱 — 썬더크루 계통

| 화면 | 역할 | 백엔드 | 판정 |
|---|---|---|---|
| `LoginScreen` | 로그인 | `POST /rider-auth/login` · `refresh` | |
| `DispatchListScreen` | 내 배차 · 제안 콜 수락 | `GET /rider/me/dispatch-orders` · `offered-calls` · `POST .../accept` | |
| `OrderDetailScreen` | 상세 · 완료 처리 | `POST /rider/me/dispatch-orders/{id}/complete` | |
| `riderVehicle` | 내 차량 · 정비 | `GET /rider/me/vehicle` · `/maintenance` | |
| `riderMap` | 지도 | — | |

### 7.3 앱 고유 기능 — 콘솔에 없는 것

| 기능 | 설명 | 판정 |
|---|---|---|
| 증빙 촬영 | 사진 · 서명 · 바코드 3종 | |
| 오프라인 큐 | 제출 실패 건 저장 후 재전송 | |
| 연속 위치 스트림 | 백그라운드 위치 전송 | |
| 네이버 지도 딥링크 | 정차지 길안내 | |
| 콜 알림 배너 + 음성(TTS) | | |
| 릴리스 프리플라이트 CLI | 네이티브 빌드 전 검증 | |

| 항목 | 판정 |
|---|---|
| 외부 배송 서버 연동을 계속 유지할 것인가 | |
| 기사 앱과 라이더 앱을 한 코드베이스에 둘 것인가 | |

---

## 8. 화면에서 도달할 수 없는 백엔드

API 클라이언트에 메서드는 있는데 **콘솔 어느 버튼으로도 닿지 않는** 것들. 33개.
백엔드 엔드포인트는 살아 있다.

| 영역 | 도달 못 하는 기능 | 판정 |
|---|---|---|
| 계약 템플릿 | 조회 · 생성 · 수정 · 삭제 (`/contract-templates`) | |
| 계약 | 계약 수정 (`PATCH /rider-bike-contracts/{id}`) — 종료만 가능 | |
| 보험 | 보험 상품 CRUD (`/insurance-items`) | |
| 보험 | 라이더 보험 CRUD (`/rider-insurances`) — 지금은 라이더 메모 필드로 대신 | |
| 장비 | 장비 유형 CRUD (`/equipment-types`) | |
| 장비 | 차량 장비 CRUD · 해제 (`/bike-equipments`) | |
| 단말 | 단말 수정 · 삭제 (`PATCH/DELETE /devices/{id}`) | |
| 교육 | 교육 기록 삭제 (`DELETE /rider-education-records/{id}`) | |
| 운영상태 이력 | 차량별 이력 조회 (`/bike-operation-status-histories`) | |
| 충전소 | 배터리 수량 변경 로그 (`/station-battery-count-logs`) | |
| 무결성 | 참조 정합성 점검 (`/integrity/reference-checks`) | |
| 단말 동기화 | 동기화 실행·결과 (`/device-api-sync-runs`) | |
| 차량 | 다음 고객 조회·설정 (`/bikes/{id}/next-customer`) | |
| 대시보드 | 차량 스냅샷 (`/dashboard/bikes/{id}/snapshot`) | |
| 라이더 | 앱 계정 연결·해제 (`/riders/{id}/app-account/*`) | |
| 팁 | 제보 접수 (`POST /tips/submissions`) — 라이더 쪽 경로 | |

---

## 9. 데이터 축 (enum)

| enum | 값 | 겹침 | 판정 |
|---|---|---|---|
| `BikePurpose` | DELIVERY · CLEANING | **`BikeServiceType` 와 같은 축.** 분기 로직 0건 | |
| `BikeServiceType` | CALL · SINGLE · SEQUENTIAL · ROUND · OTHER | **`BikePurpose` 와 같은 축.** 16곳에서 동작을 가름 | |
| `RiderRole` | RIDER · CLEANER | 차량 용도와 같은 구분. 분기 0건, 일치 검증 없음 | |
| `RiderSkillLevel` | BEGINNER · INTERMEDIATE · EXPERT | **UI 없음** | |
| `RiderTrainingStatus` | ONLINE · OFFLINE · INCOMPLETE | `RiderEducationType` + 교육기록과 3중 | |
| `RiderEducationType` | ONLINE · OFFLINE | 위와 동일 | |
| `BikeOperationStatus` | READY · IN_SERVICE | 아래 3개와 함께 차량 상태 4층 | |
| `ServicePhase` (프론트) | MOVING · WORKING · IDLE | 시뮬레이션 값 | |
| `TelemetryIgnitionStatus` | UNKNOWN · ON · OFF | 텔레메트리 | |
| 연결 상태 (프론트) | ONLINE · SIGNAL_LOST · PARKED_OFFLINE_NORMAL · STALE_UNKNOWN | 텔레메트리 | |
| `BikeWheelType` | TWO_WHEEL · FOUR_WHEEL | | |
| `BikeEngineType` | ELECTRIC · ICE · LPG | | |
| `MaintenanceCategory` | 휠 × 엔진 6종 | 위 둘의 곱 | |
| `ContractCategory` | SUBSCRIPTION · RENTAL · CUSTOM | | |
| `ContractReturnType` | TAKEOVER · RETURN | | |
| `ContractDurationUnit` | DAY · WEEK · MONTH · QUARTER · HALF_YEAR · YEAR | | |
| `DispatchOrderKind` | PICKUP · DELIVERY | PICKUP 운영 사용 0건 | |
| `DispatchOrderStatus` | OFFERED · ASSIGNED · COMPLETED | | |
| `DispatchBatchStatus` | COLLECTING · DELIVERING · DONE | 운영 사용 0건 | |
| `InsuranceCategory` / `InsuranceCoverageType` | 2종 / 5종 | | |
| `InsuranceDurationUnit` | 7종 | `ContractDurationUnit` 과 거의 동일 | |
| `BikeEquipmentManagementStatus` | NORMAL · DUE_SOON · OVERDUE | 정비 상태 등급과 유사 | |
| `BatteryStationStatus` | ACTIVE · MAINTENANCE · INACTIVE | | |
| `TipStatus` | PENDING · PUBLISHED | | |
| `TelemetrySource` | POLLING · WEBHOOK | | |
| `DeviceApiSync*` | 4종 | 단말 동기화 내부 | |

---

## 10. 확인된 겹침·모순

| # | 내용 | 근거 | 판정 |
|---|---|---|---|
| 1 | **용도와 배차 방식이 같은 축인데 두 곳에 저장** | `bikes.purpose` 는 분기 0건, `isCleaningFamily()` 가 16곳에서 동작을 가름 | 통합 확정 |
| 2 | **차량이 `serviceType` 을 가진 것처럼 보임** | V50 이 컬럼을 계약으로 옮겼으나 API 가 활성 계약에서 되뽑아 차량 필드로 반환. **계약 없는 차량은 콜 배차 후보에서 조용히 빠짐** (§4.1) | |
| 3 | **UI 라벨 "서비스 유형" 이 값과 안 맞음** | 매칭 표 컬럼명은 "서비스 유형" 인데 값은 전부 "…배차" | |
| 4 | **직무 ↔ 용도 일치 검증 없음** | 계약이 라이더·차량을 잇는데 어긋나도 통과 | |
| 5 | **교육 상태 3중** | 요약값 · 기록 종류 · 기록 테이블. 자동 동기화 없음 | |
| 6 | **차량 상태 4층** | 운영자 지정 · 시뮬 phase · 시동 · 연결. 마커 하나에 배지 2개 + 칩 1개 | |
| 7 | **숙련도 UI 없음** | 노출 화면(`RidersPanel`)이 렌더되지 않음 | |
| 8 | **기간 단위 enum 2개** | 계약용 · 보험용이 거의 동일 | |
| 9 | **지도 스택이 갈림** | §1.1. 운영 안에 NAVER 와 MapLibre 가 섞임 | |
| 10 | **보험 관리 경로가 둘** | 정식 API(`/rider-insurances`)는 화면에서 못 닿고, 실제로는 라이더 메모 필드로 처리 | |

---

## 11. 코드는 있는데 운영에서 안 쓰는 것

운영 DB 실측(2026-08-18) 기준.

| 기능 | 근거 | 판정 |
|---|---|---|
| 왕복 배차 (§4.4) | 배치 0건 · PICKUP 주문 0건 | 삭제 확정 |
| 콜 배차 값 `CALL` | 계약 0건 (화면은 구현돼 있음) | |
| `OTHER` 배차 방식 | 계약 0건 | |
| `RidersPanel` / `RiderDetailDialog` | 렌더되지 않음 | |
| 플릿 시뮬레이션 | 가상 차량 전용 | |

**운영 계약 분포**: SINGLE 18건(활성 7) · SEQUENTIAL 4건(활성 3). CALL/ROUND/OTHER 0건.
**차량 용도 백필 결과**: 클린차량 3대 · 배송용 10대. **라이더 11명 전원 `RIDER`.**

---

# 시험 영역 — 아래는 판정 대상이 아님

## 12. 시험 — 새 관리자 웹 (Vite SPA)

`development/web`. **목업 데이터로만 동작. 백엔드 미연결. 서비스하지 않는다.**

기록해 두는 이유는 하나 — 오늘 정한 "배송/클리닝 이원화" 가 여기 이미 구현돼 있어
설계 참고가 된다.

```
/login → /select-mode → /delivery/*  |  /cleaning/*  |  /maintenance/*
```

| 모드 | 화면 |
|---|---|
| 배송용 | 관제 · 배차 · 이력 · 관리 |
| 클린차량 | 관제 · 배차 · 이력 · 관리 |
| 정비 | 정비(차량별) · 품목 · 이력 — 용도 무관 전 차량 |
| 전역 | 감사 · 진단 · 설정 |

| | 배송 | 클리닝 |
|---|---|---|
| 배차 성격 | 주문 풀 — 올려두면 배송원이 잡는다 | 시간 예약 — 운영자가 시각 지정 |
| 순서 | 없음 | 예정 시각순 |
| 관제 주 표현 | 지도 | 타임라인 |
| 실패 신호 | 아무도 안 잡은 주문 | 예정 시각 초과 |
| 이력 지표 | 완료 시각, 증빙 | 예정 대비 편차, 정시율 |
| 차량 고유 장비 | 함체 | 없음 |

**주의**: "주문 풀 모델" 은 운영 콘솔에 없다. 콘솔의 배송은 운영자가 차량을 지정해
배차한다(§4.1·§4.2). 둘 중 무엇이 맞는지는 §0 미결.

---

## 13. `dev` 브랜치에 없는 설계 문서

`cc-admin-web-spa-redesign` 브랜치에만 있다. `dev` 만 보면 존재를 알 수 없다.

| 문서 | 내용 |
|---|---|
| `docs/frontend/03-screen-feature-map.md` (621줄) | 화면별 기능 정리. 용도를 진입 모드로 전환 |
| `docs/superpowers/specs/2026-08-05-meeting-260804-resource-dispatch-design.md` | 260804 미팅 요구사항 설계 |

| 항목 | 판정 |
|---|---|
| 두 문서를 `dev` 로 가져올 것인가 | |
