# 현행 기능 명세 — 화면 기준 (as-is)

**기준: 운영 배포 상태.** 커밋 `b3474ff` · 스키마 V55 · 2026-08-18. 지금 코드에 있는 것만
있는 그대로 적었다 — 코드 전수 추적(에이전트 10개 병렬 조사 + 미도달 2중 검증) 결과다.

## 고치는 방법

각 표의 `판정` 칸에 적어 주세요. 빈칸은 "아직 안 봤다"로 읽습니다.

| 표기 | 뜻 |
|---|---|
| `유지` | 그대로 둔다 |
| `삭제` | 없앤다 |
| `통합→X` | X 로 합친다 |
| `개명→X` | 이름만 X 로 바꾼다 |
| `수정: ...` | 동작을 이렇게 바꾼다 (자유 서술) |
| `보류` | 나중에 정한다 |

## 읽는 법

- 화면의 UI 요소마다 그것이 실제로 호출하는 백엔드를 붙였다. 호출 사슬(버튼 → 서버 액션
  → API 클라이언트 → 백엔드)의 중간 배관은 생략하고 **버튼과 엔드포인트만** 적는다.
- 백엔드 경로는 `/api/v1` 생략. `POST /bikes` = `POST /api/v1/bikes`.
- `—` 는 백엔드를 부르지 않는 화면 안 동작(필터·정렬·모달 열기 등).
- `※` 뒤는 구현 특이사항.

---

## 1. 로그인 · 세션

### 로그인 화면

| UI 요소 | 동작 | 백엔드 | 판정 |
|---|---|---|---|
| 로그인 ID 또는 이메일 입력 | 서비스 API 모드(SERVICE_OPS_API_BASE_URL 설정 시)에는 텍스트 입력(로그인 ID/이메일 겸용), 미설정 시 이메일 전용 입력으로 라벨·type 이 바뀜 | — | |
| 비밀번호 입력 | 비밀번호 입력 (required) | — | |
| 로그인 버튼 | signInAdmin 서버 액션 — 인증 성공 시 access/refresh 토큰을 httpOnly 쿠키(thundercrew_ops_access_token / thundercrew_ops_refresh_token, sameSite=lax, 운영 빌드 Secure)로 저장하고 /?auth=service-ops 로 이동 ※ 실패 시 /login?status=service-ops-auth-error(또는 missing-credentials)로 리다이렉트. SERVICE_OPS_API_BASE_URL 미설정 시 Supabase signInWithPassword 폴백(자사 백엔드 미호출). 평문 HTTP 프리뷰용 옵트아웃 SERVICE_OPS_COOKIE_INSECURE=true 존재 | `POST /auth/login` | |
| 상태 안내 메시지 | ?status= 값별 한 줄 안내 표시 — missing-env·auth-error·missing-credentials·service-ops-auth-error·session-required·signed-out (미들웨어/액션이 붙여 보낸 값을 같은 자리에 표시) | — | |

### 미들웨어(자동 동작)

