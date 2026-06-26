# OTOPLUG 단말 연동 (수신기 + 폼) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** OTOPLUG NT 콜백을 인앱에서 받아 telemetry로 적재하고, 차량 등록 시 IMEI/terminalID로 device를 자동 연결한다. observer 등록은 범위 외(ops 1회).

**Architecture:** Next.js route handler가 공개 콜백을 받아(채널토큰 검증) `data.imei` 기준으로 레코드를 `TelemetryIngestRequest`로 변환 → 내부(localhost) Java ingest(`/api/v1/telemetry/device-events`, permitAll) 호출. 차량 등록 폼에 IMEI/terminalID 추가 → device(`device_uid=IMEI`) 생성 + bike 연결.

**Base dir:** `C:/Users/user/repositories/clever/thundercrew-domain`
- 백엔드 빌드: `cd development/service-ops-api && ./gradlew compileJava compileTestJava`
- 프론트 빌드: `cd development/front-admin-web && npm run typecheck && npm run lint && npm run build`

---

### Task 1: Java ingest 엔드포인트 내부 permit

**Files:**
- Modify: service-ops-api 의 Spring Security 설정 (SecurityConfig / *SecurityConfiguration — 위치 확인)
- (확인) `telemetry/dto/TelemetryIngestRequest.java`, `telemetry/domain/TelemetrySource.java` 에 `WEBHOOK` 존재

- [ ] **Step 1:** SecurityConfig에서 인증 예외 경로 확인(기존 rider 공개경로/`/actuator` 등 패턴). `POST /api/v1/telemetry/device-events` 를 `permitAll` 에 추가. (이미 permit이면 변경 없음 — 확인만.)
- [ ] **Step 2:** `TelemetrySource` 에 `WEBHOOK` 값 있는지 확인(없으면 추가). `TelemetryIngestRequest` 필드 확인(deviceUid, vendorEventId, receivedAt, latitude, longitude, speedKph, telemetrySource, rawPayload).
- [ ] **Step 3:** 빌드 `./gradlew compileJava compileTestJava` → 성공.
- [ ] **Step 4:** 커밋 `feat: permit telemetry ingest endpoint for internal webhook`.

**주의:** ingest는 nginx가 외부로 노출하지 않음(localhost:8080 전용). permitAll은 내부 호출용.

---

### Task 2: 인앱 NT 웹훅 수신기 (Next.js route handler)

**Files:**
- Create: `development/front-admin-web/app/api/otoplug/nt/[type]/route.ts`
- (확인) `lib/services/service-ops-api.ts` 의 `SERVICE_OPS_API_BASE_URL` 사용 패턴

- [ ] **Step 1:** route handler 작성 (`export const dynamic = "force-dynamic"`, `export async function POST(req, { params })`).
  - `type` = params.type (`driving` | `driving-detail`). 그 외는 200 ack + 무시.
  - 헤더 `OTOPLUG-Channel-Token` 읽기. env `OTOPLUG_CHANNEL_TOKEN_DRIVING` / `OTOPLUG_CHANNEL_TOKEN_DRIVING_DETAIL`(타입별) 있으면 비교 → 불일치 401. 미설정이면 `console.warn` 후 통과.
  - body JSON 파싱. `data.imei`(필수, 없으면 400). 
  - 레코드 추출:
    - `driving`: `[ data.drivingData ]` (단건), 시각 = `data.drivingData.msgdate`.
    - `driving-detail`: `data.tripData` 배열, 각 시각 = `timeOfOccurrence`.
  - 각 레코드 → `toIngest(imei, rec, timeStr)`:
    - lat/lng = `Number(rec.latitude)`, `Number(rec.longitude)`; 유효하지 않거나(`NaN`/`0`) 둘 다 0이면 그 레코드 skip.
    - speedKph = `Number(rec.speed)` (음수/NaN → 0).
    - receivedAt = `kstToIso(timeStr)` — `yyyyMMddHHmmss` 를 KST(UTC+9)로 보고 ISO(UTC) 변환. timeStr 없으면 `new Date().toISOString()`.
    - body = `{ deviceUid: imei, vendorEventId: \`${imei}:${timeStr}\`, receivedAt, latitude, longitude, speedKph, telemetrySource: "WEBHOOK", rawPayload: rec }`.
  - 각 body를 `POST ${SERVICE_OPS_API_BASE_URL}/api/v1/telemetry/device-events` (Content-Type json) 로 순차 전송. (인증 헤더 불필요 — permitAll.)
  - 하나라도 5xx면 500 반환(OTOPLUG 재시도 유도), 그 외 `{ result: 0 }` 200.
