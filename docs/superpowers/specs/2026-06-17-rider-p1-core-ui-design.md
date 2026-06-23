# 라이더 P1 코어 UI — 설계

## 목표
라이더 홈(`rider.thcr.cleversystem.ai/rider`)에 코어 3섹션을 띄운다: **내 업무(배차 목록)** + **매칭 차량 위치 지도** + **주행거리**. 읽기 전용. 완료(사진)·팁·알림 수신은 P2.

데이터 결정(브레인스토밍):
- 지도 = **배차 목적지 핀(실데이터)** + **차량 GPS 위치(텔레메트리 있으면, 없으면 목적지만)**.
- 주행거리 = **텔레메트리 odometer**(있으면 km, 없으면 "—"). 텔레메트리 들어오면 자동 반영.

## 백엔드 — 라이더 스코프 read 2개 추가
`RiderSelfReadController`(`/api/v1/rider`)에 GET 2개 추가. riderId는 JWT claim → `RiderBikeContractRepository.findActiveByRiderId(riderId)` → `getBikeId()`로 도출(이미 `getMe`에서 쓰는 패턴). 활성 차량 없으면: dispatch-orders는 `200 []`, vehicle은 `404`.

### 1) `GET /api/v1/rider/me/dispatch-orders`
- 내 차량의 **ASSIGNED 배차 목록**(sequence 오름차순). 활성 차량 없으면 빈 배열.
- 구현: `DispatchOrderReadService`에 `listAssignedByBike(UUID bikeId)` 추가 — repo의 기존 `findByBikeIdAndStatusAndDeletedAtIsNullOrderBySequenceAsc(bikeId, ASSIGNED)` 사용, `DispatchOrderReadResponse`로 매핑(기존 매퍼 재사용).
- 응답: `List<DispatchOrderReadResponse>`(기존 DTO 그대로 — id, customerName, customerPhone, address, latitude, longitude, originAddress, originLat/Lng, sequence, status, kind, …).

### 2) `GET /api/v1/rider/me/vehicle`
- 내 차량 요약 + 현재 위치/주행거리. 신규 DTO `RiderVehicleResponse`:
  ```
  UUID bikeId, String plateNumber, String imei, BikeServiceType serviceType,
  Double currentLatitude, Double currentLongitude,   // 텔레메트리, null 가능
  Integer odometerKm,                                // null 가능
  String connectionStatus,                           // "ONLINE"/"OFFLINE"/null(텔레메트리 없음)
  Instant lastReceivedAt                             // null 가능
  ```
- 구현: 신규 `RiderVehicleReadService`(또는 `RiderSelfReadService` 확장)에서 `BikeReadService.getBike(bikeId)`(번호판·imei·serviceType) + `BikeCurrentStateRepository.findByBikeId(bikeId)`(위치·odometer·lastReceivedAt; **throwing 서비스 말고 repository 직접** 써서 텔레메트리 없으면 null 처리). connectionStatus는 `TelemetryConnection.status(lastReceivedAt, now)`(120분) — 텔레메트리 없으면 null.
- 활성 차량 없으면 `ResourceNotFoundException`(404).

### 계약 테스트
- 로그인→`/me/dispatch-orders`: 활성 차량 + ASSIGNED 주문 N개 시드 → N개 sequence순 반환. 차량 없는 라이더 → `[]`.
- `/me/vehicle`: 차량 + 텔레메트리 시드 → 위치/odometer 반환; 텔레메트리 없는 차량 → 위치/odometer null + connectionStatus null; 차량 없는 라이더 → 404.
- 미인증 → 401(기존 게이트). arch allow-list 불필요(GET read).

> 아키텍처 노트: 라이더 read 서비스가 dispatch/bike/telemetry read를 가로질러 집계 — dashboard 서비스와 동일 패턴(common이 아니므로 arch 규칙 위반 아님).

