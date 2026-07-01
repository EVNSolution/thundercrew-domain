# 시동 감지(accStatus) + 연결 이중임계값 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 시동 상태를 OTOPLUG `accStatus`(0=OFF, ≠0=ON) 명시 신호로 파생하고, 연결 판정을 시동 상태 종속 이중 임계값(ON=2분, OFF/UNKNOWN=120분)으로 전환한다.

**Architecture:** 백엔드 `TelemetryIngestRequest`에 nullable `Integer accStatus`를 추가하고 `deriveIgnition`이 이를 직접 사용(미수신 시 직전 상태 carry-forward). `TelemetryConnection.status`는 시동 상태를 인자로 받아 임계값을 선택. NT 수신부(Next.js `route.ts`)는 `Number(null)===0` 함정을 피하는 순수 헬퍼 `readAccStatus`로 `accStatus`를 안전 추출. DB 스키마·마이그레이션 변경 없음.

**Tech Stack:** Java 21 / Spring Boot / Gradle (backend), Next.js 16 App Router / TypeScript (frontend). 백엔드 단위 테스트는 JUnit5+Mockito(Docker 불필요), 프론트 테스트는 `node --experimental-strip-types --test`.

**Worktree:** 모든 경로는 워크트리 루트 기준. 작업 디렉터리:
`C:\Users\user\.config\superpowers\worktrees\thundercrew-domain\cc-ignition-accstatus`
(브랜치 `cc-ignition-accstatus`, `dev`에서 분기)

**Reference spec:** `docs/superpowers/specs/2026-07-01-ignition-accstatus-connection-design.md`

---

## Task 1: DTO에 `accStatus` 필드 추가 (컴파일 게이트)

시동 파생이 참조할 `accStatus`를 요청 DTO에 추가한다. 이 record의 유일한 위치 기반 생성자 호출처는 `VendorTelemetryAdapterTests.sampleEvent`이므로 함께 갱신해 스위트가 계속 컴파일되게 한다.

**Files:**
- Modify: `development/backend/src/main/java/com/thundercrew/opsapi/telemetry/dto/TelemetryIngestRequest.java`
- Modify: `development/backend/src/test/java/com/thundercrew/opsapi/VendorTelemetryAdapterTests.java:96-107`

- [ ] **Step 1: DTO에 `Integer accStatus` 필드 추가**

`TelemetryIngestRequest.java`의 `speedKph`와 `telemetrySource` 사이에 필드를 삽입한다. 최종 record 본문:

```java
@JsonIgnoreProperties(ignoreUnknown = true)
public record TelemetryIngestRequest(
        @NotBlank @Size(max = 100) String deviceUid,
        @Size(max = 200) String vendorEventId,
        @NotNull Instant receivedAt,
        Instant deviceReportedAt,
        @DecimalMin("-90.0") @DecimalMax("90.0") BigDecimal latitude,
        @DecimalMin("-180.0") @DecimalMax("180.0") BigDecimal longitude,
        @PositiveOrZero BigDecimal speedKph,
        Integer accStatus,
        @NotNull TelemetrySource telemetrySource,
        JsonNode rawPayload
) {
}
```

(검증 애너테이션 없음 — 임의 정수·nullable 허용. `@JsonIgnoreProperties(ignoreUnknown = true)`는 그대로 두어 JSON에 accStatus가 없으면 null 바인딩.)

- [ ] **Step 2: `VendorTelemetryAdapterTests.sampleEvent` 생성자 인자 갱신**

`sampleEvent`(96-107행)의 생성자 호출에 `speedKph` 다음, `telemetrySource` 앞에 `null`(accStatus)을 추가한다. 최종 메서드:

```java
    private static TelemetryIngestRequest sampleEvent(String deviceUid, Instant receivedAt) {
        return new TelemetryIngestRequest(
                deviceUid,
                "vendor-event-" + deviceUid,
                receivedAt,
                receivedAt,
                new BigDecimal("37.5005000"),
                new BigDecimal("127.0270000"),
                new BigDecimal("12.5"),
                null,
                TelemetrySource.POLLING,
                null);
    }
```

- [ ] **Step 3: 기존 테스트가 그대로 통과하는지 확인**

Run: `cd development/backend && ./gradlew.bat test --tests "com.thundercrew.opsapi.VendorTelemetryAdapterTests"`
Expected: BUILD SUCCESSFUL, 관련 테스트 PASS (Docker 불필요).

- [ ] **Step 4: 커밋**

