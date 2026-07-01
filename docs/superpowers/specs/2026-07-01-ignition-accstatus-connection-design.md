# 시동 감지(accStatus) + 연결 판정 재설계 — Design

**Date:** 2026-07-01
**Branch:** `cc-ignition-accstatus` (off `dev`)
**Status:** Approved (design), pending spec review

---

## 1. 배경 / 문제

현재 시동(ignition) 상태는 **시간 간격 휴리스틱**으로 추정한다: 직전 수신과의 gap이
5분 이내면 ON, 넘으면 OFF (`TelemetryIngestionService.deriveIgnition`,
`IGNITION_ON_GAP_THRESHOLD = 5분`). 이는 실제 시동 신호가 아니라 "데이터가 계속
들어오는가"에 대한 근사치라 부정확하다.

OTOPLUG 단말은 실제 시동(ACC) 신호를 **`accStatus`** 정수 필드로 보낸다:

- `accStatus == 0` → 시동 OFF
- `accStatus != 0` → 시동 ON

이 필드는 OTOPLUG NT `drivingDetail`(FMS 실시간) 페이로드의 `tripData[]` 각
레코드에 포함된다(`scripts/otoplug/OTOPLUG_NT_API.md:142`). 보고 주기는 **시동
상태에 종속**한다:

- **시동 ON:** 약 1~2분 주기(빠름)
- **시동 OFF:** 약 1시간 주기 keep-alive(느림)
- 시동 **전환** 시에도 NT가 발생한다.

현재 이 `accStatus`는 `rawPayload`(JSONB)에만 저장되고 **버려진다**. 이를
1급 신호로 승격해 시동 파생을 대체한다.

동시에 연결(reachability) 판정도 재검토한다. 현재
`TelemetryConnection.status`는 마지막 수신 후 **120분** 무수신이면 OFFLINE인
단일 임계값이다. 보고 주기가 시동 상태에 따라 크게 다르므로(ON 1~2분 / OFF
1시간), 단일 120분 임계값은 시동 ON 차량의 단선을 너무 늦게 감지한다.

---

## 2. 목표 / 비목표

**목표**
- 시동 파생을 gap 휴리스틱 → `accStatus` 명시 신호 기반으로 전환.
- 연결 임계값을 시동 상태에 종속하는 이중 임계값으로 변경: ON=2분, OFF/UNKNOWN=120분.
- 마이그레이션 없이(스키마 무변경) 구현.

**비목표**
- `accStatus`를 별도 컬럼으로 영속화하지 않는다(파생에만 사용, 원본은 rawPayload에 이미 보존).
- 마커/차량상세의 상태 칩 표시 로직(라벨·색)은 변경하지 않는다 — `drivingStatus`/`connectionStatus` 값의 계산 방식만 바뀌고 소비 방식은 동일.
- 폴링(`VendorTelemetryAdapter`) 경로에 accStatus를 강제하지 않는다 — 폴링 이벤트는 accStatus 없음(null)으로 들어와 carry-forward 폴백을 탄다.

---

## 3. 데이터 흐름

```
OTOPLUG NT (drivingDetail tripData[].accStatus)
  → POST /api/otoplug/nt/driving-detail   (Next.js: route.ts)
      · toIngest(): rec.accStatus 추출 → IngestBody.accStatus
  → POST /api/v1/telemetry/device-events  (Java: TelemetryIngestionController)
      · @RequestBody TelemetryIngestRequest.accStatus (신규 필드, JSON 바인딩)
  → TelemetryIngestionService.ingest()
      · deriveIgnition(bikeId, request.accStatus())  → ignition_status 저장
  → 대시보드/라이더/차량상세 read 경로
      · TelemetryConnection.status(lastReceivedAt, now, ignitionStatus) → ONLINE/OFFLINE
```

`accStatus`는 시동 파생에만 쓰이고 DB에 별도 저장되지 않는다. 원본은 rawPayload에
남는다.

---

## 4. 상세 설계

### 4.1 시동 파생 (`TelemetryIngestionService`)