| UI 요소 | 동작 | 백엔드 | 판정 |
|---|---|---|---|
| OTOPLUG 웹훅 통과 | /api/otoplug/* 요청은 인증 게이트·리다이렉트보다 먼저 무조건 통과 — 외부 단말 플랫폼의 공개 콜백. 실제 인증은 라우트 핸들러가 OTOPLUG-Channel-Token 헤더로 수행 | — | |
| /rider 리다이렉트 | 제거된 라이더 웹 경로(/rider, /rider/*)로 들어온 요청을 콘솔 루트(/)로 리다이렉트 | — | |
| 미인증 게이트 | access·refresh 쿠키가 둘 다 없으면 모든 페이지 요청을 /login 으로 리다이렉트 | — | |
| 로그인 페이지 역리다이렉트 | 쿠키가 하나라도 있는 상태로 /login 접근 시 루트(/)로 돌려보냄 | — | |
| access 토큰 자동 재발급 | access 만료·누락 + refresh 존재 시 미들웨어가 직접 refresh 를 호출해 새 access/refresh 를 이 요청의 request.cookies(SSR 즉시 반영)와 응답 Set-Cookie(다음 요청 반영) 양쪽에 기록 ※ 2026-08-18 수정 배포됨 — 이전에는 fetch URL 의 /api/v1 누락으로 자동 재발급이 항상 실패해 access 만료 때마다 재로그인해야 했다. 프리뷰 쿠키 옵트아웃(SERVICE_OPS_COOKIE_INSECURE)도 이 경로에 함께 반영 | `POST /auth/refresh` | |
| refresh 실패 처리 | refresh 거부·만료 또는 SERVICE_OPS_API_BASE_URL 미설정 상태에서 refresh 쿠키만 남아 있으면 쿠키 2종 모두 삭제 후 /login 으로 리다이렉트 | — | |
| 게이트 적용 범위(matcher) | _next/static·_next/image·favicon.ico·확장자 있는 정적 파일을 제외한 모든 페이지/서버 액션 요청에 적용 | — | |

### 상단바 계정

| UI 요소 | 동작 | 백엔드 | 판정 |
|---|---|---|---|
| 로그아웃 버튼 | window.confirm 1단계 확인 후 signOutAdmin 서버 액션 — 백엔드 로그아웃 호출 후 세션 쿠키 2종 삭제, /login?status=signed-out 이동 ※ 백엔드 호출이 실패해도 쿠키는 무조건 삭제(로컬 정리가 소스 오브 트루스). access 쿠키가 없으면 백엔드 호출 자체를 생략. 위치: components/layout/LogoutButton.tsx (AppShell 좌측 rail 유틸리티 영역) | `POST /auth/logout` | |
| 관리자 로그인 링크 | 세션 없는 상태의 상단바에 표시 — /login 으로 이동하는 단순 앵커 | — | |
| 테마 토글 | 라이트/다크 테마 전환 — 순수 화면 동작 (로그인 여부와 무관하게 표시) | — | |
| 비밀번호 변경 (호출 UI 없음) | changeAdminPassword 서버 액션 — 현재/새/확인 비밀번호 검증(누락·8자 미만·불일치 시 /?status=... 안내) 후 본인 비밀번호 변경, 성공 시 /?status=password-changed (세션 유지, 강제 로그아웃 없음) ※ 액션(app/login/actions.ts)과 API 클라이언트 메서드는 구현돼 있으나 이를 import 하는 UI 컴포넌트가 현재 코드베이스에 없음 — docstring 이 말하는 우상단 floating bar 다이얼로그는 렌더 트리에 존재하지 않음. POST /api/v1/auth/refresh 는 access 쿠키 누락 시에만 조건부 호출(refreshIfMissing), 실패 시 /login?status=session-required | `PATCH /auth/me/password` · `POST /auth/refresh` | |

---

## 2. 지도 화면 `/`

### 화면 로드(서버 렌더)

| UI 요소 | 동작 | 백엔드 | 판정 |
|---|---|---|---|
| 지도 초기 데이터(차량 핀·충전소 핀·팁·요약) | app/page.tsx 가 loadDashboardMapState() 로 대시보드 맵 상태를 1회 로드해 FullscreenMapHost 에 props 로 전달 | `GET /dashboard/map-state` | |
| 시뮬 차량 핀 합성(withSimulatedPins) | 텔레메트리 핀이 없는 IMEI '-' 시작 차량에 가상 좌표를 합성하고, ASSIGNED 최저 sequence 배차를 currentDispatch 로 주입, 청소형(SEQUENTIAL/ROUND)은 다음 고객 좌표까지 병합 ※ loadDashboardMapState 내부에서 map-state 응답에 덧붙임. next-customer 는 청소형 시뮬 핀별 개별 호출, 404 는 null 처리 | `GET /bikes` · `GET /dispatch-orders/active` · `GET /bikes/{id}/next-customer` | |
| 라이더 목록 | loadRiderList() — page 0 / size 100, 실패 시 빈 배열 + notice | `GET /riders` | |
| 차량 목록 | loadVehicleList() — page 0 / size 100, 실패 시 빈 배열 + notice | `GET /bikes` | |
| 충전소 목록 | loadStationList() — page 0 / size 100, 실패 시 빈 배열 + notice | `GET /battery-stations` | |
| 라이더-차량 매칭 스냅샷 | loadRiderMatchingSnapshot() — 활성 계약(terminatedAt null + endAt 미경과) 집계로 매칭 맵·교육 유형·보험 가입 set·계약 요약을 생성 (각 size 200) | `GET /rider-bike-contracts` · `GET /rider-insurances` · `GET /rider-education-records` · `GET /contract-templates` | |
| 계약·보험 부수 데이터 | page.tsx 내 loadContractsAndInsurances() — 계약/보험/양식/보험상품 목록을 별도로 다시 로드 (각 size 200, enabled=false 양식·상품 제외) ※ 매칭 스냅샷 로더와 같은 엔드포인트 3개를 같은 렌더에서 중복 호출 | `GET /rider-bike-contracts` · `GET /rider-insurances` · `GET /contract-templates` · `GET /insurance-items` | |
| 정비 데이터셋 | loadMaintenanceDataset() — 정비 품목 catalog(size 200) + 전체 정비 이력(size 500)을 받아 차량별 임박/지연 요약을 derive | `GET /maintenance-items` · `GET /maintenance-records` | |
| 로드 실패 안내문(notice) | 세션 없음/조회 실패 시 지도 위에 role=status 문구 표시 ("서비스 API 세션 쿠키가 없어 빈 지도를 표시합니다" 등) | — | |
| 미로그인 가드 | serviceOpsSessionReady() false 면 /login 으로 redirect (미들웨어와 이중 방어) | — | |

### 지도 캔버스·마커

| UI 요소 | 동작 | 백엔드 | 판정 |
|---|---|---|---|
| 지도 캔버스 | MapLibre GL + OpenFreeMap(OSM 벡터 타일). 라이트·다크 테마 전환(thundercrew-theme-change 이벤트) 시 캔버스째 재생성, 배경 타일 10초 내 실패해도 DOM 마커는 계속 그려짐 ※ 타일은 외부 OpenFreeMap — 자사 백엔드 호출 없음 | — | |
| 차량 마커 | 스쿠터(2륜)/박스트럭(FOUR_WHEEL) line-art 아이콘, 줌 ≥ 12 에서 번호판 pill 라벨, 선택 차량은 흰 테두리 + 색상 링 + 1.18배 확대, 클릭 시 포커스 모드 진입 | — | |
| 차량 상태 칩 | 모든 차량 마커 아래 공통 칩 — 점 색(ONLINE 초록/그 외 회색) + "연결\|미연결 · 시동 ON\|OFF\|—" (미연결이면 시동 —) | — | |
| 서비스 상태 배지 | 시뮬 대상 차량만(servicePhase != null). 배송형: MOVING=파랑 "배송 중"/그 외=회색 "대기". 청소형: MOVING=파랑 "이동 중"/WORKING=앰버 "작업 중"/IDLE=회색 "대기 중". 뒤에 "· N건" (배차 큐 잔여 우선, 없으면 시뮬 누적) | — | |
| 시동 켜짐 말풍선 | 청소형 차량이 시동 ON 된 뒤 4초 동안 "🔑 {고객명} 출발" 말풍선 표시 후 CSS 애니메이션으로 소멸 | — | |
| 충전소(BSS) 마커 | 배터리+번개 아이콘(노랑 톤), 줌 ≥ 12 에서 스테이션 이름 라벨. 클릭 동작 없음 — FullscreenMapHost 가 onStationSelect 를 넘기지 않는다 | — | |
| 팁 마커 | 보라색 location-pin 아이콘, 줌 ≥ 12 에서 주소 라벨, 클릭 → 하단 팁 패널 행과 양방향 하이라이트 연동 | — | |
| 배송지 마커(포커스 모드) | 차량 선택 시 해당 차량의 배차 주문 좌표를 깃발 핀으로 표시 — 진행 중=노랑+순번 배지, 완료=회색+체크. 좌표 0,0/없음 스킵 ※ useFocusDispatchOrders 가 server action(listDispatchOrdersAction/listCompletedDispatchOrdersAction) 경유로 선택 시 1회 조회. 시뮬 차량은 주문이 없으면 핀의 currentDispatch 좌표 1건을 합성 | `GET /dispatch-orders` · `GET /dispatch-orders/completed` | |
| 경로선(trail) | 선택 차량의 이동 경로를 파랑 실선(GeoJSON line, width 4)으로 표시 — 시뮬 차량은 OSRM 경로의 진행분 슬라이스, 실차는 recentTrack polyline (2점 미만이면 미표시) | — | |
| 첫 로드 fitBounds | 지도 첫 표시 시 차량+충전소 전체 마커가 한 화면에 들어오게 1회 fit (핀 1개면 중심 이동만). 이후 폴링 갱신에도 재중심하지 않음 | — | |
| 포커스 fitBounds | 차량 선택 시 선택 차량 + 모든 배송지를 담는 1회성 fit. trigger 변경 시에만 발화하고 배송지가 늦게 로드되면(empty→non-empty) 한 번 더 fit | — | |
| 검색 결과 팬/줌 | 검색 결과 선택 시 해당 좌표로 setCenter (one-shot, 같은 항목 재선택도 재발화) | — | |
| 로딩 오버레이·배경 경고 | 첫 fit 완료까지 "지도 불러오는 중…" 오버레이(최대 1.5초 fallback), 배경 타일 실패 시 "배경 지도를 불러오지 못했습니다. 마커 위치는 정상입니다." 배너 | — | |

### 필터·검색

| UI 요소 | 동작 | 백엔드 | 판정 |
|---|---|---|---|
| 서비스 유형 탭 | 차량 마커를 serviceType 으로 필터 — 전체(ALL) / 콜 배차(CALL) / 단일 배차(SINGLE) / 순차 배차(SEQUENTIAL) / 왕복 배차(ROUND) / 기타(OTHER). serviceType 없는 차량은 SINGLE 로 취급 ※ 하단 차량 패널 표에도 동일 필터 결과(visibleVehicles)가 전달됨 | — | |
| 지도 통합 검색 | 차량(번호판 부분일치)·충전소(이름/주소 부분일치) 검색, 최대 8건(차량 우선 정렬), 선택 시 해당 좌표 팬 + 차량이면 포커스 모드 진입. 라이더는 검색 대상 아님 | — | |
| 충전소 필터(하단 패널 충전소 탭) | 주소 검색 input + 잔여 상태 select: 전체(ALL) / 정상(OK) / 재고 부족 ≤ 30%(LOW). LOW 기준 = 가용/최대 ≤ 0.3 (LOW_STOCK_RATIO) ※ StationFilterControls 는 BottomMapPanel 충전소 탭의 StationsPanel(layout=horizontal) 안에서 렌더됨 | — | |
| 차량 필터 컨트롤(렌더 미도달) | 검색(차량번호·모델명·IMEI) + select 5개 — 구분: 전체/전기(ELECTRIC)/내연(ICE), 운영 상태: 전체/운행(IN_SERVICE)/대기(READY), 연결 상태: 전체/온라인(ONLINE)/오프라인·신호끊김(ANY_OFFLINE), 시동: 전체/ON/OFF, 정비 상태: 전체/임박+지연(ANY)/임박만(DUE_SOON)/지연만(OVERDUE) ※ VehicleFilterControls.tsx 는 현재 어떤 파일에서도 import 되지 않음 — 화면에 나타나지 않는다 | — | |
| 라이더 필터 컨트롤(렌더 미도달) | 검색(이름·연락처·차량번호) + select 5개 — 교육: 전체/온라인/오프라인/미수료(NONE), 차량 배정: 전체/배정됨(ASSIGNED)/미배정(UNASSIGNED), 구독/렌탈: 전체/구독(SUBSCRIPTION)/렌탈(RENTAL)/커스텀(CUSTOM), 보험: 전체/가입(HAS)/미가입(NONE), 시동 상태: 전체/ON/OFF/차량 미배정(UNASSIGNED) ※ RiderFilterControls 는 RidersPanel 만 import 하는데 RidersPanel 자체가 어디서도 렌더되지 않음 | — | |

### 폴링·시뮬레이션

| UI 요소 | 동작 | 백엔드 | 판정 |
|---|---|---|---|
| 차량 핀 폴링 | 30초 고정 주기로 최신 bikePins(recentTrack 포함) 갱신. 탭이 백그라운드(document.hidden)면 skip, 실패 시 직전 스냅샷 유지 ※ Next 라우트 /api/dashboard/map-state 경유 — 서버가 loadDashboardMapState()(시뮬 핀 합성 포함)를 매 폴링마다 재실행 | `GET /dashboard/map-state` · `GET /bikes` · `GET /dispatch-orders/active` · `GET /bikes/{id}/next-customer` | |
| 실차 위치 재생(playback) | 폴링으로 받은 recentTrack 을 bikeId 별 버퍼에 누적하고 250ms tick 마다 (now − lag) 시점의 보간 좌표로 실차 마커를 부드럽게 이동. 트랙 2점 미만 핀은 그대로 통과 | — | |
| 시뮬 상태 overlay | 시뮬 중인 차량 핀의 좌표·속도·배터리·시동·연결(ONLINE 고정)·주행 상태·서비스 배지·배송 건수를 시뮬레이션 값으로 덮어씀 | — | |
| 시뮬레이션 자동 시작/중단 | 대상 조건 = IMEI 가 "-" 로 시작하는 차량(예: -1) ∩ 활성 라이더-차량 매칭. 교집합 변경 시 자동 추가/제거. 배송형은 즉시 MOVING(0~5분 랜덤 오프셋으로 사이클 분산), 청소형은 현재 배차 좌표 있으면 MOVING 없으면 IDLE 대기. IMEI 빈 실차는 매칭돼도 시뮬 안 함 | — | |
| 시뮬 tick | 250ms interval 로 상태 전이(advanceBikeState). 청소형은 현재 배차 키(좌표+고객명)로 재출발 가드 — 같은 건으론 다시 출발하지 않고, 운영자 완료로 다음 건이 현재 배차가 되면 키가 바뀌어 재출발. 매칭 해제 + 대기 상태면 entry 정리 | — | |
| OSRM 경로 조회 | MOVING 인데 경로가 없으면 origin→destination 도로 경로를 fetch 해 waypoints 주입, 실패(5초 timeout 포함) 시 직선 보간 fallback ※ 외부 OSRM public demo(router.project-osrm.org) 를 브라우저에서 직접 호출 — 자사 백엔드 아님 | — | |
| 재점화(시동 ON) 알림 기록 | 청소형 시뮬 차량이 WORKING→MOVING 전환(시동 ON)될 때 알림 벨에 표시(번호판·고객명·주소·시각)하고 백엔드에 기록. ignitionOnAt 기준 중복 방지, 기록 실패는 무시 ※ server action recordReignitionNotificationAction(app/dispatch/actions.ts) 경유 | `POST /reignition-notifications` | |

### 포커스 모드 — 배송 리스트 (DeliveryFocusPanel / use-focus-dispatch-orders)

| UI 요소 | 동작 | 백엔드 | 판정 |
|---|---|---|---|
| 포커스 진입 시 배차 조회 | 선택 차량의 진행 중(ASSIGNED, sequence 정렬) + 완료(COMPLETED) 배차 주문 조회 — 미인증/실패 시 빈 배열 ※ 둘 다 bikeId 쿼리. server action(listDispatchOrdersAction/listCompletedDispatchOrdersAction) 경유 | `GET /dispatch-orders` · `GET /dispatch-orders/completed` | |
| 배송지 핀 (깃발 마커) | 조회한 주문 좌표를 지도에 표시 — 진행 중은 노랑 + 순번 배지, 완료는 회색 + 체크. 실 주문 없는 시뮬 차량은 현재 배차 1건 합성 | — | |
| 진행 중 / 완료 내역 행 클릭 | 해당 배송지 좌표로 지도 one-shot 팬 (좌표 없는 행은 disabled). 순차배차 차량이면 순번 + 현재/대기 라벨 표기 | — | |
| 완료 내역 접기/펼치기 | 완료 섹션 토글, 건수와 완료 시각 표시 | — | |
| × (닫기) | 포커스 해제 — 전체 차량 핀 복원, 차량 상세 패널도 닫힘 | — | |

### 차량 상세 floating 패널 (VehicleDetailDialog)

| UI 요소 | 동작 | 백엔드 | 판정 |
|---|---|---|---|
| 패널 열림 시 단말기 정보 조회 | 현재 부착 단말기(deviceUid) + 활성 installation id lazy fetch ※ Next 라우트 /api/overview/vehicle-device/{bikeId} 경유 | `GET /bike-device-installations` · `GET /devices/{id}` | |
| 패널 열림 시 정비+텔레메트리 번들 조회 (15초 폴링) | 차량별 정비 카탈로그 + 정비 이력 + 현재 텔레메트리를 한 번에 조회, 패널이 열려있는 동안 15초마다 갱신 (숨김 탭 스킵) ※ Next 라우트 /api/overview/vehicle-maintenance/{bikeId} 경유. current-state 404 시 클라이언트 더미 텔레메트리 폴백 | `GET /bikes/{id}/maintenance-items` · `GET /bikes/{id}/maintenance-records` · `GET /telemetry/bikes/{id}/current-state` | |
| 텔레메트리 섹션 | 마지막 수신 시각(절대 + 상대시간) 표시 — 번들 데이터 재사용, 별도 호출 없음 | — | |
| 운영 상태 인라인 select (view 모드) | 대기(READY)/운행(IN_SERVICE) 즉시 변경 (reason: OPERATOR_INLINE_EDIT), 실패 시 이전 값 롤백 + alert, 성공 시 감사 로그 fire-and-forget | `PATCH /bikes/{id}/operation-status` · `POST /audit-logs` | |
| 정비 상태 목록 | 품목별 상태 뱃지(정상/임박/지연/기록 없음/오프라인) + 주기 + 마지막 교환 표시 — 번들에서 클라이언트 derive | — | |
| 교환 완료 버튼 (정비 품목별) | confirm 후 정비 record 1건 추가 (현재 텔레메트리 odometer 를 baseline 으로 기록), 성공 시 감사 로그 + 번들 재조회 | `POST /bikes/{id}/maintenance-records` · `POST /audit-logs` | |
| 보험 섹션 (기본 보험 / 추가 보험 입력) | 배정 라이더의 보험 자유 텍스트 2칸 — blur 시 자동 저장 + 값 변경 시 감사 로그. 라이더 미배정이면 편집 불가 | `PATCH /riders/{id}` · `POST /audit-logs` | |
| 수정 폼 저장 (edit 모드) | 차량번호/용도/구분/모델명/운영 상태/IMEI/단말기 ID/단말기 연동(deviceUid) 을 한 번의 저장으로 — 기본정보 PATCH, 상태 변경 시 별도 endpoint, deviceUid 변경 시 해제 또는 device 조회·생성 후 부착 ※ operation-status 는 상태가 바뀐 경우만, 단말 호출들은 deviceUid diff 에 따라 분기. deviceUid '-1' 은 차량별 고유 시뮬 device 생성 | `PATCH /bikes/{id}` · `PATCH /bikes/{id}/operation-status` · `POST /bike-device-installations/{id}/remove` · `GET /devices` · `POST /devices` · `POST /bike-device-installations` | |
| 닫기 (× / ESC / 닫기 버튼) | 패널 닫기 = 차량 선택 해제(포커스 해제) | — | |
| 시동 차단 컨트롤 | 이 화면의 차량 상세 패널에는 없음 — IgnitionControlButton 은 비렌더 RidersPanel 안에만, setVehicleIgnitionBlock 계열 액션은 비렌더 BikeDetailPanel 만 호출 | — | |

### 하단 패널 — 탭 바 + 차량 탭 (BottomMapPanel / VehiclesPanel)

| UI 요소 | 동작 | 백엔드 | 판정 |
|---|---|---|---|
| 탭 바 (차량 / 충전소 / 팁) | 탭 클릭으로 30vh 패널 펼침, 활성 탭 재클릭 또는 ▼ 버튼으로 접힘. 포커스 진입 시 자동으로 접힘 | — | |
| 차량 표 (11컬럼) | 읽기 전용 — 차량번호/구분(전기·내연·LPG)/운영 상태(대기·운행)/IMEI/이름/연락처/교육(온라인·오프라인)/구독·렌탈(구독·렌탈·커스텀)/형태(인수형·반납형)/기간/보험(기본 보험 상품명 뱃지). 지도 헤더 서비스유형 필터가 유일한 필터 소스, 패널 자체 필터 없음 ※ 라이더 측 컬럼은 SSR 에서 받은 매칭·계약·보험 map lookup — 표 자체는 백엔드 호출 없음 | — | |
| 차량 행 클릭 | 해당 차량 포커스 진입 + 차량 상세 floating 패널 열림 + 하단 패널 접힘 | — | |

### 하단 패널 — 충전소 탭 (StationsPanel / StationDetailDialog / DeleteStationButton)

| UI 요소 | 동작 | 백엔드 | 판정 |
|---|---|---|---|
| 주소 검색 인풋 | 주소 substring 클라이언트 필터 | — | |
| 잔여 상태 select | 재고 상태 필터. 옵션: 잔여 상태 전체(ALL)/정상(OK)/재고 부족 ≤30%(LOW) — available/max 비율 판정 | — | |
| 스테이션 표 (삭제 / 주소 / 잔여·총) | 읽기 전용 표 + 표시 건수(visible/total) | — | |
| 삭제 버튼 (휴지통 아이콘) | confirm 후 스테이션 soft-delete | `DELETE /battery-stations/{id}` | |
| 행 클릭 → 스테이션 상세 다이얼로그 | 주소/잔여·총 view 표시, '수정' 으로 edit 전환 | — | |
| 스테이션 수정 저장 | 주소(다음 우편번호 팝업으로만 변경, name 도 동기화, geocode 성공 시 좌표 갱신) + 잔여·총 변경 시 별도 counts 호출 (reason: OPERATOR_EDIT) ※ battery-counts 는 잔여·총이 실제로 바뀐 경우만. 주소 geocode 는 외부 서비스 | `PATCH /battery-stations/{id}` · `PATCH /battery-stations/{id}/battery-counts` | |
| 스테이션 등록 | 이 화면에 등록 UI 없음 — CreateStationDialog 는 어디에서도 렌더되지 않음 (createStationFromOverviewAction 은 존재하나 미사용) | — | |

### 하단 패널 — 팁 탭 (TipsPanel / CreateTipDialog / EditTipDialog)

| UI 요소 | 동작 | 백엔드 | 판정 |
|---|---|---|---|
| 팁 목록 로드 | 탭 콘텐츠 mount 시 + 생성/편집/발행/삭제 후 재조회 (미인증 시 빈 배열). 컬럼: 주소/내용/상태(대기·발행)/등록일/액션 | `GET /tips` | |
| 팁 행 클릭 | 선택 토글 — 지도 보라 핀 클릭과 하이라이트 양방향 연동 | — | |
| + 팁 추가 버튼 → 팁 추가 다이얼로그 | 주소/내용 입력 + MapLibre 미니맵 클릭으로 lat/lng 핀 지정 후 저장. 실패 시 백엔드 검증 메시지 배너 | `POST /tips` | |
| 편집 버튼 → 팁 편집 다이얼로그 | 기존 값 사전 입력 + 초기 핀 표시, 클릭으로 핀 이동 후 저장 | `PUT /tips/{id}` | |
| 발행 버튼 (대기 상태 행만) | PENDING 팁을 발행 상태로 전환 후 목록 재조회 | `POST /tips/{id}/publish` | |
| 삭제 버튼 (휴지통 아이콘) | confirm 후 팁 삭제, 선택 중이던 팁이면 선택 해제 | `DELETE /tips/{id}` | |
| 미니맵 (use-tip-mini-map) | 다이얼로그 내 MapLibre 지도 — 클릭으로 단일 핀 재배치, 좌표 표시. 백엔드 호출 없음 (외부 타일) | — | |

### 알림 벨 (NotificationBell / NotificationProvider)

| UI 요소 | 동작 | 백엔드 | 판정 |
|---|---|---|---|
| 알림 초기 로드 | 앱 로드 시 재시동(re-ignition) 알림 + 서버 generic 알림(정비 알람·팁 제출 등)을 각 1회 조회해 벨 초기화 | `GET /reignition-notifications` · `GET /notifications` | |
| 🔔 벨 버튼 | 알림 센터 패널 토글 — 열 때 로컬 읽음 처리(배지 카운트 리셋), 타입별 그룹(정비 알람/시동 알림/기타) 표시 | — | |
| 확인 버튼 (미확인 알림 항목) | REIGNITION 외 미확인 항목의 확인 처리 — optimistic 로컬 갱신 + fire-and-forget 서버 확인 | `POST /notifications/{id}/acknowledge` | |
| 발행 버튼 (팁 제출 알림 항목) | TIP_SUBMISSION 알림에서 해당 팁 즉시 발행 후 알림 확인 처리 + 패널 닫기 | `POST /tips/{id}/publish` · `POST /notifications/{id}/acknowledge` | |
| 시뮬 출발 알림 표시 | FleetSimulationContext 가 CLEANING 시뮬 차량 출발 시 addNotification 으로 벨 목록에 추가 (서버 기록은 지도 섹션의 reignition-notifications 행 참조) | — | |

### 이 화면에서 불가능한 동작 (확인 결과)

| UI 요소 | 동작 | 백엔드 | 판정 |
|---|---|---|---|
| 라이더 생성 / 삭제 | 불가 — CreateRiderDialog 는 어느 파일에도 import 되지 않고, DeleteRiderButton 은 렌더되지 않는 RidersPanel 내부에만 존재 | — | |
| 계약 매칭 / 계약 해지 | 불가 — ContractMatchingForm 은 RIDER_DRAG_TYPE 상수만 import 될 뿐 렌더 안 됨, TerminateContractButton 은 비렌더 RiderDetailDialog 내부에만 존재. 계약 데이터는 차량 표 lookup 컬럼으로 조회만 가능 | — | |
| 시동 차단 토글 | 불가 — IgnitionControlButton(비렌더 RidersPanel), BikeDetailPanel(비렌더 DashboardCanvas 전용) 어느 쪽도 이 화면 렌더 트리에 없음 | — | |

---

## 3. 자원 관리 `/management/resources`

### 페이지 공통 (/management/resources)

| UI 요소 | 동작 | 백엔드 | 판정 |
|---|---|---|---|
| 섹션 이동 내비 | sticky 앵커 링크로 차량·라이더·매칭·작업 로그 섹션으로 점프 (#mgmt-vehicles 등) ※ ManagementSectionNav — 순수 화면 동작 | — | |

### 단말 데이터 수신 (TelemetryReceiveControl)

| UI 요소 | 동작 | 백엔드 | 판정 |
|---|---|---|---|
| 수신 상태 배지 (수신 중 / 중지됨) | 페이지 최초 렌더 시 서버 컴포넌트가 getTelemetryReceiveStatusAction 으로 OTOPLUG observer 활성 여부를 조회해 초기 상태로 내려줌 ※ 조회 실패 시 null → 중지됨으로 표시 | `GET /otoplug/observers` | |
| 단말 데이터 수신 시작 버튼 | OTOPLUG NT observer(driving·drivingDetail)를 등록해 단말 텔레메트리 유입을 시작 (이미 수신 중이면 비활성) | `POST /otoplug/observers/register` | |
| 수신 중지 버튼 | confirm("단말 데이터 수신을 중지할까요?") 후 observer 해제로 텔레메트리 유입 중단 | `POST /otoplug/observers/ignore` | |

### 차량 (VehiclesManagementPanel)

| UI 요소 | 동작 | 백엔드 | 판정 |
|---|---|---|---|
| 차량 표 | 컬럼: 관리(삭제 아이콘)·차량번호·용도·구분·엔진·IMEI·단말기 ID. 최초 렌더 시 목록 조회(page=0, size=200), 헤더에 건수 표시 ※ 등록 다이얼로그·상세/수정 UI 없음 — 신규 등록/수정은 엑셀 업로드로만 가능. CreateVehicleDialog·VehicleDetailDialog 는 이 페이지 렌더 트리에서 import 되지 않음 | `GET /bikes` | |
| 용도 컬럼 | 값 매핑: DELIVERY→배송용, CLEANING→클린차량, 그 외 원문, 없으면 — | — | |
| 구분 컬럼 | 값 매핑: TWO_WHEEL→2륜, 그 외(FOUR_WHEEL)→4륜, 없으면 — | — | |
| 엔진 컬럼 | 값 매핑: ELECTRIC→전기, ICE→내연, LPG→LPG (3갈래), 그 외 원문, 없으면 — | — | |
| 차량 삭제 버튼 (휴지통 아이콘) | confirm 후 해당 차량의 활성 단말 장착(removedAt===null)을 전부 조회·해제한 뒤 차량 삭제, 성공 시 목록 새로고침 ※ 해제 시 removedAt=현재시각, memo="차량 삭제 전 자동 해제". 409/400 이면 "활성 매칭/참조가 있어 삭제할 수 없습니다" 표시 | `GET /bike-device-installations` · `PATCH /bike-device-installations/{id}/remove` · `DELETE /bikes/{id}` | |
| 내려받기 버튼 | 새 탭에서 vehicles.xlsx 다운로드 ※ Next 라우트 /api/management/vehicles/export 경유 (세션 토큰 첨부 프록시) | `GET /bikes/export` | |
| 업로드 버튼 (엑셀) | .xlsx 파일 선택 즉시 미리보기 요청 → 미리보기 모달에서 저장 클릭 시 적용, 성공 시 목록 새로고침 ※ ExcelImportButton + BulkPreviewModal 공용 흐름 (아래 엑셀 업로드 공통 섹션 참고) | `POST /bikes/bulk-preview` · `POST /bikes/bulk-apply` | |

### 라이더 (RidersManagementPanel)

| UI 요소 | 동작 | 백엔드 | 판정 |
|---|---|---|---|
| 라이더 표 | 컬럼: 관리(삭제 아이콘)·이름·직무·연락처·교육이수·팀. 최초 렌더 시 목록 조회(page=0, size=200), 헤더에 건수 표시 ※ 등록 다이얼로그·상세/수정 UI 없음 — 신규 등록/수정은 엑셀 업로드로만. 교육기록 동시 생성 UI 도 이 페이지에는 없음 (CreateRiderDialog·RiderDetailDialog 미사용). riders/actions.ts 의 resetRiderCredentialAction(PATCH /api/v1/riders/{id}/credential)은 정의만 있고 이 페이지 UI 에서 호출되지 않음 | `GET /riders` | |
| 직무 컬럼 | 값 매핑: RIDER→라이더, CLEANER→클리너, 그 외 원문, 없으면 — | — | |
| 교육이수 컬럼 | 값 매핑: ONLINE→온라인(초록 배지), OFFLINE→오프라인(회색), INCOMPLETE→미완료(주황), 없으면 — | — | |
| 라이더 삭제 버튼 (휴지통 아이콘) | confirm 후 라이더 삭제, 성공 시 목록 새로고침 ※ 409/400 이면 "활성 매칭/참조가 있어 삭제할 수 없습니다" 표시. 차량 삭제와 달리 사전 해제 호출 없음 | `DELETE /riders/{id}` | |
| 내려받기 버튼 | 새 탭에서 riders.xlsx 다운로드 ※ Next 라우트 /api/management/riders/export 경유 | `GET /riders/export` | |
| 업로드 버튼 (엑셀) | .xlsx 선택 즉시 미리보기 → 모달에서 저장 시 적용, 성공 시 목록 새로고침 | `POST /riders/bulk-preview` · `POST /riders/bulk-apply` | |

### 매칭 (MatchingManagementPanel)

| UI 요소 | 동작 | 백엔드 | 판정 |
|---|---|---|---|
| 매칭 표 | 컬럼: 관리(종료 버튼)·차량번호·서비스 유형·라이더 이름·연락처·계약형태·인수방식·시작일·종료일·상태. 최초 렌더 시 계약 목록 조회(page=0, size=200) 후 terminatedAt 있는 계약은 클라이언트에서 숨김(활성만 표시, 건수도 활성 기준) ※ 계약 생성 폼 없음 — 신규 계약은 엑셀 업로드로만. ContractMatchingForm 은 이 페이지 렌더 트리에서 import 되지 않음. 종료 포함 전체 이력은 매칭로그 다운로드로 제공 | `GET /rider-bike-contracts` | |
| 서비스 유형 컬럼 | 값 매핑: CALL→콜 배차, SINGLE→단일 배차, SEQUENTIAL→순차 배차, ROUND→왕복 배차, OTHER→기타, 없으면 — | — | |
| 계약형태 컬럼 | 값 매핑: SUBSCRIPTION→구독, RENTAL→렌탈, CUSTOM→기타, 없으면 — | — | |
| 인수방식 컬럼 | 값 매핑: TAKEOVER→인수형, RETURN→반납형, 없으면 — | — | |
| 상태 컬럼 | terminatedAt 있으면 종료(회색 배지), 없으면 진행 중(초록 배지) — 종료 계약은 표에서 숨겨지므로 실제로는 항상 진행 중 | — | |
| 종료 버튼 | confirm("계약을 종료하시겠습니까?") 후 terminatedAt=현재시각, terminatedReason="OPERATOR_TERMINATE" 로 계약 종료, 성공 시 목록 새로고침 ※ 409/400 이면 "이미 종료되었거나 종료할 수 없는 계약입니다" 표시 | `PATCH /rider-bike-contracts/{id}/terminate` | |
| 내려받기 버튼 | 새 탭에서 matching.xlsx 다운로드 — 활성 계약 (재업로드용 템플릿) ※ Next 라우트 /api/management/matching/export 경유 | `GET /contracts/export` | |
| 매칭로그 버튼 | 새 탭에서 matching-log.xlsx 다운로드 — 종료된 계약까지 포함한 전체 이력(상태·종료시각 컬럼 포함), 읽기 전용 로그 ※ Next 라우트 /api/management/matching/log-export 경유 | `GET /contracts/log-export` | |
| 업로드 버튼 (엑셀) | .xlsx 선택 즉시 미리보기 → 모달에서 저장 시 적용, 성공 시 목록 새로고침 | `POST /contracts/bulk-preview` · `POST /contracts/bulk-apply` | |

### 엑셀 업로드 공통 (ExcelImportButton + BulkPreviewModal)

| UI 요소 | 동작 | 백엔드 | 판정 |
|---|---|---|---|
| 파일 선택 input (숨김) | accept=.xlsx, 선택 즉시 해당 패널의 preview 액션 호출, 같은 파일 재선택 가능하도록 값 초기화 ※ 실제 엔드포인트는 각 패널 행에 기재 | — | |
| 업로드 미리보기 모달 | 요약 카운트(변경 없음·업데이트·신규·오류·합계)와 행 표(행·상태·키·변경사항·오류) 표시, UNCHANGED 행은 목록에서 숨기고 요약으로만 표시. 상태 라벨: UNCHANGED→변경 없음, UPDATE→업데이트, NEW→신규, ERROR→오류 | — | |
| 미리보기 모달 저장 버튼 | 선택했던 파일을 그대로 각 패널의 apply 액션에 전달해 적용 (실제 엔드포인트는 패널별 bulk-apply) | — | |
| 미리보기 모달 취소 버튼 | 모달 닫기, 선택 파일·오류 상태 초기화 — 백엔드 반영 없음 | — | |

### 작업 로그 (AuditLogManagementPanel)

| UI 요소 | 동작 | 백엔드 | 판정 |
|---|---|---|---|
| 필터 칩 | 칩 값: 전체(필터 없음)·차량(BIKE)·라이더(RIDER)·매칭(CONTRACT)·배차(DISPATCH_ORDER)·운영상태(BIKE_OPERATION_STATUS)·정비(MAINTENANCE)·보험(RIDER_INSURANCE) — 클릭 시 해당 entityType 으로 재조회(limit=200), 선택 칩은 primary 스타일 | `GET /audit-logs` | |
| 작업 로그 표 | 컬럼: 발생시각(ko-KR locale)·작업자·대상·항목·변경(구값 → 신값). 최초 렌더 시 전체 로그 조회(limit=200), 헤더에 건수 표시 ※ 항목 특수값 매핑: __created__→생성, __updated__→수정, __deleted__→삭제, __terminated__→종료. 대상 라벨은 필터 칩과 동일 매핑 | `GET /audit-logs` | |

---

## 4. 업무 관리 `/management/operations`

### 페이지 공통 (/management/operations, page.tsx)

| UI 요소 | 동작 | 백엔드 | 판정 |
|---|---|---|---|
| 서버 렌더 프리로드 | 페이지 진입 시 활성 라운드·수락 대기 콜·차량 목록(page=0,size=200)·활성 배차를 병렬 로드해 각 패널에 내려준다 (force-dynamic) ※ 차량 목록은 미인증 시 /login 으로 redirect. 활성 라운드는 204 응답이면 null(진행 라운드 없음) | `GET /dispatch-batches/active` · `GET /dispatch-orders/calls/offered` · `GET /bikes` · `GET /dispatch-orders/active` | |
| 후보 차량 필터(서버 계산) | 콜 배차 배송 차량 후보 = serviceType이 CALL 또는 SINGLE (OTHER·청소형 제외). 모니터 편집 다이얼로그의 재배정 후보 = CALL, SINGLE, SEQUENTIAL. 모니터 차량번호 매핑(plateById)은 전 차종 ※ page.tsx 31-48행. 시스템 자동 배차 후보와 동일 조합이라는 주석 있음 | — | |
| 섹션 이동 내비 (콜 배차·단일 배차·순차 배차·왕복 배차) | 상단 sticky 앵커 링크로 페이지 내 섹션 점프 | — | |

### 콜 배차 (BaeminCallPanel)

| UI 요소 | 동작 | 백엔드 | 판정 |
|---|---|---|---|
| 콜 등록 폼 (고객명·연락처·배달지) | 고객명·연락처는 직접 입력, 배달지 입력칸은 readOnly — 주소 검색으로만 채워진다. 셋 다 필수 | — | |
| 주소 검색 버튼 | 다음(Kakao) 우편번호 팝업(postcode.v2.js lazy-load)을 띄워 선택한 주소 문자열을 배달지 칸에 채운다. 좌표는 이 단계에서 안 나온다 ※ 외부 스크립트 t1.daumcdn.net — 자사 백엔드 호출 아님 | — | |
| 배차 방식 라디오 | select 아닌 radio 2택: system(시스템 자동 배차, 기본값) / offer(라이더 수락) | — | |
| 콜 등록 버튼 | 서버 액션이 NCP 지오코딩으로 주소→좌표 변환 후, 방식에 따라 시스템 자동 배차 콜 또는 라이더 수락 대기 콜을 생성. 성공 시 폼 초기화 + 수락 대기 목록 재조회 ※ system 모드면 calls/system, offer 모드면 calls/offer 중 하나만 호출. 지오코딩 실패 시 백엔드 호출 없이 오류 표시. 지오코딩은 NCP 외부 API(서버 전용 모듈) | `POST /dispatch-orders/calls/system` · `POST /dispatch-orders/calls/offer` · `GET /dispatch-orders/calls/offered` | |
| 수락 대기 중인 콜 목록 | OFFERED 상태 콜을 카드(고객명·연락처·주소)로 표시. SSR 초기값에서 시작, 등록/수락 후 재조회로 갱신 ※ 목록 재조회 자체는 콜 등록·수락 행의 GET calls/offered 로 수행 | — | |
| 배송 차량 select (콜 카드별) | 수락 시 배정할 차량 선택. 옵션 = CALL∪SINGLE serviceType 차량의 차량번호, 기본 선택 = 첫 차량. 차량이 없으면 '배송 차량 없음' 표시 + 수락 비활성 | — | |
| 수락 버튼 (콜 카드별) | 선택 차량으로 해당 OFFERED 콜을 수락(배정)하고 대기 목록 재조회. 실패 시 카드별 오류 표시 ※ body 는 { bikeId } | `POST /dispatch-orders/calls/{id}/accept` · `GET /dispatch-orders/calls/offered` | |

### 단일 배차 (DispatchPanel + DispatchMonitorTable + DispatchOrderEditDialog)

| UI 요소 | 동작 | 백엔드 | 판정 |
|---|---|---|---|
| 배차 모니터 표 | 활성(ASSIGNED)+당일 완료(COMPLETED) 배차를 차량별로 표시(단일·순차 통합 풀). 정렬: 차량번호→상태(ASSIGNED 먼저)→순번. 완료 행은 opacity 0.5, 작업 버튼 없음. 마운트 시 1회 + 15초 폴링으로 재조회 ※ 모니터 재조회는 includeCompleted=true 쿼리 포함(당일 완료 포함). SSR 초기값은 쿼리 없는 동일 경로(ASSIGNED만) | `GET /dispatch-orders/active` | |
| 새로고침 버튼 | 모니터 재조회를 수동 트리거 (15초 폴링과 동일 호출) ※ includeCompleted=true 쿼리 포함 | `GET /dispatch-orders/active` | |
| 수정 버튼 (행별, ASSIGNED만) | 배차 주문 수정 다이얼로그를 연다 | — | |
| 배차 주문 수정 다이얼로그 — 저장 | 고객명·연락처·배송지주소는 항상 수정 가능. 배정 차량 select(옵션=CALL∪SINGLE∪SEQUENTIAL 차량)와 순번은 batchId 가 있는 왕복(라운드) 소속 주문이면 disabled(배치 불변식). 저장 시 서버 액션이 주소를 NCP 지오코딩해 좌표 포함 PATCH ※ 순번 빈 값이면 null 전송. 지오코딩 실패 시 백엔드 호출 없이 오류. 저장 성공 시 모니터 재조회 트리거 | `PATCH /dispatch-orders/{id}` | |
| 취소 버튼 (행별, ASSIGNED만) | window.confirm 확인 후 배차 주문 삭제(취소), 성공 시 모니터 재조회 | `DELETE /dispatch-orders/{id}` | |
| 내려받기 버튼 | 배차 주문 xlsx(dispatch-orders.xlsx)를 새 탭으로 내려받기 ※ Next 라우트 /api/management/dispatch/export 경유 — 서버 라우트가 세션 Bearer 토큰을 붙여 프록시 | `GET /dispatch-orders/export` | |
| 업로드 버튼 | xlsx 선택 → 백엔드 파싱·차량번호 검증 → 서버 액션이 NEW 행 주소(및 출발지 주소)를 NCP 지오코딩, 실패 행은 ERROR 로 강등 → 미리보기 모달 표시 ※ 지오코딩 강등 반영해 summary(신규/오류/합계) 재집계 | `POST /dispatch-orders/bulk-preview` | |
| 미리보기 모달 — N건 적용 버튼 | NEW 이면서 bikeId·좌표가 있는 행만 좌표 포함 JSON 으로 적용(ERROR 행 제외). 성공 시 '배차 N건 적용 완료' 표시 + 모니터 재조회. NEW 0건이면 비활성 ※ 엑셀 재업로드가 아니라 rows JSON body. originAddress/origin 좌표도 함께 전송 | `POST /dispatch-orders/bulk-apply` | |
| 미리보기 모달 — 취소 버튼 | 적용 없이 미리보기를 닫는다 | — | |

### 순차 배차 (SequentialDispatchPanel)

| UI 요소 | 동작 | 백엔드 | 판정 |
|---|---|---|---|
| 내려받기 버튼 | 단일 배차와 동일한 배차 주문 xlsx 내려받기 (같은 exportUrl 공유) ※ Next 라우트 /api/management/dispatch/export 경유 | `GET /dispatch-orders/export` | |
| 업로드 버튼 | 순번(sequence) 컬럼이 포함된 xlsx 를 파싱·검증하고 NEW 행을 서버 액션에서 NCP 지오코딩(실패 시 ERROR 강등) 후 미리보기 모달 표시 | `POST /dispatch-orders/bulk-preview-sequential` | |
| 미리보기 모달 — N건 적용 버튼 | NEW+좌표 있는 행만 sequence 포함 JSON 으로 일괄 등록. 성공 시 '배차 N건 적용 완료' 표시 ※ 등록된 주문은 단일 배차 섹션의 통합 모니터에 표시된다 (이 패널 자체 표는 안내 문구뿐인 정적 표) | `POST /dispatch-orders/bulk-apply-sequential` | |
| 안내 표 | '업로드한 순차 배차는 단일 배차 현황판에 차량별로 함께 표시됩니다' 정적 안내만 표시 — 데이터 행 없음 | — | |

### 왕복 배차 (StrollerRoundPanel)

| UI 요소 | 동작 | 백엔드 | 판정 |
|---|---|---|---|
| 라운드 상태 배지·진행도 | 활성 라운드 상태를 배지(수거 중/배송 중/완료됨/진행 라운드 없음)로, DONE 이 아니면 '수거 n/m · 배송 n/m' 진행도를 표시. SSR 초기값 사용, 생성·배송 시작 후 재조회로 갱신 ※ 재조회 자체는 라운드 생성·배송 시작 행의 GET dispatch-batches/active 로 수행 | — | |
| 업로드 버튼 | 단일 배차와 동일한 bulk-preview 를 재사용해 xlsx 파싱 + NEW 행 NCP 지오코딩 후 미리보기 모달 표시. 진행 중(DONE 아님) 라운드가 있으면 비활성 ※ 순차 전용이 아닌 단일 배차용 previewDispatchAction 공유 | `POST /dispatch-orders/bulk-preview` | |
| 미리보기 모달 — N건 라운드 생성 버튼 | NEW+좌표 있는 행으로 왕복 배차 라운드(배치)를 생성하고 활성 라운드를 재조회. 성공 시 '왕복 배차 라운드가 생성되었습니다' 표시 ※ 단일 배차 적용과 달리 origin 주소·좌표는 전송하지 않음 | `POST /dispatch-batches/round` · `GET /dispatch-batches/active` | |
| 배송 시작 버튼 | 수거 완료된 COLLECTING 라운드(pickupDone === pickupTotal > 0)에서만 활성. 해당 배치의 배송 단계를 시작하고 라운드 재조회 | `POST /dispatch-batches/{id}/start-delivery` · `GET /dispatch-batches/active` | |

---

## 5. 정비 관리 `/management/maintenance`

### 정비 관리 — 페이지 로드 (/management/maintenance)

| UI 요소 | 동작 | 백엔드 | 판정 |
|---|---|---|---|
| 정비 카탈로그 초기 데이터 로드 | 서버 컴포넌트(page.tsx)가 loadMaintenanceDataset() 으로 정비 품목 목록(page=0, size=200)과 정비 이력 목록(page=0, size=500)을 한 번에 조회. API 미설정/미인증이면 빈 목록으로 렌더 ※ maintenance-records 응답은 이 화면에서 사용 안 함 — page.tsx 가 items 만 구조분해해서 MaintenancePanel 에 전달 (로더 lib/services/vehicle-maintenance-data.ts 를 차량 탭과 공유하는 구조) | `GET /maintenance-items` · `GET /maintenance-records` | |

### MaintenancePanel — 필터·표

| UI 요소 | 동작 | 백엔드 | 판정 |
|---|---|---|---|
| 휠 필터 칩 | 옵션: 전체(ALL) / 2륜(TWO_WHEEL) / 4륜(FOUR_WHEEL). 단일 선택, 클라이언트 측 필터링만 | — | |
| 엔진 필터 칩 | 옵션: 전체(ALL) / 전기(ELECTRIC) / 내연(ICE) / LPG(LPG). 단일 선택, 클라이언트 측 필터링만 | — | |
| 정비 품목 표 | 컬럼: 삭제(휴지통 아이콘) · 품목 · 휠 · 엔진 · 교환주기. 품목명 한국어 locale 정렬. 선택한 휠×엔진 교차곱과 항목의 categories 가 하나라도 겹치면 표시, 없으면 "해당 조건의 정비 항목 없음". 교환주기 셀은 cycleKm 우선("N km"), 없으면 cycleMonths("N개월"), 둘 다 없으면 — | — | |
| 행 클릭 | 해당 품목의 상세 다이얼로그(MaintenanceItemDetailDialog, view 모드) 열기 | — | |
| + 항목 추가 버튼 | 생성 다이얼로그(MaintenanceItemDetailDialog, create 모드) 열기 | — | |

### MaintenanceItemDetailDialog — 상세·생성·수정

| UI 요소 | 동작 | 백엔드 | 판정 |
|---|---|---|---|
| 상세 보기 (view 모드) | 품목 / 분류(휠×엔진 chip 목록) / 교환주기(km) / 교환주기(개월) / 알람 임계(%) 표시. "수정" 버튼으로 edit 모드 전환, "닫기"로 닫음 — 조회는 표에서 받은 데이터 재사용 | — | |
| 분류 토글 (생성·수정 폼 공통) | 휠 축: 2륜(TWO_WHEEL) / 4륜(FOUR_WHEEL), 엔진 축: 전기(ELECTRIC) / 내연(ICE) / LPG(LPG). 다중 선택 토글, 선택된 휠×엔진 교차곱이 categories 가 됨(예: 2륜+전기·내연 → 2륜전기, 2륜내연). "→ 적용: ..." 미리보기 표시, 한 축이라도 미선택이면 제출 버튼 비활성 | — | |
| 주기 입력 (생성·수정 폼 공통) | 교환주기 (km)와 교환주기 (개월) 두 개의 number 입력(min 0), 비우면 해당 주기 없음(null). 알람 임계 % 는 number 입력(0~100), 비우면 알람 없음 | — | |
| 추가 버튼 (생성 폼 제출) | createMaintenanceItemAction — name(필수, max 100) + categories(교차곱) + cycleKm/cycleMonths/alertThresholdPercent 로 품목 생성. 서버 검증: categories 1개 이상, cycleKm·cycleMonths 중 최소 하나 필수. 성공 시 /management/maintenance revalidate + redirect ※ 서버 액션의 엔진 화이트리스트 MAINTENANCE_ENGINES 가 ["ELECTRIC","ICE"] 로 LPG 누락 (app/actions.ts categoriesFromAxes) — UI 에서 LPG 를 골라도 서버에서 조용히 걸러지고, LPG 만 선택하면 categories 가 비어 생성 실패(maintenance-item-invalid-applies-to) | `POST /maintenance-items` | |
| 저장 버튼 (수정 폼 제출) | updateMaintenanceItemAction — 같은 폼 필드로 품목 수정. 모든 필드 optional, 빈 cycle 입력은 명시적 null 로 반영. 성공 시 revalidate + redirect ※ 생성과 동일하게 서버 측 LPG 누락 영향 — LPG 포함 항목을 열어 저장하면 LPG 분류가 탈락한 categories 로 덮어써짐 | `PATCH /maintenance-items/{id}` | |
| 취소 버튼 | 생성 모드면 다이얼로그 닫기, 수정 모드면 view 모드로 복귀 | — | |

### DeleteMaintenanceItemButton — 삭제

| UI 요소 | 동작 | 백엔드 | 판정 |
|---|---|---|---|
| 휴지통 삭제 버튼 (표 각 행 첫 컬럼) | window.confirm("정비 품목 \"이름\" 을(를) 삭제하시겠습니까?") 확인 후 deleteMaintenanceItemAction 으로 삭제. 성공 시 /management/maintenance revalidate + redirect, 실패 시 status=maintenance-item-delete-error 로 redirect | `DELETE /maintenance-items/{id}` | |

---

## 6. 화면 밖 기능 — Next.js API 라우트

브라우저 화면이 아니라 폴링·외부 콜백·파일 다운로드가 쓰는 경로들. 최종적으로 부르는
백엔드를 붙였다.

### 폴링 프록시 (app/api/dashboard/**)

| UI 요소 | 동작 | 백엔드 | 판정 |
|---|---|---|---|
| GET /api/dashboard/map-state | 지도 핀 폴링 프록시 — 루트 페이지 FullscreenMapHost 의 usePollingBikePins 가 30초 주기로 호출(탭 숨김 시 skip). service-ops 세션 쿠키를 서버에 두고 지도 상태(bikePins·stationPins·summary·tips)를 JSON 으로 반환. 백엔드 핀에 더해 시뮬 차량(IMEI '-' 시작) 합성 핀과 활성 배차·청소형 다음 고객 좌표를 병합 ※ Next 라우트 /api/dashboard/map-state 경유. /api/v1/bikes 는 시뮬 핀 합성용 listVehicles(page 0, size 200), next-customer 는 청소형 차량별 개별 조회. 실패 시 빈 지도 + notice 로 fallback (source: mock). DashboardCanvas(10초 폴링)도 같은 라우트를 쓰지만 현재 어느 페이지에도 마운트되지 않음 | `GET /dashboard/map-state` · `GET /bikes` · `GET /dispatch-orders/active` · `GET /bikes/{id}/next-customer` | |
| GET /api/dashboard/bike-current-state/{bikeId} | 마커 클릭 차량 단건 텔레메트리 프록시 — BikeDetailPanel 이 차량 핀 클릭 시 호출해 속도·배터리·연결상태 등을 채움. 실패 시 data: null + notice ※ Next 라우트 /api/dashboard/bike-current-state/{bikeId} 경유. 호출 컴포넌트 BikeDetailPanel 은 DashboardCanvas 전용인데 DashboardCanvas 가 현재 렌더 트리에 없음 — 라우트는 살아 있으나 실호출 UI 없음 | `GET /telemetry/bikes/{id}/current-state` | |
| GET /api/dashboard/bike-snapshot/{bikeId} | 마커 클릭 차량 조인 스냅샷 프록시 — 라이더·계약 등 조인 정보 + '시동 방지' 토글 상태(ignitionBlocked)를 vehicle 단건 조회로 별도 취득해 병합. 둘은 Promise.allSettled 로 독립 처리 ※ Next 라우트 /api/dashboard/bike-snapshot/{bikeId} 경유. 호출자 BikeDetailPanel — 위와 같은 이유로 현재 미장착 | `GET /dashboard/bikes/{id}/snapshot` · `GET /bikes/{id}` | |
| GET /api/dashboard/battery-station/{stationId} | 충전소 마커 클릭 상세 프록시 — StationDetailPanel 이 열릴 때 단건 조회로 핀 정보를 보강. 실패 시 핀 정보만으로 렌더 + notice ※ Next 라우트 /api/dashboard/battery-station/{stationId} 경유. 호출자 StationDetailPanel 도 DashboardCanvas 전용이라 현재 미장착 | `GET /battery-stations/{id}` | |
| POST /api/dashboard/battery-station/{stationId}/battery-counts | 충전소 상세 패널의 인라인 배터리 카운트 수정 — 최대 보관/현재 보관/가용 수량을 0 이상 정수·대소관계(available ≤ current ≤ max)로 라우트에서 1차 검증 후 백엔드 PATCH, 갱신된 station 을 즉시 반환해 다음 폴링을 안 기다림 ※ Next 라우트 /api/dashboard/battery-station/{stationId}/battery-counts 경유 (메서드는 라우트 POST → 백엔드 PATCH). 폼은 available 값을 current 에도 복사해 전송, reason/memo nullable. 호출자 StationDetailPanel 현재 미장착 | `PATCH /battery-stations/{id}/battery-counts` | |

### 엑셀 내보내기 (app/api/management/*/export)

