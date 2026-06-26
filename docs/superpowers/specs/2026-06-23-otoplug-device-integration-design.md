# OTOPLUG 단말 자동 연동 설계

**작성일:** 2026-06-23

## 목표

자원관리에서 차량을 등록할 때 **IMEI + terminalID**를 입력하면:
1. 차량(bike) 저장 + device(`device_uid = IMEI`) 자동 생성 + bike 연결,
2. OTOPLUG NT observer(`driving`, `drivingDetail`)가 없으면 1회 자동 등록(콜백 = 우리 인앱 URL),
3. OTOPLUG가 보내는 NT 콜백을 **인앱 수신기**가 받아 `imei → device → bike`로 매핑해 기존 telemetry ingest에 투입 → 지도/대시보드 반영.

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
  3. (P2에서) observer ensure 호출 추가.
- 백엔드 `createVehicle`/Bike.create 가 imei/terminalId 를 받지 않으면 DTO/서비스 확장(있으면 그대로).

### P1 검증
- 수신기: 샘플 drivingDetail JSON(OTOPLUG_NT_API.md 예시)을 `curl` 로 `/api/otoplug/nt/driving-detail` 에 POST → ingest 거쳐 `bike_current_states` 갱신, 지도 반영 확인.
- 폼: 차량 등록 시 device + installation 생성 확인.

---

## P2 — observer 자동 등록 (Java + 설정)

### P2-A. OTOPLUG 클라이언트 (Java)
- `vendor/otoplug/OtoplugClient` (또는 신규 `otoplug` 패키지):
  - `authenticate()`: `GET common.auth`(authorizeCode) → `POST common.auth.token`(Bearer). 토큰 60분 캐시(만료 전 재발급).
  - `registerObserver(api, callbackUrl, channelToken)`: `POST /ccgf/v1/{api}/{CLIENT_ID}/observer` body `{id, type, address, token, expiration:-1, dataOutputType:"simple"}`. `result==0` 확인.
  - `unregisterObserver(api, id, token)`: `/ignore`.
  - HTTP는 Spring `RestClient`/`WebClient`.

### P2-B. observer 상태 저장 + ensure (Java)
- 신규 테이블 `otoplug_observers` (Flyway VNN): `api`, `observer_id`, `channel_token`, `registered_at`. (활성 1건/ api.)
- `OtoplugObserverService.ensureRegistered()`:
  - 대상 api = `csi.terminal.status.data.driving`, `csi.terminal.status.data.drivingDetail`.
  - 각 api에 대해 DB에 활성 등록 있으면 skip, 없으면 `OtoplugClient.registerObserver(callbackUrl = OTOPLUG_CALLBACK_BASE + "/" + shortType, channelToken = OTOPLUG_CHANNEL_TOKEN)` → 성공 시 DB 저장.
  - **멱등**: 동시/중복 호출 안전(DB unique + 트랜잭션).
- 노출: `POST /api/v1/otoplug/observers/ensure` (관리자 권한). 프론트 차량등록 액션이 호출.

### P2-C. 차량 등록 시 ensure 트리거 (frontend)
- `createVehicleFromOverviewAction` 에서 device 연결 후 `client.ensureOtoplugObservers()` 호출(실패해도 차량등록은 성공 — best effort, 에러는 로그/토스트).

### P2-D. 설정/시크릿 (ops — 사용자/배포 담당)
- env 추가: `OTOPLUG_SERVER_URL`(기본 https://otoplug.kt.com), `OTOPLUG_CLIENT_ID`, `OTOPLUG_SECURED_CODE`, `OTOPLUG_CHANNEL_TOKEN`(우리가 정하는 비밀), `OTOPLUG_CALLBACK_BASE_URL`.
- `application.properties` 에 `${ENV:default}` 패턴 추가. `aws-ec2-deploy.yml` 에 시크릿 주입(NCP 패턴 동일).
- **클로드는 시크릿 값을 입력하지 않음** — 키 등록/배포는 사용자/ops.

### P2 운영 전환 (ops)
- 인앱 observer로 일원화: 기존 python `test_nt.py unregister-all` 로 python 리스너용 observer 해제(중복 수신 방지) 후, 인앱 ensure 1회 실행.

---

## 보안/주의

- 수신기는 **공개 엔드포인트** — 채널토큰 검증 필수(P2부터 강제). 토큰 없는 요청 거부.
- ingest permit 는 **localhost 전용**이라 외부에서 직접 호출 불가(nginx가 Java로 안 보냄). 확인 필수.
- 좌표 없는/`-9999` 레코드는 저장하지 않음(현재상태 오염 방지).
- 멱등키(`imei:시각`)로 중복 콜백/재시도 방어(기존 ingest 멱등성 재사용).

## 단계 정리

- **P1**(데이터 흐름): 수신기 + ingest permit + 차량폼 IMEI/terminalID + device 자동연결. 별도 PR.
- **P2**(자동 등록): OTOPLUG 클라이언트 + observer 테이블/ensure + 차량등록 트리거 + 설정. 별도 PR. 시크릿/python 해제는 ops.