**변경:**
- `IGNITION_ON_GAP_THRESHOLD` 상수 삭제. 관련 `java.time.Duration` import가 파일 내에서 더 이상 안 쓰이면 함께 삭제(컴파일 시 확인). `java.time.Instant` import도 다른 사용처 없으면 삭제.
- `deriveIgnition` 시그니처: `deriveIgnition(UUID bikeId, Instant receivedAt)` → `deriveIgnition(UUID bikeId, Integer accStatus)`.
- `ingest()` 호출부(현재 91행): `deriveIgnition(bikeId, request.receivedAt())` → `deriveIgnition(bikeId, request.accStatus())`.

**새 로직** (가시성은 `private` → **package-private**으로 승격, 단위 테스트 직접 호출용):
```java
TelemetryIgnitionStatus deriveIgnition(UUID bikeId, Integer accStatus) {
    // 명시 신호 우선: 0 = OFF, 그 외 = ON
    if (accStatus != null) {
        return accStatus != 0 ? TelemetryIgnitionStatus.ON : TelemetryIgnitionStatus.OFF;
    }
    // accStatus 미수신 → 직전 상태 유지(carry-forward)
    if (bikeId == null) {
        return TelemetryIgnitionStatus.UNKNOWN;
    }
    return bikeCurrentStateRepository.findByBikeId(bikeId)
            .map(BikeCurrentState::getIgnitionStatus)
            .orElse(TelemetryIgnitionStatus.UNKNOWN);
}
```

**폴백 근거:** `accStatus`가 없는 이벤트(폴링, 또는 `driving` NT가 accStatus를
안 싣는 경우)에서 gap 휴리스틱을 재도입하면 우리가 없애려는 flapping이 돌아온다.
직전 상태 carry-forward가 안전하다. `drivingDetail`이 1분마다 명시 신호를
계속 보내므로 사이사이 carry-forward가 상태를 왜곡하지 않는다.

### 4.2 연결 판정 (`TelemetryConnection`)

**변경:** 단일 `OFFLINE_THRESHOLD`(120분)를 이중 임계값으로 교체하고 시그니처에
시동 상태를 추가한다.

```java
public final class TelemetryConnection {

    /** 시동 ON: 보고 주기 빠름(~1분) → 2분 무수신이면 미연결. */
    public static final Duration IGNITION_ON_OFFLINE_THRESHOLD = Duration.ofMinutes(2);

    /** 시동 OFF/UNKNOWN: 보고 주기 느림(~1시간 keep-alive) → 120분 무수신이면 미연결. */
    public static final Duration DEFAULT_OFFLINE_THRESHOLD = Duration.ofMinutes(120);

    private TelemetryConnection() {}

    /** "ONLINE"/"OFFLINE". 임계값은 시동 상태에 종속(ON=2분, 그 외=120분). */
    public static String status(Instant lastReceivedAt, Instant now, TelemetryIgnitionStatus ignition) {
        if (lastReceivedAt == null) {
            return "OFFLINE";
        }
        Duration threshold = ignition == TelemetryIgnitionStatus.ON
                ? IGNITION_ON_OFFLINE_THRESHOLD
                : DEFAULT_OFFLINE_THRESHOLD;
        Duration age = Duration.between(lastReceivedAt, now);
        return age.compareTo(threshold) <= 0 ? "ONLINE" : "OFFLINE";
    }
}
```

- `TelemetryIgnitionStatus`는 같은 `...telemetry.domain` 패키지라 import 불필요.
- `null lastReceivedAt` → OFFLINE(수신 이력 없음). 기존 API는 null을 넘기지 않았으나 방어적으로 처리.

**호출부 3곳** — 각자 보유한 시동 상태를 세 번째 인자로 넘긴다:
- `DashboardMapStateService.connectionStatus(row, generatedAt)` (194행): `TelemetryConnection.status(row.lastReceivedAt(), generatedAt, row.ignitionStatus())`.
- `RiderVehicleReadService.getMyVehicle` (56행): `TelemetryConnection.status(state.getLastReceivedAt(), Instant.now(clock), state.getIgnitionStatus())`.
- `BikeCurrentStateReadResponse.connectionStatus(state, clock)` (61행): `TelemetryConnection.status(state.getLastReceivedAt(), Instant.now(clock), state.getIgnitionStatus())`.

### 4.3 DTO (`TelemetryIngestRequest`)

`speedKph`와 `telemetrySource` 사이에 nullable `Integer accStatus`를 추가한다
(위치는 JSON 바인딩에 무관하나 의미상 텔레메트리 측정치 그룹에 배치):