| UI 요소 | 동작 | 백엔드 | 판정 |
|---|---|---|---|
| 차량 탭 '내려받기' 버튼 | 차량 목록 xlsx 다운로드 — 브라우저 anchor 는 Bearer 토큰을 못 실으므로 라우트가 세션 토큰을 붙여 프록시하고 vehicles.xlsx 로 attachment 응답 ※ Next 라우트 /api/management/vehicles/export 경유. 호출: /management/resources 의 VehiclesManagementPanel | `GET /bikes/export` | |
| 라이더 탭 '내려받기' 버튼 | 라이더 목록 xlsx 다운로드 — 세션 토큰 프록시, riders.xlsx ※ Next 라우트 /api/management/riders/export 경유. 호출: /management/resources 의 RidersManagementPanel | `GET /riders/export` | |
| 매칭 탭 '내려받기' 버튼 | 활성 매칭(계약) xlsx 다운로드 — 재업로드용 템플릿 성격, matching.xlsx ※ Next 라우트 /api/management/matching/export 경유. 호출: /management/resources 의 MatchingManagementPanel | `GET /contracts/export` | |
| 매칭 탭 '매칭로그' 버튼 | 종료된 계약까지 포함한 매칭 전체 이력 xlsx 다운로드(상태·종료시각 컬럼 포함) — 읽기 전용 로그, matching-log.xlsx ※ Next 라우트 /api/management/matching/log-export 경유. 호출: MatchingManagementPanel | `GET /contracts/log-export` | |
| 배차 패널 '내려받기' 버튼 | 배차 주문 xlsx 다운로드 — dispatch-orders.xlsx. 단일 배차(DispatchPanel)와 순차 배차(SequentialDispatchPanel) 두 패널이 같은 라우트를 공유 ※ Next 라우트 /api/management/dispatch/export 경유. 호출: /management/operations 페이지의 두 패널 | `GET /dispatch-orders/export` | |