```bash
cd development/backend
git add src/main/java/com/thundercrew/opsapi/telemetry/dto/TelemetryIngestRequest.java src/test/java/com/thundercrew/opsapi/VendorTelemetryAdapterTests.java
git commit -m "$(cat <<'EOF'
feat(telemetry): TelemetryIngestRequest에 accStatus 필드 추가

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `deriveIgnition`을 accStatus 기반으로 전환

5분 gap 휴리스틱을 폐기하고 `accStatus`(0=OFF/≠0=ON)를 직접 사용한다. 미수신(null)이면 직전 상태 carry-forward, 없으면 UNKNOWN. 테스트 용이성을 위해 `deriveIgnition`을 package-private으로 승격한다.

**Files:**
- Create: `development/backend/src/test/java/com/thundercrew/opsapi/telemetry/service/TelemetryIgnitionDerivationTests.java`
- Modify: `development/backend/src/main/java/com/thundercrew/opsapi/telemetry/service/TelemetryIngestionService.java` (상수·import 정리, 91행 호출부, 212-224행 메서드)

- [ ] **Step 1: 실패하는 단위 테스트 작성**

새 파일 `.../telemetry/service/TelemetryIgnitionDerivationTests.java`:

```java
package com.thundercrew.opsapi.telemetry.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.thundercrew.opsapi.telemetry.domain.BikeCurrentState;
import com.thundercrew.opsapi.telemetry.domain.TelemetryIgnitionStatus;
import com.thundercrew.opsapi.telemetry.repository.BikeCurrentStateRepository;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class TelemetryIgnitionDerivationTests {

    private final BikeCurrentStateRepository currentStateRepository =
            mock(BikeCurrentStateRepository.class);

    // deriveIgnition은 9번째 생성자 인자(bikeCurrentStateRepository)만 사용하므로
    // 나머지 8개 의존성은 null로 두어도 무방하다.
    private TelemetryIngestionService newService() {
        return new TelemetryIngestionService(
                null, null, null, null, null, null, null, null, currentStateRepository);
    }

    @Test
    void accStatusZeroIsOff() {
        assertThat(newService().deriveIgnition(UUID.randomUUID(), 0))
                .isEqualTo(TelemetryIgnitionStatus.OFF);
    }

    @Test
    void accStatusNonZeroIsOn() {
        assertThat(newService().deriveIgnition(UUID.randomUUID(), 5))
                .isEqualTo(TelemetryIgnitionStatus.ON);
    }

    @Test
    void nullAccStatusCarriesForwardPreviousStatus() {
        UUID bikeId = UUID.randomUUID();
        BikeCurrentState previous = mock(BikeCurrentState.class);
        when(previous.getIgnitionStatus()).thenReturn(TelemetryIgnitionStatus.ON);
        when(currentStateRepository.findByBikeId(bikeId)).thenReturn(Optional.of(previous));

        assertThat(newService().deriveIgnition(bikeId, null))
                .isEqualTo(TelemetryIgnitionStatus.ON);
    }

    @Test
    void nullAccStatusWithNoPreviousIsUnknown() {
        UUID bikeId = UUID.randomUUID();
        when(currentStateRepository.findByBikeId(bikeId)).thenReturn(Optional.empty());

        assertThat(newService().deriveIgnition(bikeId, null))
                .isEqualTo(TelemetryIgnitionStatus.UNKNOWN);
    }

    @Test
    void nullAccStatusWithNullBikeIdIsUnknown() {
        assertThat(newService().deriveIgnition(null, null))
                .isEqualTo(TelemetryIgnitionStatus.UNKNOWN);
    }
}
```

- [ ] **Step 2: 테스트가 실패(컴파일 에러)하는지 확인**

Run: `cd development/backend && ./gradlew.bat test --tests "com.thundercrew.opsapi.telemetry.service.TelemetryIgnitionDerivationTests"`
Expected: FAIL — 컴파일 에러(`deriveIgnition(UUID, Integer)`가 아직 없고 `deriveIgnition`이 private).

- [ ] **Step 3: `deriveIgnition` 재작성 + 호출부·상수·import 정리**

`TelemetryIngestionService.java`에서:

(a) 38행 상수 삭제:
```java
    private static final Duration IGNITION_ON_GAP_THRESHOLD = Duration.ofMinutes(5);
```

(b) 이제 미사용이 된 import 삭제 (26-27행):
```java
import java.time.Duration;
import java.time.Instant;
```
(둘 다 이 변경 후 파일 내에서 참조되지 않는다. 컴파일이 여전히 필요하다고 하면 남긴다 — 정상 구현에서는 삭제된다.)

(c) 91행 호출부 변경:
```java
        TelemetryIgnitionStatus derivedIgnition = deriveIgnition(bikeId, request.accStatus());