```java
public record TelemetryIngestRequest(
        @NotBlank @Size(max = 100) String deviceUid,
        @Size(max = 200) String vendorEventId,
        @NotNull Instant receivedAt,
        Instant deviceReportedAt,
        @DecimalMin("-90.0") @DecimalMax("90.0") BigDecimal latitude,
        @DecimalMin("-180.0") @DecimalMax("180.0") BigDecimal longitude,
        @PositiveOrZero BigDecimal speedKph,
        Integer accStatus,          // 신규: OTOPLUG ACC 신호(0=OFF, 그 외=ON). null 가능.
        @NotNull TelemetrySource telemetrySource,
        JsonNode rawPayload
) {}
```

- 검증 애너테이션 없음(임의 정수 허용, nullable).
- `@JsonIgnoreProperties(ignoreUnknown = true)` 유지 → JSON에 accStatus 없으면 null 바인딩.

### 4.4 NT 수신부 (`route.ts`)

`IngestBody`에 `accStatus?: number` 추가. `toIngest`에서 `rec.accStatus`를
**안전하게** 읽는다 — **`Number(null) === 0` 함정 주의**: 필드가 없거나 null이면
`undefined`(미전송=carry-forward), 실제 숫자일 때만 값 사용.

```ts
interface IngestBody {
  deviceUid: string;
  vendorEventId: string;
  receivedAt: string;
  latitude: number;
  longitude: number;
  speedKph: number;
  accStatus?: number;          // 신규
  telemetrySource: "WEBHOOK";
  rawPayload: unknown;
}

// toIngest 내부, speedKph 계산 뒤:
function readAccStatus(rec: Record<string, unknown>): number | undefined {
  const v = rec.accStatus;
  if (v === null || v === undefined) return undefined;   // 미전송 → 미포함
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
// ...
const accStatus = readAccStatus(rec);
return {
  deviceUid: imei,
  vendorEventId: `${imei}:${timeStr ?? Date.now()}`,
  receivedAt,
  latitude: lat,
  longitude: lng,
  speedKph,
  accStatus,                   // undefined면 JSON.stringify가 키를 생략 → 백엔드 null
  telemetrySource: "WEBHOOK",
  rawPayload: rec,
};
```

- `driving`·`driving-detail` 양쪽 모두 같은 `toIngest`를 타므로, `rec`에
  accStatus가 있으면 자동 추출된다. `driving`의 `drivingData`에 accStatus가
  없으면 `undefined` → carry-forward(안전).

### 4.5 마이그레이션

**없음.** `ignition_status` 컬럼과 `TelemetryIgnitionStatus` enum
(UNKNOWN/ON/OFF)은 그대로. accStatus는 파생에만 쓰고 버린다. 연결은 read-time
계산. DB 스키마 무변경.

---

## 5. 상태 결합(마커/차량상세) 영향

`ignitionStatus`와 `connectionStatus`는 read 응답에서 **직교 필드**로 계속 나간다:
- `drivingStatus` = f(ignition, speed): UNKNOWN→UNKNOWN, OFF→PARKED, ON→(speed≥3?DRIVING:STOPPED). 로직 불변, 입력 ignition만 accStatus 기반으로 정확해짐.
- `connectionStatus` = f(lastReceivedAt, now, ignition): 임계값이 ignition에 종속되도록 변경.

동작 변화 예:
- **주행 중 차량 단선:** ignition 마지막값 ON 유지 → 2분 후 OFFLINE. (기존 gap은 5분 후 OFF로 뒤집었음 → 이제 시동은 마지막 실측 유지, 단선은 연결로 표현되어 더 정확.)
- **주차 차량:** accStatus=0 → OFF, 1시간 keep-alive, 120분 임계 → 정상 ONLINE 유지(오탐 없음).

---

## 6. 테스트 전략 (TDD)

**신규 백엔드 단위 테스트**
- `TelemetryConnection.status`:
  - ON + age 1분 → ONLINE
  - ON + age 3분 → OFFLINE
  - OFF + age 90분 → ONLINE
  - OFF + age 130분 → OFFLINE
  - UNKNOWN + age 30분 → ONLINE (120분 임계 적용)
  - lastReceivedAt = null → OFFLINE