### 차량 상세 데이터 (app/api/overview/**)

| UI 요소 | 동작 | 백엔드 | 판정 |
|---|---|---|---|
| GET /api/overview/vehicle-device/{bikeId} | 차량 상세 다이얼로그(VehicleDetailDialog) open 시 lazy fetch — 현재 부착 단말기 IMEI(deviceUid) 와 활성 installation id 반환. 백엔드에 bikeId 필터가 없어 설치 목록 한 페이지(200건)를 받아 클라이언트에서 bikeId·removedAt=null 매칭 후 해당 단말 단건 조회 ※ Next 라우트 /api/overview/vehicle-device/{bikeId} 경유. 조회 실패는 deviceUid: null (UI '—' 표시) 로 fallback. 단말 200대 초과 전 백엔드 bikeId 필터 필요 (코드 주석) | `GET /bike-device-installations` · `GET /devices/{id}` | |
| GET /api/overview/vehicle-maintenance/{bikeId} | 차량 상세 다이얼로그 '정비 상태' 섹션 번들 — 차량별 정비 카탈로그(engineType 매칭) + 정비 이력 + 현재 텔레메트리 요약을 한 번에 반환. 패널이 열려 있는 동안 15초 주기 폴링(탭 숨김 시 skip), '교환 완료' 후 즉시 재페치 ※ Next 라우트 /api/overview/vehicle-maintenance/{bikeId} 경유. current-state 404(텔레메트리 무수신 차량)면 더미 시뮬 값으로 대체, 전체 실패면 빈 번들 | `GET /bikes/{id}/maintenance-items` · `GET /bikes/{id}/maintenance-records` · `GET /telemetry/bikes/{id}/current-state` | |