```

(d) 212-224행 메서드를 아래로 교체 (가시성 `private` → package-private):
```java
    TelemetryIgnitionStatus deriveIgnition(UUID bikeId, Integer accStatus) {
        // 명시 ACC 신호 우선: 0 = OFF, 그 외 = ON
        if (accStatus != null) {
            return accStatus != 0 ? TelemetryIgnitionStatus.ON : TelemetryIgnitionStatus.OFF;
        }
        // accStatus 미수신 → 직전 상태 carry-forward, 없으면 UNKNOWN
        if (bikeId == null) {
            return TelemetryIgnitionStatus.UNKNOWN;
        }
        return bikeCurrentStateRepository.findByBikeId(bikeId)
                .map(BikeCurrentState::getIgnitionStatus)
                .orElse(TelemetryIgnitionStatus.UNKNOWN);
    }
```

- [ ] **Step 4: 새 테스트 + 기존 어댑터 테스트 통과 확인**

Run: `cd development/backend && ./gradlew.bat test --tests "com.thundercrew.opsapi.telemetry.service.TelemetryIgnitionDerivationTests" --tests "com.thundercrew.opsapi.VendorTelemetryAdapterTests"`
Expected: BUILD SUCCESSFUL, 5개 신규 테스트 + 어댑터 테스트 PASS.

- [ ] **Step 5: 커밋**

```bash
cd development/backend
git add src/main/java/com/thundercrew/opsapi/telemetry/service/TelemetryIngestionService.java src/test/java/com/thundercrew/opsapi/telemetry/service/TelemetryIgnitionDerivationTests.java
git commit -m "$(cat <<'EOF'
feat(telemetry): 시동 파생을 accStatus 기반으로 전환 (gap 휴리스틱 제거)

accStatus 0=OFF/≠0=ON, 미수신 시 직전 상태 carry-forward.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `TelemetryConnection` 시동 종속 이중 임계값

단일 120분 임계값을 시동 상태에 종속하는 이중 임계값(ON=2분, OFF/UNKNOWN=120분)으로 바꾸고, 시그니처에 시동 상태를 추가한다. 호출부 3곳을 갱신한다.

**Files:**
- Create: `development/backend/src/test/java/com/thundercrew/opsapi/telemetry/domain/TelemetryConnectionTests.java`
- Modify: `development/backend/src/main/java/com/thundercrew/opsapi/telemetry/domain/TelemetryConnection.java`
- Modify: `development/backend/src/main/java/com/thundercrew/opsapi/dashboard/service/DashboardMapStateService.java:193-195`
- Modify: `development/backend/src/main/java/com/thundercrew/opsapi/rider/service/RiderVehicleReadService.java:56`
- Modify: `development/backend/src/main/java/com/thundercrew/opsapi/telemetry/dto/BikeCurrentStateReadResponse.java:60-62`

- [ ] **Step 1: 실패하는 단위 테스트 작성**

새 파일 `.../telemetry/domain/TelemetryConnectionTests.java`:

```java
package com.thundercrew.opsapi.telemetry.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class TelemetryConnectionTests {

    private static final Instant NOW = Instant.parse("2026-07-01T00:00:00Z");

    private static Instant ago(Duration d) {
        return NOW.minus(d);
    }

    @Test
    void ignitionOnWithinTwoMinutesIsOnline() {
        assertThat(TelemetryConnection.status(ago(Duration.ofMinutes(1)), NOW, TelemetryIgnitionStatus.ON))
                .isEqualTo("ONLINE");
    }

    @Test
    void ignitionOnBeyondTwoMinutesIsOffline() {
        assertThat(TelemetryConnection.status(ago(Duration.ofMinutes(3)), NOW, TelemetryIgnitionStatus.ON))
                .isEqualTo("OFFLINE");
    }

    @Test
    void ignitionOffWithin120MinutesIsOnline() {
        assertThat(TelemetryConnection.status(ago(Duration.ofMinutes(90)), NOW, TelemetryIgnitionStatus.OFF))
                .isEqualTo("ONLINE");
    }

    @Test
    void ignitionOffBeyond120MinutesIsOffline() {
        assertThat(TelemetryConnection.status(ago(Duration.ofMinutes(130)), NOW, TelemetryIgnitionStatus.OFF))
                .isEqualTo("OFFLINE");
    }

    @Test
    void unknownIgnitionUsesLaxThreshold() {
        assertThat(TelemetryConnection.status(ago(Duration.ofMinutes(30)), NOW, TelemetryIgnitionStatus.UNKNOWN))
                .isEqualTo("ONLINE");
    }

    @Test
    void nullLastReceivedIsOffline() {
        assertThat(TelemetryConnection.status(null, NOW, TelemetryIgnitionStatus.ON))
                .isEqualTo("OFFLINE");
    }
}
```