## 프론트엔드 — 라이더 홈 확장
### API 클라이언트(`lib/services/rider-api.ts`) 추가
- 타입 `RiderDispatchOrder`(백엔드 DispatchOrderReadResponse 대응), `RiderVehicle`(RiderVehicleResponse 대응).
- `riderGetDispatchOrders(token): Promise<RiderDispatchOrder[]>` → GET `/rider/me/dispatch-orders`
- `riderGetVehicle(token): Promise<RiderVehicle | null>` → GET `/rider/me/vehicle` (404 → null)

### `/rider` 홈(`app/rider/page.tsx`) — 서버 컴포넌트
- `getMe` 후 `activeBikeId` 있으면 `dispatch-orders` + `vehicle` 병렬 fetch. 없으면 "배정된 차량이 없습니다" 빈 상태.
- 레이아웃(모바일 단일 컬럼): 프로필 헤더 → **주행거리 카드** → **차량 위치 지도** → **내 업무 목록** → 로그아웃. (순서: 요약→지도→상세)
- **내 업무**: 카드 리스트. 카드당 종류 배지(배송/픽업), 고객명·연락처(tel: 링크)·주소(·출발지). 순서는 백엔드 sequence(순차/왕복은 의미 있음, 배송은 참고용). 빈 목록 시 "현재 배정된 업무가 없습니다".
- **주행거리**: `vehicle.odometerKm != null ? "{}km" : "—"` + 번호판 + 연결상태 칩(ONLINE/OFFLINE/정보없음).

### 라이더 지도 컴포넌트(신규 `components/rider/RiderMap.tsx`, client)
- `loadNcpMapsSdk()`(공용 로더, GL 불필요) → `new naver.maps.Map`.
- 마커: 배차 목적지(주문 lat/lng)들 + (vehicle.currentLat/Lng 있으면) 차량 마커 1개. 타입 `@/types/naver-maps`.
- center/zoom: 차량 위치 있으면 그 기준, 없으면 목적지들 bounds fit, 둘 다 없으면 기본 서울 좌표 + "표시할 위치 없음" 오버레이.
- 마커 아이콘: 간단한 inline SVG(목적지=핀, 차량=스쿠터). MapShell의 복잡한 헬퍼는 복사 안 하고 경량 자체 구현(YAGNI).
- props: `{ vehicle: RiderVehicle | null, orders: RiderDispatchOrder[] }`. 서버 컴포넌트(page)에서 데이터 받아 client 컴포넌트로 전달.

### CSS
`app/globals.css`(또는 라이더 전용 블록)에 모바일 카드/지도 컨테이너 스타일. 인라인 스타일 최소.

## 인프라 (사용자, 코드 아님)
- **NCP 지도 origin 허용목록**: NCP Maps 애플리케이션의 Web 서비스 URL에 `https://rider.thcr.cleversystem.ai` 추가. 안 하면 라이더 호스트에서 지도 SDK가 referer 거부로 로드 실패. (admin은 `thcr.cleversystem.ai`만 등록돼 있을 것이므로 rider 호스트 추가 필요.)
- 배포 워크플로 `.env.local`의 `NEXT_PUBLIC_NCP_MAP_CLIENT_ID`는 같은 빌드라 라이더 페이지에도 인라인됨 — 추가 env 불필요.

## 검증
- 백엔드: compileJava/compileTestJava + 계약 테스트(위 3종). ArchUnit 위반 0(read라 allow-list 무관, 단 새 위반 없는지 확인).
- 프론트: typecheck/lint/build, `/rider` 라우트 생성.
- prod(배포 + NCP 허용목록 후, 사용자): 라이더 로그인 → 홈에 업무/지도/주행거리 표시, 지도 SDK 로드 확인.

## 범위 밖
- 배송 완료(사진)·팁 제출·알림 수신 (P2)
- PWA (P3)
- 라이더 계정관리(비번 변경/발급 UI) — 별도(사용자가 P1 다음으로 지정)
- 길찾기 네이티브 연동(외부 지도 앱) — 주소/좌표 표시까지만(원하면 후속)