### 배차 증빙 (app/api/dispatch/completion-photo)

| UI 요소 | 동작 | 백엔드 | 판정 |
|---|---|---|---|
| GET /api/dispatch/completion-photo/{id} | 배차 완료 증빙 사진 이미지 프록시 — 서버 세션의 Bearer 토큰으로 백엔드에서 사진 바이트를 받아 브라우저에 스트리밍(Content-Type 유지, private 5분 캐시). <img src> 가 토큰을 못 싣는 문제를 same-origin 프록시로 해결 ※ Next 라우트 /api/dispatch/completion-photo/{id} 경유. 원래 VehicleDetailDialog '완료 내역' 썸네일이 호출했으나 해당 섹션 제거(commit aea031a) 로 현재 트리에는 호출 UI 가 없음 — 라우트만 잔존. 401(미인증)/404(사진 없음)/502(백엔드 연결 오류) 를 한국어 메시지로 구분 응답 | `GET /dispatch-orders/{id}/completion-photo` | |

### OTOPLUG 콜백 수신 (app/api/otoplug/nt/{type}) — 단말 텔레메트리 수신

| UI 요소 | 동작 | 백엔드 | 판정 |
|---|---|---|---|
| POST /api/otoplug/nt/{type} | 외부 OTOPLUG NT webhook 수신 — type=driving(약 60초 주기 drivingData 1건) / driving-detail(10초 배치 tripData 배열) 만 처리, 그 외 type 은 result:0 으로 ack 후 무시(재시도 방지). 레코드를 내부 ingest 형식(deviceUid=IMEI, vendorEventId, KST 14자리→UTC ISO, speedKph, accStatus, telemetrySource:WEBHOOK, rawPayload)으로 변환해 레코드당 1건씩 백엔드에 POST ※ 토큰 검증: OTOPLUG-Channel-Token 헤더를 env OTOPLUG_CHANNEL_TOKEN 과 비교(불일치 401 result:1, env 미설정 시 경고 후 검증 생략). 원문 덤프: env OTOPLUG_LOG_RAW_PAYLOAD=true 일 때만 raw payload 콘솔 로그(기본 꺼짐 — 과거 로그 867MB 사고). GPS 0/결측 레코드 skip, accStatus 는 0=시동 OFF·비0=ON·결측 undefined(백엔드가 직전 상태 유지). ingest 호출에 인증 헤더 없음(내부 수신 엔드포인트). ingest 5xx/네트워크 오류 → result:1 + 500 으로 OTOPLUG 재시도 유도, 4xx 는 로그만 남기고 정상 ack | `POST /telemetry/device-events` | |