- [ ] **Step 2: 테스트가 실패(컴파일 에러)하는지 확인**

Run: `cd development/backend && ./gradlew.bat test --tests "com.thundercrew.opsapi.telemetry.domain.TelemetryConnectionTests"`
Expected: FAIL — 컴파일 에러(`status(Instant, Instant, TelemetryIgnitionStatus)` 3-인자 오버로드가 아직 없음).

- [ ] **Step 3: `TelemetryConnection` 교체**

`TelemetryConnection.java` 전체를 아래로 교체:

```java
package com.thundercrew.opsapi.telemetry.domain;

import java.time.Duration;
import java.time.Instant;

/** 마지막 수신 시각 + 시동 상태 기준 연결 판정. 시동 ON=2분, OFF/UNKNOWN=120분 무수신이면 OFFLINE. */
public final class TelemetryConnection {

    /** 시동 ON: 보고 주기 빠름(~1분) → 2분 무수신이면 미연결. */
    public static final Duration IGNITION_ON_OFFLINE_THRESHOLD = Duration.ofMinutes(2);

    /** 시동 OFF/UNKNOWN: 보고 주기 느림(~1시간 keep-alive) → 120분 무수신이면 미연결. */
    public static final Duration DEFAULT_OFFLINE_THRESHOLD = Duration.ofMinutes(120);

    private TelemetryConnection() {
    }

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

- [ ] **Step 4: 호출부 3곳에 시동 상태 전달**

(a) `DashboardMapStateService.java` — `connectionStatus` 메서드(193-195행). `BikePinRow`에 이미 `ignitionStatus()`가 있다. 교체:
```java
    private String connectionStatus(BikePinRow row, Instant generatedAt) {
        return TelemetryConnection.status(row.lastReceivedAt(), generatedAt, row.ignitionStatus());
    }
```

(b) `RiderVehicleReadService.java` — 56행. 교체:
```java
            connection = TelemetryConnection.status(state.getLastReceivedAt(), Instant.now(clock), state.getIgnitionStatus());
```

(c) `BikeCurrentStateReadResponse.java` — `connectionStatus` 메서드(60-62행). 교체:
```java
    private static String connectionStatus(BikeCurrentState state, Clock clock) {
        return TelemetryConnection.status(state.getLastReceivedAt(), Instant.now(clock), state.getIgnitionStatus());
    }
```

- [ ] **Step 5: 새 테스트 통과 + 호출부 컴파일 확인**

Run: `cd development/backend && ./gradlew.bat test --tests "com.thundercrew.opsapi.telemetry.domain.TelemetryConnectionTests"`
Expected: BUILD SUCCESSFUL, 6개 신규 테스트 PASS. (컴파일 성공 = 3 호출부 시그니처 정합.)

- [ ] **Step 6: 커밋**

```bash
cd development/backend
git add src/main/java/com/thundercrew/opsapi/telemetry/domain/TelemetryConnection.java src/test/java/com/thundercrew/opsapi/telemetry/domain/TelemetryConnectionTests.java src/main/java/com/thundercrew/opsapi/dashboard/service/DashboardMapStateService.java src/main/java/com/thundercrew/opsapi/rider/service/RiderVehicleReadService.java src/main/java/com/thundercrew/opsapi/telemetry/dto/BikeCurrentStateReadResponse.java
git commit -m "$(cat <<'EOF'
feat(telemetry): 연결 판정을 시동 종속 이중 임계값으로 (ON=2분, OFF=120분)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: NT 수신부 `readAccStatus` 헬퍼 + route.ts 배선

`accStatus`를 안전하게 읽는 순수 헬퍼를 만들고(핵심: `Number(null)===0` 함정 방지), `route.ts`가 이를 사용해 ingest 바디에 `accStatus`를 싣게 한다.