- [ ] **Step 2:** `kstToIso` 헬퍼: `"20260610155540"` → `Date.UTC(2026,5,10,15,55,40) - 9h` → ISO. (월 0-based 주의.)
- [ ] **Step 3:** 빌드 `npm run typecheck && npm run lint && npm run build` → 성공.
- [ ] **Step 4:** 커밋 `feat: in-app OTOPLUG NT webhook receiver`.

**검증(로컬 불가 시 메모):** 실제 검증은 dev 배포 후 OTOPLUG 데이터 또는 curl 샘플로. 샘플 페이로드는 spec/OTOPLUG_NT_API.md 참고.

---

### Task 3: 차량 등록 폼 IMEI/terminalID + device 자동 연결

**Files:**
- Modify: `development/front-admin-web/components/management/CreateVehicleDialog.tsx`
- Modify: `development/front-admin-web/app/actions.ts` (`createVehicleFromOverviewAction`)
- (참고) `VehicleDetailDialog.tsx` + `updateVehicleFromOverviewAction` 의 device 생성/설치 로직 재사용

- [ ] **Step 1:** `CreateVehicleDialog` 에 입력 추가: `imei`(maxLength 15), `terminalId`(maxLength 64). 기존 필드(plateNumber/engineType/modelName/operationStatus) 유지.
- [ ] **Step 2:** `createVehicleFromOverviewAction`:
  - bike 생성 시 imei/terminalId 반영. `createVehicle` DTO가 imei/terminalId 받으면 그대로, 아니면 생성 후 `updateVehicle`로 set(또는 create DTO/Bike.create 확장 — 백엔드 확인). 
  - 생성된 vehicleId + `imei` 있으면: 기존 device 목록에서 `deviceUid===imei` 찾고 없으면 `createDevice({deviceUid: imei, enabled:true})` → `createBikeDeviceInstallation({bikeId, deviceId, installedAt: now, memo:"차량 등록 시 IMEI 연동"})`. (updateVehicleFromOverviewAction의 로직 그대로 차용.)
  - device/설치 실패는 차량 생성과 분리해 에러 처리(차량은 생성됐는데 device 실패 시 메시지). 
- [ ] **Step 3:** 백엔드: `createVehicle`/Bike.create 가 imei/terminalId 미지원이면 DTO + 서비스 + (필요시) 계약테스트 확장. 지원하면 변경 없음.
- [ ] **Step 4:** 빌드(프론트 + 백엔드 변경 시 백엔드도) → 성공.
- [ ] **Step 5:** 커밋 `feat: vehicle create form IMEI/terminalID + auto device link`.

---

### Task 4: 최종 검증 + PR

- [ ] 백엔드 `./gradlew compileJava compileTestJava` + 프론트 `npm run typecheck && npm run lint && npm run build`.
- [ ] PR → dev. PR 본문에 **ops 후속 작업**(observer 콜백을 인앱 URL로 재등록 + python 해제 + 채널토큰 env) 명시.

## Self-Review
- 스펙 커버리지: 수신기(T2), ingest permit(T1), 폼+device(T3) — 매핑됨. observer는 범위 외(ops).
- 타입 일관성: deviceUid=imei, telemetrySource="WEBHOOK", vendorEventId=`imei:시각` — 태스크 간 일치.
- 미확정 실런타임(SecurityConfig 경로, createVehicle DTO의 imei 지원 여부)은 각 태스크 "확인 후"로 명시.