---

## 7. 화면에서 도달할 수 없는 백엔드 — 60개

엔드포인트는 살아 있는데 운영 콘솔 어느 UI 로도 호출할 수 없는 것들. 전수 인벤토리
144개와 화면 조사를 대조하고, 미도달 후보를 검증자 2명이 서로 다른
방식으로 반박 시도해 확정했다. "죽은 UI" 표시가 있는 것은 다이얼로그·액션 코드는
있지만 그것을 렌더하는 화면이 없는 경우다.

### 계약

| 백엔드 | 설명 | 판정 |
|---|---|---|
| `POST /contract-templates` | 계약 템플릿 생성 | |
| `DELETE /contract-templates/{id}` | 계약 템플릿 소프트 삭제 | |
| `GET /contract-templates/{id}` | 계약 템플릿 단건 조회 | |
| `PATCH /contract-templates/{id}` | 계약 템플릿 수정 | |
| `POST /rider-bike-contracts` | 라이더-차량 계약 생성 — **죽은 UI**: 계약 생성 폼(ContractMatchingForm)이 렌더 안 됨 — 계약 생성은 엑셀 업로드로만 가능 | |
| `GET /rider-bike-contracts/{id}` | 라이더-차량 계약 단건 조회 | |
| `PATCH /rider-bike-contracts/{id}` | 라이더-차량 계약 수정 (body 생략 가능) | |