**Files:**
- Create: `development/frontend/lib/services/otoplug-acc-status.ts`
- Create: `development/frontend/lib/services/otoplug-acc-status.test.mjs`
- Modify: `development/frontend/app/api/otoplug/nt/[type]/route.ts` (import, `IngestBody`, `toIngest`)
- Modify: `development/frontend/package.json:12` (test 스크립트에 새 테스트 추가)

- [ ] **Step 1: 실패하는 단위 테스트 작성**

새 파일 `development/frontend/lib/services/otoplug-acc-status.test.mjs`:

```mjs
import assert from "node:assert/strict";
import test from "node:test";

import { readAccStatus } from "./otoplug-acc-status.ts";

test("accStatus 0 is read as 0 (ignition OFF)", () => {
  assert.equal(readAccStatus({ accStatus: 0 }), 0);
});

test("non-zero accStatus is read through (ignition ON)", () => {
  assert.equal(readAccStatus({ accStatus: 3 }), 3);
});

test("numeric string accStatus is parsed", () => {
  assert.equal(readAccStatus({ accStatus: "1" }), 1);
});

test("missing accStatus is undefined (not 0)", () => {
  assert.equal(readAccStatus({}), undefined);
});

test("null accStatus is undefined, avoiding the Number(null)===0 trap", () => {
  assert.equal(readAccStatus({ accStatus: null }), undefined);
});

test("non-numeric accStatus is undefined", () => {
  assert.equal(readAccStatus({ accStatus: "abc" }), undefined);
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd development/frontend && node --experimental-strip-types --test lib/services/otoplug-acc-status.test.mjs`
Expected: FAIL — `otoplug-acc-status.ts` 모듈이 없어 import 에러.

- [ ] **Step 3: 순수 헬퍼 구현**

새 파일 `development/frontend/lib/services/otoplug-acc-status.ts`:

```ts
/**
 * Safely read the OTOPLUG ACC (ignition) signal from a telemetry record.
 *
 * accStatus semantics: 0 = ignition OFF, non-zero = ignition ON.
 *
 * Guards against the `Number(null) === 0` trap: a missing or null field means
 * "not reported" and must NOT be coerced to 0 (which would look like OFF).
 * Returns undefined for absent / non-numeric values so the backend falls back
 * to carrying forward the previous ignition state.
 */
export function readAccStatus(rec: Record<string, unknown>): number | undefined {
  const value = rec.accStatus;
  if (value === null || value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd development/frontend && node --experimental-strip-types --test lib/services/otoplug-acc-status.test.mjs`
Expected: `# pass 6`, `# fail 0`.

- [ ] **Step 5: `route.ts` 배선**

`development/frontend/app/api/otoplug/nt/[type]/route.ts`에서 3곳 수정.

(a) 파일 맨 위(현재 1행 `export const dynamic = "force-dynamic";` 위)에 import 추가:
```ts
import { readAccStatus } from "@/lib/services/otoplug-acc-status";

export const dynamic = "force-dynamic";
```

(b) `IngestBody` 인터페이스(25-34행)에 `speedKph` 다음, `telemetrySource` 앞에 `accStatus?: number;` 추가:
```ts
interface IngestBody {
  deviceUid: string;
  vendorEventId: string;
  receivedAt: string;
  latitude: number;
  longitude: number;
  speedKph: number;
  accStatus?: number;
  telemetrySource: "WEBHOOK";
  rawPayload: unknown;
}
```

(c) `toIngest`의 return 객체(80-89행)에서 `speedKph` 다음에 `accStatus: readAccStatus(rec),` 추가:
```ts
  return {
    deviceUid: imei,
    vendorEventId: `${imei}:${timeStr ?? Date.now()}`,
    receivedAt,
    latitude: lat,
    longitude: lng,
    speedKph,
    accStatus: readAccStatus(rec),
    telemetrySource: "WEBHOOK",
    rawPayload: rec,
  };
```
(`accStatus`가 `undefined`면 `JSON.stringify`가 키를 생략 → 백엔드에서 null → carry-forward.)

- [ ] **Step 6: 프론트 test 스크립트에 새 테스트 추가**

`development/frontend/package.json`의 `test:service-ops`(12행) 끝에 새 테스트 파일을 추가:
```json
    "test:service-ops": "node --experimental-strip-types --test lib/services/service-ops-api.test.mjs lib/services/service-ops-session-core.test.mjs lib/services/real-vehicle-playback.test.mjs lib/services/otoplug-acc-status.test.mjs"
```

- [ ] **Step 7: 프론트 의존성 확인 후 타입체크/린트**