- `TelemetryIngestionService.deriveIgnition` — **package-private으로 승격**해 직접 단위 테스트한다. 인자 없는(accStatus만) 케이스는 순수, carry-forward 케이스만 `bikeCurrentStateRepository`를 Mockito로 목킹:
  - accStatus=0 → OFF (repo 미접근)
  - accStatus=5 → ON (repo 미접근)
  - accStatus=null + repo가 직전 ON 반환 → ON (carry-forward)
  - accStatus=null + repo empty → UNKNOWN
  - accStatus=null + bikeId=null → UNKNOWN (repo 미접근)
  - 테스트는 서비스 생성자에 목 레포지토리들을 주입해 인스턴스를 만들고 `deriveIgnition`를 직접 호출한다(전체 `ingest()` 경유 불필요).

**기존 백엔드 테스트 수정**
- `VendorTelemetryAdapterTests.sampleEvent`(97행): 새 `accStatus` 인자(예: `null`)를 포함해 10-인자 생성자로 갱신.

**프론트엔드 테스트**
- `route.ts`용 신규 단위 테스트(`toIngest`/`readAccStatus`):
  - `rec.accStatus = 0` → body에 `accStatus: 0` 포함
  - `rec.accStatus = 3` → `accStatus: 3`
  - `rec.accStatus` 없음/`null` → body에 accStatus 키 없음(undefined)
  - `readAccStatus`가 `Number(null)===0` 함정을 피하는지(=null→undefined) 명시 검증
  - 검증 실행: `npx tsx --test <file>` (프로젝트의 npm test는 Windows tsx 버그 있음).

---

## 7. 엣지 케이스

- **`Number(null) === 0` 함정:** JSON `accStatus: null`(미전송)을 0(OFF)으로 오독하면 주행 중 차량이 OFF로 표시될 수 있음. `readAccStatus`가 null/undefined를 명시 배제해 방지.
- **`full` vs `simple` 출력 모드:** observer가 `full`이면 미전송 필드가 0/null/-9999로 채워질 수 있으나, accStatus=0은 어차피 OFF로 매핑되어 비주행 차량엔 무해. null은 carry-forward.
- **ON 임계값 2분의 민감도:** 보고 주기(~1~2분)와 근접해 보고 1회 지연 시 잠깐 OFFLINE 깜빡임 가능. "즉시 감지" 우선의 명시 선택으로 수용. (완화 필요 시 `IGNITION_ON_OFFLINE_THRESHOLD`만 3분으로 조정.)
- **`driving` NT(accStatus 미포함 가능):** 주행 중에만 ~60초 발생하므로 carry-forward가 직전 `drivingDetail` 기반 ON을 유지 → 왜곡 없음.
- **배치(tripData[]) 순서:** 각 레코드가 개별 ingest되고 `upsertBikeCurrentStateIfNewer`가 최신 수신시각만 반영하므로, 배치 내 가장 마지막 레코드의 accStatus가 current-state 시동을 결정.

---

## 8. 손대는 파일 요약

| 파일 | 변경 |
|------|------|
| `development/frontend/app/api/otoplug/nt/[type]/route.ts` | `IngestBody.accStatus`, `readAccStatus`, `toIngest` |
| `development/backend/.../telemetry/dto/TelemetryIngestRequest.java` | `Integer accStatus` 필드 추가 |
| `development/backend/.../telemetry/service/TelemetryIngestionService.java` | `deriveIgnition` 재작성, 호출부, 상수/import 정리 |
| `development/backend/.../telemetry/domain/TelemetryConnection.java` | 이중 임계값 + 시그니처 변경 |
| `development/backend/.../dashboard/service/DashboardMapStateService.java` | connection 호출부에 ignition 전달 |
| `development/backend/.../rider/service/RiderVehicleReadService.java` | connection 호출부에 ignition 전달 |
| `development/backend/.../telemetry/dto/BikeCurrentStateReadResponse.java` | connection 호출부에 ignition 전달 |
| `development/backend/.../test/.../VendorTelemetryAdapterTests.java` | `sampleEvent` 생성자 인자 갱신 |
| (신규) 백엔드 `TelemetryConnection`/ignition 단위 테스트 | 신규 |
| (신규) 프론트 `route.ts` 단위 테스트 | 신규 |