### 단말

| 백엔드 | 설명 | 판정 |
|---|---|---|
| `GET /bike-device-installations/{id}` | 차량-단말 장착 이력 단건 조회 | |
| `DELETE /devices/{id}` | 단말 소프트 삭제 | |
| `PATCH /devices/{id}` | 단말 정보 수정 | |

### 단말 동기화

| 백엔드 | 설명 | 판정 |
|---|---|---|
| `GET /device-api-sync-runs` | 동기화 런 목록 (startedAt 내림차순 페이지) | |
| `POST /device-api-sync-runs` | 단말 API 동기화 런 시작 기록 생성 | |
| `GET /device-api-sync-runs/{id}` | 동기화 런 단건 조회 | |
| `PATCH /device-api-sync-runs/{id}/complete` | 동기화 런 완료 처리 | |
| `POST /device-api-sync-runs/{id}/results` | 동기화 런에 개별 결과 기록 추가 | |

### 라이더

| 백엔드 | 설명 | 판정 |
|---|---|---|
| `POST /rider-education-records` | 라이더 교육 이수 기록 생성 — **죽은 UI**: 라이더 등록 다이얼로그와 함께 죽음 | |
| `DELETE /rider-education-records/{id}` | 라이더 교육 이수 기록 소프트 삭제 | |
| `GET /rider-education-records/{id}` | 교육 이수 기록 단건 조회 | |
| `PATCH /rider-education-records/{id}` | 라이더 교육 이수 기록 수정 | |
| `POST /riders` | 라이더 신규 등록 — **죽은 UI**: CreateRiderDialog 가 렌더 안 됨 — 라이더 등록은 엑셀 업로드로만 가능 | |
| `GET /riders/{id}` | 라이더 단건 조회 | |
| `PATCH /riders/{id}/app-account/link` | 라이더에 앱 계정 연결 | |
| `PATCH /riders/{id}/app-account/unlink` | 라이더 앱 계정 연결 해제 | |
| `GET /riders/{id}/education-records` | 특정 라이더의 교육 이수 기록 페이지 목록 | |