Run:
```bash
cd development/frontend
[ -d node_modules ] || npm install
npm run typecheck
npm run lint
```
Expected: `typecheck` 에러 없음(`@/lib/services/otoplug-acc-status` import 해석, `IngestBody`/`toIngest` 타입 정합), `lint` 에러 없음.

- [ ] **Step 8: 커밋**

```bash
cd development/frontend
git add lib/services/otoplug-acc-status.ts lib/services/otoplug-acc-status.test.mjs app/api/otoplug/nt/\[type\]/route.ts package.json
git commit -m "$(cat <<'EOF'
feat(otoplug): NT 수신부에서 accStatus 안전 추출 후 ingest에 전달

readAccStatus가 Number(null)===0 함정을 피해 미전송/비숫자는 undefined 처리.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 최종 검증 + PR

전체 변경을 함께 검증하고 `dev`로 PR을 만든다.

**Files:** (없음 — 검증·PR만)

- [ ] **Step 1: 백엔드 신규/영향 테스트 일괄 실행**

Run:
```bash
cd development/backend && ./gradlew.bat test \
  --tests "com.thundercrew.opsapi.telemetry.domain.TelemetryConnectionTests" \
  --tests "com.thundercrew.opsapi.telemetry.service.TelemetryIgnitionDerivationTests" \
  --tests "com.thundercrew.opsapi.VendorTelemetryAdapterTests"
```
Expected: BUILD SUCCESSFUL, 전부 PASS.

- [ ] **Step 2: 백엔드 메인 소스 컴파일 확인 (호출부 정합)**

Run: `cd development/backend && ./gradlew.bat compileJava`
Expected: BUILD SUCCESSFUL (Dashboard/Rider/BikeCurrentStateReadResponse 호출부 정합).

- [ ] **Step 3: 프론트 검증**

Run:
```bash
cd development/frontend
[ -d node_modules ] || npm install
node --experimental-strip-types --test lib/services/otoplug-acc-status.test.mjs
npm run typecheck
npm run lint
```
Expected: 테스트 `# fail 0`, typecheck/lint 에러 없음.

- [ ] **Step 4: 브랜치 push + PR 생성 (→ dev)**

```bash
git push -u origin cc-ignition-accstatus
gh pr create --base dev --head cc-ignition-accstatus --title "시동 감지 accStatus 전환 + 연결 이중임계값" --body "$(cat <<'EOF'
## Summary
- 시동 파생을 5분 gap 휴리스틱 → OTOPLUG `accStatus`(0=OFF/≠0=ON) 명시 신호 기반으로 전환. 미수신 시 직전 상태 carry-forward.
- 연결 판정을 시동 상태 종속 이중 임계값으로: 시동 ON=2분, OFF/UNKNOWN=120분. 수신이력 null → OFFLINE.
- NT 수신부(route.ts)에서 `readAccStatus`로 accStatus 안전 추출(`Number(null)===0` 함정 방지) 후 ingest 전달.
- DB 스키마·마이그레이션 변경 없음.

## Test Plan
- [ ] 백엔드: `TelemetryConnectionTests`(6), `TelemetryIgnitionDerivationTests`(5), `VendorTelemetryAdapterTests` 통과
- [ ] 백엔드: `compileJava` 성공(호출부 3곳 정합)
- [ ] 프론트: `otoplug-acc-status.test.mjs`(6) 통과, typecheck/lint clean
EOF
)"
```

- [ ] **Step 5: finishing-a-development-branch 스킬로 마무리**

REQUIRED: `superpowers:finishing-a-development-branch` 스킬을 사용해 병합/정리 옵션을 진행.

---

## 자기 검토 노트 (플랜 작성자)

- **스펙 커버리지:** 시동 파생(Task 2) · 연결 이중임계값(Task 3) · DTO accStatus(Task 1) · route.ts 추출/배선(Task 4) · 마이그레이션 없음(전 태스크에서 스키마 무변경) · 테스트(각 태스크 + Task 5) 모두 태스크에 매핑됨.
- **호출부 3곳:** Dashboard/Rider/BikeCurrentStateReadResponse 전부 Task 3 Step 4에 명시.
- **Docker 불필요:** 신규 백엔드 테스트는 JUnit5+Mockito 순수 단위(컨테이너 미사용). `--tests` 필터로 Testcontainers 계약 테스트를 실행하지 않음.
- **타입 정합:** `deriveIgnition(UUID, Integer)`, `TelemetryConnection.status(Instant, Instant, TelemetryIgnitionStatus)`, `readAccStatus(Record<string,unknown>): number|undefined` — 사용처 전부 일치.
