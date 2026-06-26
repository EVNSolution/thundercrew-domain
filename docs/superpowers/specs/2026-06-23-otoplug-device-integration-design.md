# OTOPLUG 단말 자동 연동 설계

**작성일:** 2026-06-23

## 목표

자원관리에서 차량을 등록할 때 **IMEI + terminalID**를 입력하면:
1. 차량(bike) 저장 + device(`device_uid = IMEI`) 자동 생성 + bike 연결,
2. OTOPLUG가 보내는 NT 콜백을 **인앱 수신기**가 받아 `imei → device → bike`로 매핑해 기존 telemetry ingest에 투입 → 지도/대시보드 반영.

**observer 등록은 범위 외(ops 1회):** NT observer는 계정(clientID) 단위 + 영구(expiration -1)라 한 번만 등록하면 됨. 앱이 등록하지 않고, ops가 `test_nt.py`로 **콜백 URL을 인앱 수신기로 지정해 1회 재등록**한다(기존 python-리스너용 observer는 `unregister-all` 후 재등록). → 앱 코드 0줄.

## 확정된 결정

- **deviceUid = IMEI** (`data.imei`). 실제 NT 페이로드(driving / drivingDetail) 둘 다 `data.imei`를 일관되게 포함. terminalID는 보조 식별/표시용.
- **수신기 = Next.js route handler** (`app/api/otoplug/...`). 이유: nginx가 모든 경로를 Next.js(3000)로 보내고 Java(8080)는 localhost 전용 → 공개 콜백은 Next.js만 가능. **인프라 변경 0.**
- **내부 ingest 인증**: Java telemetry ingest 엔드포인트를 **localhost 내부용으로 permit**(JWT 없이). 외부 노출이 없으므로 안전. 수신기가 엣지에서 **OTOPLUG 채널토큰**으로 1차 검증.

## 비목표 (YAGNI)

- RR(Request/Response) 폴링 연동 — 이번 범위 아님(NT 웹훅만).
- `device`/`driving-result` NT — P1은 `driving`, `drivingDetail`만. 나머지는 수신만 하고 무시(추후).
- 시뮬레이션 device(`-1`) 경로 변경 — 기존 그대로 둠.

## 라우팅 (기존 컨벤션 그대로)

```
OTOPLUG → https://thcr.cleversystem.ai/api/otoplug/nt/{type}   (Next.js route handler, 공개)
            ↳ 채널토큰 검증 + data.imei 추출 + (driving-detail) tripData[] 펼침
            ↳ http://localhost:8080/api/v1/telemetry/device-events  (Java ingest, 내부 permit)
```
- `{type}` ∈ `driving | driving-detail` (P1). 콜백 base = `OTOPLUG_CALLBACK_BASE_URL`(env, 기본 `https://thcr.cleversystem.ai/api/otoplug/nt`).

---

## P1 — 데이터 흐름 확보 (수신기 + 폼 + device 매핑)

### P1-A. 인앱 NT 웹훅 수신기 (frontend)
- `app/api/otoplug/nt/[type]/route.ts` (`export const dynamic = "force-dynamic"`, POST 핸들러).
- 동작:
  1. 헤더 `OTOPLUG-Channel-Token` 을 env `OTOPLUG_CHANNEL_TOKEN`(우리가 observer 등록 시 쓴 토큰)과 비교 — 불일치면 401. (P1 단독 배포 시 토큰 미설정이면 검증 skip + 경고 로그. P2에서 강제.)
  2. body 파싱(실제 페이로드 기준):
     - `driving`(단건): 위치/속도 = `data.drivingData.{latitude,longitude,speed}`, 시각 = `data.drivingData.msgdate`(yyyyMMddHHmmss).
     - `driving-detail`(배열): `data.tripData[]` 각 레코드 = `{latitude,longitude,speed,gpsSpeed}`, 시각 = `timeOfOccurrence`(yyyyMMddHHmmss) → 레코드 수만큼 1건씩.
     - 공통 식별: `data.imei`(필수), `data.terminalID`(보조).
  3. 각 레코드를 `TelemetryIngestRequest` 로 변환:
     - `deviceUid` = `data.imei`
     - `receivedAt` = 해당 시각(yyyyMMddHHmmss, **KST**) → ISO(UTC). 없으면 수신시각.
     - `latitude`/`longitude`/`speedKph` = 문자열 → number. `-9999`/`null`/빈값/`0,0`좌표는 제외(좌표 없으면 그 레코드 skip).
     - `vendorEventId` = `imei + ":" + 시각`(멱등키).
     - `telemetrySource` = `WEBHOOK`. `rawPayload` = 원본 레코드.
  4. 내부 ingest 호출(서버사이드, `SERVICE_OPS_API_BASE_URL`). 실패해도 200 반환은 하지 않음 — OTOPLUG 재시도 정책상 5xx 반환(단, 파싱불가/좌표없음 등 "버릴 데이터"는 200으로 ack).