### 무결성

| 백엔드 | 설명 | 판정 |
|---|---|---|
| `GET /integrity/reference-checks` | 도메인 간 참조 무결성 스캔 결과 조회 | |

### 배차

| 백엔드 | 설명 | 판정 |
|---|---|---|
| `POST /dispatch-orders` | 배차 주문 생성 | |
| `POST /dispatch-orders/{id}/complete` | 배송 완료 처리 — 완료 사진(multipart) 업로드, 처리 admin 기록 — **죽은 UI**: 완료 처리 버튼 없음 (라이더 웹 제거 후 호출자 소멸) | |

### 보험

| 백엔드 | 설명 | 판정 |
|---|---|---|
| `POST /insurance-items` | 보험 상품 생성 | |
| `DELETE /insurance-items/{id}` | 보험 상품 소프트 삭제 | |
| `GET /insurance-items/{id}` | 보험 상품 단건 조회 | |
| `PATCH /insurance-items/{id}` | 보험 상품 수정 | |
| `POST /rider-insurances` | 라이더 보험 가입 등록 | |
| `DELETE /rider-insurances/{id}` | 라이더 보험 가입 소프트 삭제 | |
| `GET /rider-insurances/{id}` | 라이더 보험 가입 단건 조회 | |
| `PATCH /rider-insurances/{id}` | 라이더 보험 가입 수정 | |

### 장비

| 백엔드 | 설명 | 판정 |
|---|---|---|
| `GET /bike-equipments` | 차량 장비 페이지 목록 | |
| `POST /bike-equipments` | 차량 장비 부착 등록 | |
| `GET /bike-equipments/{id}` | 차량 장비 단건 조회 | |
| `PATCH /bike-equipments/{id}` | 차량 장비 정보 수정 | |
| `PATCH /bike-equipments/{id}/remove` | 차량 장비 탈거 처리 (body 생략 가능) | |
| `GET /equipment-types` | 장비 유형 페이지 목록 | |
| `POST /equipment-types` | 장비 유형 생성 | |
| `DELETE /equipment-types/{id}` | 장비 유형 소프트 삭제 | |
| `GET /equipment-types/{id}` | 장비 유형 단건 조회 | |
| `PATCH /equipment-types/{id}` | 장비 유형 수정 | |

### 정비

| 백엔드 | 설명 | 판정 |
|---|---|---|
| `GET /maintenance-items/{id}` | 정비 품목 단건 조회 | |
| `DELETE /maintenance-records/{id}` | 정비 이력 소프트 삭제 | |

### 차량

| 백엔드 | 설명 | 판정 |
|---|---|---|
| `GET /bike-operation-status-histories` | 차량 운행 상태 변경 이력 페이지 목록 | |
| `GET /bike-operation-status-histories/{id}` | 운행 상태 변경 이력 단건 조회 | |
| `POST /bikes` | 차량 신규 등록 — **죽은 UI**: CreateVehicleDialog 가 어느 화면에도 렌더 안 됨 | |
| `PATCH /bikes/{id}/ignition-block` | 차량 시동 차단/해제 설정 — **죽은 UI**: 시동 차단 UI(RiderDetailDialog·BikeDetailPanel)가 렌더 안 됨 | |
| `DELETE /bikes/{id}/next-customer` | 차량의 다음 고객 정보 삭제 | |
| `PUT /bikes/{id}/next-customer` | 차량의 다음 고객 정보 upsert — **죽은 UI**: setNextCustomerAction 을 부르는 화면 없음 | |
| `POST /bikes/{id}/next-customer/promote` | 다음 고객을 현재 고객으로 승격 | |

### 충전소

| 백엔드 | 설명 | 판정 |
|---|---|---|
| `POST /battery-stations` | 배터리 스테이션 등록 — **죽은 UI**: CreateStationDialog 가 렌더 안 됨 — 충전소 등록 UI 없음 | |
| `GET /station-battery-count-logs` | 스테이션 배터리 수량 변경 로그 페이지 목록 | |
| `GET /station-battery-count-logs/{id}` | 배터리 수량 변경 로그 단건 조회 | |

### 텔레메트리

| 백엔드 | 설명 | 판정 |
|---|---|---|
| `GET /telemetry/bike-current-states` | 전체 차량 최신 텔레메트리 상태 페이지 목록 (lastReceivedAt 내림차순) | |

### 팁

| 백엔드 | 설명 | 판정 |
|---|---|---|
| `POST /tips/submissions` | 팁 제보 제출 (제출 즉시 팁 생성) — **죽은 UI**: 라이더 제보 경로 — 호출자 소멸 | |
| `GET /tips/{id}` | 팁 단건 조회 | |

---

## 8. 화면 없는 백엔드 — 스케줄러 · 부팅 훅 · 공개 경로

| 위치 | 동작 | 판정 |
|---|---|---|
| `maintenance/service/MaintenanceAlarmEvaluator.evaluate()` | 기본 10분 주기로 IN_SERVICE 차량의 정비 품목 소모율(개월/주행거리 중 큰 값)을 평가해 임계치(alertThresholdPercent) 초과 시 MAINTENANCE_ALARM 알림을 생성. 최근 정비 이후 이미 발생한 알림은 dedup. | |
| `vendor/VendorTelemetryPollingScheduler.poll()` | 기본 비활성. 프로퍼티로 켜면 60초 주기로 VendorTelemetryAdapter.pullOnce() 를 호출해 벤더 텔레메트리를 폴링. 커서는 인메모리 보관(F-1 스켈레톤). 내부 @Configuration 이 활성 시에만 @EnableScheduling 을 켠다. | |
| `auth/seed/AdminSeedRunner.run()` | 부팅 시 thundercrew.admin.seed.* env 값으로 admin 계정을 보장. idempotent — 같은 loginId 의 admin 이 이미 있으면 아무 것도 안 하고, 없을 때만 새 row 생성(비밀번호 BCrypt 해시). loginId/password/displayName 중 하나라도 비면 skip. | |

인증 없이 열린 경로 (SecurityConfig `permitAll`):

- `/actuator/health`
- `/api/v1/auth/login`
- `/api/v1/auth/refresh`
- `POST /api/v1/telemetry/device-events`


---

## 9. 렌더되지 않는 컴포넌트 — 죽은 UI 18개

코드에 있고 컴파일도 되지만 어떤 페이지의 렌더 트리에도 도달하지 않는 것들. §7 의
"죽은 UI" 엔드포인트들과 짝이다. 살리려면 화면에 붙여야 하고, 버리려면 §7 의 대응
엔드포인트와 같이 정리하는 것이 맞다.

| 컴포넌트 | 비고 | 판정 |
|---|---|---|
| `components/dashboard/DashboardCanvas.tsx` | 구 대시보드 캔버스(10초 폴링 + 마커 상세 패널 소유자). 어느 페이지도 import 하지 않음 — 아래 3개의 유일한 부모 | |
| `components/dashboard/BikeDetailPanel.tsx` | DashboardCanvas 전용. /api/dashboard/bike-current-state·bike-snapshot 의 유일 호출자. 시동 차단 토글 포함 | |
| `components/dashboard/StationDetailPanel.tsx` | DashboardCanvas 전용. /api/dashboard/battery-station/* 의 유일 호출자 | |
| `components/dashboard/MonitoringSearch.tsx` | DashboardCanvas 전용 검색바 | |
| `components/management/RidersPanel.tsx` | 구 라이더 탭. 아래 5개의 유일한 부모 — 숙련도(skillLevel) UI 가 이 사슬에만 있음 | |
| `components/management/RiderDetailDialog.tsx` | RidersPanel 전용. 라이더 수정·숙련도·비밀번호 초기화·계약 해지 진입점 | |
| `components/management/RiderFilterControls.tsx` | RidersPanel 전용 필터 (교육·차량 배정·구독렌탈·보험·시동) | |
| `components/management/CreateRiderDialog.tsx` | 라이더 등록 다이얼로그. 어느 파일도 import 하지 않음 — 라이더 등록은 엑셀 업로드로만 가능 | |
| `components/management/DeleteRiderButton.tsx` | RidersPanel 전용 (자원 관리의 삭제 버튼은 별도 구현) | |
| `components/management/IgnitionControlButton.tsx` | RidersPanel 전용 시동 차단 스위치 | |
| `components/management/ContractMatchingForm.tsx` | 계약 생성 폼. 렌더 안 됨 — 계약 생성은 엑셀 업로드로만 가능 | |
| `components/management/TerminateContractButton.tsx` | RiderDetailDialog 전용 (자원 관리 매칭 표의 종료 버튼은 별도 구현) | |
| `components/management/OperationStatusToggle.tsx` | 어느 파일도 import 하지 않음 (차량 상세의 운영상태 select 는 별도 구현) | |
| `components/management/CreateVehicleDialog.tsx` | 차량 등록 다이얼로그. 어느 파일도 import 하지 않음 — 차량 등록은 엑셀 업로드로만 가능 | |
| `components/management/CreateStationDialog.tsx` | 충전소 등록 다이얼로그. 어느 파일도 import 하지 않음 — 충전소 등록 UI 없음 | |
| `components/overview/DeliveryStatusPanel.tsx` | 구 배송 상태 패널. 어느 파일도 import 하지 않음 (현재는 DeliveryFocusPanel 이 그 역할) | |
| `components/overview/VehicleFilterControls.tsx` | 차량 필터 컨트롤(구분·운영·연결·시동·정비 5종). 어느 파일도 import 하지 않음 | |
| `app/login/actions.ts 의 changeAdminPassword` | 서버 액션은 구현돼 있으나 import 하는 컴포넌트 없음 — PATCH /auth/me/password 도달 불가 | |