- 응답: 성공 `{ "result": 0 }`(OTOPLUG가 result 확인). 토큰불일치 401, 서버오류 500.

### P1-B. Java ingest 내부 permit + WEBHOOK 허용
- `SecurityConfig` 에서 `POST /api/v1/telemetry/device-events` 를 `permitAll` (이미 그런지 확인 후, 아니면 추가). 외부 노출 없음(nginx가 Java로 안 보냄).
- `TelemetryIngestRequest`/`TelemetrySource` 에 `WEBHOOK` 이미 존재(확인). 변환은 수신기(P1-A)에서 수행하므로 Java 변경 최소.

### P1-C. 차량 단건 등록 폼에 IMEI/terminalID (frontend)
- `CreateVehicleDialog` 에 입력 추가: `imei`(maxLength 15), `terminalId`(maxLength 64).
- `createVehicleFromOverviewAction`:
  1. 기존대로 bike 생성(+ imei/terminalId 포함 — `createVehicle` DTO가 imei/terminalId 받는지 확인, 없으면 생성 후 `updateVehicle` 로 set, 또는 create DTO 확장).
  2. `imei` 있으면: device(`device_uid = imei`) 없으면 생성 → `createBikeDeviceInstallation(bikeId, deviceId)` (수정 다이얼로그 로직 재사용). terminalId는 bike 컬럼에만 저장(표시용).
  3. observer 호출 없음(ops가 1회 등록, 범위 외).
- 백엔드 `createVehicle`/Bike.create 가 imei/terminalId 를 받지 않으면 DTO/서비스 확장(있으면 그대로).

### P1 검증
- 수신기: 샘플 drivingDetail JSON(OTOPLUG_NT_API.md 예시)을 `curl` 로 `/api/otoplug/nt/driving-detail` 에 POST → ingest 거쳐 `bike_current_states` 갱신, 지도 반영 확인.
- 폼: 차량 등록 시 device + installation 생성 확인.

---

## observer 등록 — 범위 외 (ops 1회)

앱에서 observer를 등록하지 않는다(계정 단위 + 영구라 1회면 충분). ops가 `scripts/otoplug/test_nt.py`로:
1. `test_nt.py`의 `BASE_CALLBACK`을 **인앱 수신기**(`https://thcr.cleversystem.ai/api/otoplug/nt`)로 수정.
2. `python3 test_nt.py unregister-all` (기존 python-리스너용 observer 해제 → 중복 수신 방지).
3. `python3 test_nt.py register` (driving + drivingDetail, 콜백=인앱 URL).
- 등록 시 생성된 **채널토큰**(state 파일의 `token`)을 수신기 검증용 env `OTOPLUG_CHANNEL_TOKENS`(타입별)로 넣는다(선택 — 미설정 시 검증 skip).
- Java OTOPLUG 클라이언트·observer 테이블·시크릿(CLIENT_ID 등)은 **불필요**(앱이 OTOPLUG를 호출하지 않으므로).

---

## 보안/주의

- 수신기는 **공개 엔드포인트** — 가능하면 채널토큰(`OTOPLUG-Channel-Token`) 검증. 검증 토큰 env 미설정 시 경고 로그 + 통과(초기 도입 편의), 설정 시 불일치 거부.
- ingest permit 는 **localhost 전용**이라 외부에서 직접 호출 불가(nginx가 Java로 안 보냄). 확인 필수.
- 좌표 없는/`-9999`/`0,0` 레코드는 저장하지 않음(현재상태 오염 방지).
- 멱등키(`imei:시각`)로 중복 콜백/재시도 방어(기존 ingest 멱등성 재사용).

## 범위 정리 (축소됨)

- **이번 구현**: ① 인앱 NT 수신기(`/api/otoplug/nt/{type}`) + ② Java ingest 내부 permit + ③ 차량폼 IMEI/terminalID + device 자동연결. 단일 PR.
- **앱 밖(ops 1회)**: observer 재등록(콜백=인앱 URL) + python 리스너용 해제.
