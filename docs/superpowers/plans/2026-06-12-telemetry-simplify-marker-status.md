# 텔레메트리 간소화 + 마커 연결·시동 표기 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 텔레메트리 수집을 시간·위치·속도로 축소, 시동을 수신 간격으로 파생(컷오프 5분), 연결을 120분 무수신 판정으로 단순화, 차량 상세는 "마지막 수신"만 남기고 연결·시동을 지도 마커 통합 상태 칩으로 표기.

**Architecture:** 마이그레이션 없음(컬럼 유지). `ignition_status` 컬럼을 간격 파생값 저장에 재사용. 연결 판정은 문자열 **"ONLINE"/"OFFLINE" 유지**(기존 `=== "ONLINE"` 소비자 보존: overview 연결필터·정비 auto-km·시뮬), 임계만 10분→**120분**, 오프라인 세부상태는 단일 "OFFLINE"로 통합.

**Tech Stack:** Spring Boot (Java 21), JPA, Next.js App Router, TypeScript, NCP Maps.

**작업 경로:** 백엔드 `development/service-ops-api`, 프론트 `development/front-admin-web`. Bash 절대경로 cd (cwd 매 호출 리셋). 브랜치 `cc-telemetry-status` 체크아웃(이미 생성됨, 새 브랜치 만들지 말 것). 계약 테스트 Docker 필요 → 컴파일만 로컬 게이트. 프론트 `npm run typecheck && lint && build`.

**확정 파라미터:** 시동 컷오프 = 5분, 연결 임계 = 120분.

---

### Task 1: 백엔드 ingest — 수집 축소 + 시동 간격 파생

**Files:**
- Modify: `development/service-ops-api/src/main/java/com/thundercrew/opsapi/telemetry/dto/TelemetryIngestRequest.java`
- Modify: `development/service-ops-api/src/main/java/com/thundercrew/opsapi/telemetry/service/TelemetryIngestionService.java`
- Test: 해당 ingest 계약 테스트(아래 Step 6)

- [ ] **Step 1: 요청 DTO에서 battery/odometer/ignition 제거**

`TelemetryIngestRequest.java` — `batteryPercent`, `odometerKm`, `ignitionStatus` 필드 삭제. 결과:
```java
package com.thundercrew.opsapi.telemetry.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.thundercrew.opsapi.telemetry.domain.TelemetrySource;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;

@JsonIgnoreProperties(ignoreUnknown = true)
public record TelemetryIngestRequest(
        @NotBlank @Size(max = 100) String deviceUid,
        @Size(max = 200) String vendorEventId,
        @NotNull Instant receivedAt,
        Instant deviceReportedAt,
        @DecimalMin("-90.0") @DecimalMax("90.0") BigDecimal latitude,
        @DecimalMin("-180.0") @DecimalMax("180.0") BigDecimal longitude,
        @PositiveOrZero BigDecimal speedKph,
        @NotNull TelemetrySource telemetrySource,
        JsonNode rawPayload
) {
}
```
(`TelemetryIgnitionStatus` import 제거. battery/odometer 컬럼·엔티티는 그대로 둠 — 드롭 안 함.)

- [ ] **Step 2: ingest 서비스에 current-state repo 주입 + 시동 파생**

`TelemetryIngestionService.java`:
- import 추가: `import com.thundercrew.opsapi.telemetry.domain.BikeCurrentState;`, `import com.thundercrew.opsapi.telemetry.domain.TelemetryIgnitionStatus;`, `import com.thundercrew.opsapi.telemetry.repository.BikeCurrentStateRepository;`, `import java.time.Duration;`, `import java.time.Instant;`.
- 필드 + 생성자 파라미터에 `BikeCurrentStateRepository bikeCurrentStateRepository` 추가(기존 주입들 옆에).
- 상수 추가(클래스 상단):
```java
    private static final Duration IGNITION_ON_GAP_THRESHOLD = Duration.ofMinutes(5);
```
- `ingest(...)` 내부에서 `DeviceTelemetryLog.create(...)` 호출 직전에 파생 시동 계산:
```java
        TelemetryIgnitionStatus derivedIgnition = deriveIgnition(
                installation.map(BikeDeviceInstallation::getBikeId).orElse(null),
                request.receivedAt());
```
- `DeviceTelemetryLog.create(...)` 호출에서 `request.batteryPercent()` → `null`, `request.odometerKm()` → `null`, `request.ignitionStatus()` → `derivedIgnition` 로 교체. (인자 순서: ... speedKph 다음이 batteryPercent(BigDecimal), odometerKm(Integer), ignitionStatus(TelemetryIgnitionStatus), telemetrySource ... → `request.speedKph(), null, null, derivedIgnition, request.telemetrySource(), rawPayload`.)
- 신규 private 메서드:
```java
    private TelemetryIgnitionStatus deriveIgnition(UUID bikeId, Instant receivedAt) {
        if (bikeId == null) {
            return TelemetryIgnitionStatus.UNKNOWN;
        }
        Optional<BikeCurrentState> previous = bikeCurrentStateRepository.findByBikeId(bikeId);
        if (previous.isEmpty()) {
            return TelemetryIgnitionStatus.ON;
        }
        Duration gap = Duration.between(previous.get().getLastReceivedAt(), receivedAt);
        return gap.compareTo(IGNITION_ON_GAP_THRESHOLD) <= 0
                ? TelemetryIgnitionStatus.ON
                : TelemetryIgnitionStatus.OFF;
    }
```

- [ ] **Step 3: payloadHash 정리(제거된 필드 제외)**

`payloadHash(...)` 의 `hashInput` 에서 아래 세 줄 제거(필드가 사라져 컴파일 에러):
```java
                request.batteryPercent() == null ? "" : request.batteryPercent().toPlainString(),
                request.odometerKm() == null ? "" : request.odometerKm().toString(),
                request.ignitionStatus().name(),
```
나머지(deviceUid, vendorEventId, receivedAt, deviceReportedAt, latitude, longitude, speedKph, telemetrySource, rawPayload)는 유지. (멱등 키 의미 유지 — battery/odometer/ignition은 더 이상 입력이 아니므로 해시에서 빠지는 게 맞음.)

- [ ] **Step 4: 컴파일**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/service-ops-api && ./gradlew compileJava -q
```
Expected: BUILD SUCCESSFUL. (실패 시: `DeviceTelemetryLog.create` 인자 타입/순서 재확인 — null 캐스팅 필요하면 `(BigDecimal) null`, `(Integer) null`.)

- [ ] **Step 5: 계약 테스트 갱신/추가**

ingest 계약 테스트(`grep -rln "device-events\|TelemetryIngest\|ingest" src/test/java`)에서:
- 요청 본문(JSON/record)에 있던 `batteryPercent`/`odometerKm`/`ignitionStatus` 제거.
- 시동 파생 케이스 추가(같은 bike 두 번 ingest): (a) 첫 이벤트 → current-state.ignitionStatus = ON; (b) 5분 이내 간격 2번째 → ON; (c) 5분 초과(예: 10분) 간격 → OFF. 검증은 `GET /api/v1/telemetry/bikes/{bikeId}/current-state` 응답 `ignitionStatus` 또는 current-state 조회로.
- 차량 미해결(installation 없음) ingest → 로그 ignition UNKNOWN(검증 가능하면).

- [ ] **Step 6: 컴파일(main+test) + 커밋**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/service-ops-api && ./gradlew compileJava compileTestJava -q
cd /c/Users/user/repositories/clever/thundercrew-domain && git add development/service-ops-api/src/main/java/com/thundercrew/opsapi/telemetry && git add development/service-ops-api/src/test/java && git commit -m "feat(telemetry): collect time/loc/speed only; derive ignition from 5min receive gap"
```
End commit message with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

### Task 2: 백엔드 연결 판정 — 120분 2-상태 + 공용 헬퍼

**Files:**
- Create: `development/service-ops-api/src/main/java/com/thundercrew/opsapi/telemetry/domain/TelemetryConnection.java`
- Modify: `development/service-ops-api/src/main/java/com/thundercrew/opsapi/telemetry/dto/BikeCurrentStateReadResponse.java`
- Modify: `development/service-ops-api/src/main/java/com/thundercrew/opsapi/dashboard/service/DashboardMapStateService.java`

- [ ] **Step 1: 공용 연결 판정 유틸**

`TelemetryConnection.java` 생성:
```java
package com.thundercrew.opsapi.telemetry.domain;

import java.time.Duration;
import java.time.Instant;

/** 마지막 수신 시각 기준 연결 판정. 120분 무수신이면 OFFLINE. */
public final class TelemetryConnection {

    /** 이 시간 넘게 수신 없으면 미연결. */
    public static final Duration OFFLINE_THRESHOLD = Duration.ofMinutes(120);

    private TelemetryConnection() {
    }

    /** "ONLINE" (<=120분) / "OFFLINE" (>120분). */
    public static String status(Instant lastReceivedAt, Instant now) {
        Duration age = Duration.between(lastReceivedAt, now);
        return age.compareTo(OFFLINE_THRESHOLD) <= 0 ? "ONLINE" : "OFFLINE";
    }
}
```
(문자열 "ONLINE" 유지 — 기존 프론트 `=== "ONLINE"` 소비자 보존. 오프라인 세부상태는 단일 "OFFLINE"로 통합.)

- [ ] **Step 2: 읽기 DTO 연결 판정 교체**

`BikeCurrentStateReadResponse.java`:
- `connectionStatus(state, clock)` 메서드 본문을 교체:
```java
    private static String connectionStatus(BikeCurrentState state, Clock clock) {
        return TelemetryConnection.status(state.getLastReceivedAt(), Instant.now(clock));
    }
```
- 사용 안 하게 된 `SIGNAL_LOST_THRESHOLD` 상수 제거. `TelemetryConnection` import 추가. (`drivingStatus`/`batteryStatus`는 그대로 둠.)

- [ ] **Step 3: 대시보드 핀/요약 연결 판정 교체**

`DashboardMapStateService.java`:
- `connectionStatus(BikePinRow row, Instant generatedAt)` 본문 교체:
```java
    private String connectionStatus(BikePinRow row, Instant generatedAt) {
        return TelemetryConnection.status(row.lastReceivedAt(), generatedAt);
    }
```
- `SIGNAL_LOST_THRESHOLD` 상수(라인 ~34) 제거. `Duration` import는 다른 데서 안 쓰면 제거. `TelemetryConnection` import 추가.
- 요약 카운트(라인 ~71-73) — 이제 ONLINE/OFFLINE 2값만 나옴. 교체:
```java
                currentBikeStates.stream().filter(row -> connectionStatus(row, generatedAt).equals("ONLINE")).count(),
                0L,
                currentBikeStates.stream().filter(row -> connectionStatus(row, generatedAt).equals("OFFLINE")).count(),
```
(순서: `onlineBikeCount` = ONLINE 수, `signalLostBikeCount` = 0, `parkedOfflineBikeCount` = OFFLINE 수. 이 요약 필드들은 프론트에서 미사용 — grep 확인됨.)

- [ ] **Step 4: 컴파일 + 커밋**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/service-ops-api && ./gradlew compileJava compileTestJava -q
cd /c/Users/user/repositories/clever/thundercrew-domain && git add development/service-ops-api/src/main/java/com/thundercrew/opsapi/telemetry development/service-ops-api/src/main/java/com/thundercrew/opsapi/dashboard && git commit -m "feat(telemetry): connection = 120min ONLINE/OFFLINE via shared TelemetryConnection"
```
Co-Authored-By 라인 포함. 계약 테스트에서 connection 10분 가정 단언이 있으면(예: 11분 stale → SIGNAL_LOST) 120분/2-상태로 갱신(같은 커밋).

---

### Task 3: 프론트 차량 상세 — 텔레메트리 "마지막 수신"만

**Files:**
- Modify: `development/front-admin-web/components/management/VehicleDetailDialog.tsx`

- [ ] **Step 1: TelemetrySection 행 축소**

`TelemetrySection`(약 라인 336-396)의 `<dl className="telemetry-list">` 내부를 마지막 수신 1행으로 교체:
```tsx
      <dl className="telemetry-list">
        <TelemetryRow label="마지막 수신" value={renderLastReceivedLabel(current.lastReceivedAt)} />
      </dl>
```
- `const isOnline = ...`(라인 ~370) 제거(미사용).
- 연결/시동/배터리/누적/속도 행 제거.

- [ ] **Step 2: 미사용 헬퍼 제거**

`renderConnectionPill`, `renderIgnitionLabel`, `renderBatteryLabel`, `renderSpeedLabel` 가 이제 TelemetrySection에서만 쓰였으면 제거(파일 내 다른 사용처 grep으로 확인 후). `renderLastReceivedLabel`는 유지. `current` prop 타입은 그대로 둬도 무방(`lastReceivedAt`만 사용). 주의: 차량상세 **정비 섹션**의 `currentState.connectionStatus === "ONLINE"`(라인 ~520-525) 분기는 건드리지 말 것 — 백엔드가 "ONLINE" 문자열을 유지하므로 그대로 동작.

- [ ] **Step 3: typecheck + lint + 커밋**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web && npm run typecheck && npm run lint
cd /c/Users/user/repositories/clever/thundercrew-domain && git add development/front-admin-web/components/management/VehicleDetailDialog.tsx && git commit -m "feat(telemetry): vehicle detail telemetry shows last-received only"
```
Co-Authored-By 라인 포함. Expected: typecheck/lint 통과(미사용 import/헬퍼 0).

---

### Task 4: 프론트 지도 마커 — 통합 상태 칩 (연결·시동)

**Files:**
- Modify: `development/front-admin-web/components/dashboard/MapShell.tsx`

- [ ] **Step 1: 상태 칩 마크업 함수 추가**

`MapShell.tsx` 의 `serviceBadgeMarkup` 근처에 추가:
```ts
/**
 * 모든 차량 마커 공통 상태 칩. 점 색 = 연결(ONLINE 초록 / 그 외 회색),
 * 텍스트 = 연결|미연결 · 시동 ON|OFF|—. 미연결이면 시동 "—".
 */
function statusChipMarkup(connectionStatus: string | undefined, ignitionStatus: string | undefined): string {
  const online = connectionStatus === "ONLINE";
  const dotColor = online ? "#1d9e75" : "#5f5e5a";
  const conn = online ? "연결" : "미연결";
  const ign = !online ? "—" : ignitionStatus === "ON" ? "ON" : ignitionStatus === "OFF" ? "OFF" : "—";
  return (
    `<div style="display:inline-flex;align-items:center;gap:4px;background:rgba(20,22,27,0.85);` +
    `color:#cfd3dc;font-size:10px;line-height:1;padding:2px 6px;border-radius:9px;` +
    `border:0.5px solid rgba(255,255,255,0.12);white-space:nowrap;">` +
    `<span style="width:7px;height:7px;border-radius:50%;background:${dotColor};"></span>` +
    `${conn} · 시동 ${ign}</div>`
  );
}
```
(스타일은 기존 `serviceBadgeMarkup` 의 칩 컨테이너 톤과 맞춤 — 어두운 반투명 배경. 기존 배지 마크업의 wrapper 스타일을 참고해 정렬.)

- [ ] **Step 2: bikeMarkerHtml에 연결·시동 인자 + 칩 삽입**

`bikeMarkerHtml(...)` 시그니처에 두 인자 추가(끝쪽, `currentDispatchCustomerName` 뒤):
```ts
  connectionStatus?: string,
  ignitionStatus?: string,
```
함수 본문에서 기존 `badge`(serviceBadgeMarkup, servicePhase != null 시) 계산 옆에 상태 칩을 항상 만들고, 마커 HTML의 배지 영역에 **배송 칩 아래 별도 줄**로 붙임:
```ts
  const statusChip = statusChipMarkup(connectionStatus, ignitionStatus);
```
배지/말풍선을 조립하는 부분에서 기존 `badge` 다음에 `statusChip` 을 별도 줄(예: 배지 컨테이너를 `flex-direction:column; gap:3px` 로 감싸 `${badge}${statusChip}`)로 렌더. (기존 배지가 없을 때도 `statusChip` 은 항상 노출.)

- [ ] **Step 3: 호출부에 핀 값 전달**

`bikeMarkerHtml(...)` 호출부(약 라인 468):
```ts
      const html = bikeMarkerHtml(pin.pinLabel ?? pin.plateNumber, showLabel, pin.servicePhase, pin.deliveryCount, pin.ignitionOnAt, pin.serviceType, isSelected, pin.currentDispatchCustomerName);
```
끝에 `, pin.connectionStatus, pin.ignitionStatus` 추가. (`SimulatedBikePin`/`FrontendDashboardBikePin` 에 두 필드 존재 — 시뮬 차량은 `connectionStatus="ONLINE"` + `ignitionStatus` 세팅됨.)

- [ ] **Step 4: typecheck + lint + 커밋**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web && npm run typecheck && npm run lint
cd /c/Users/user/repositories/clever/thundercrew-domain && git add development/front-admin-web/components/dashboard/MapShell.tsx && git commit -m "feat(telemetry): marker connection/ignition status chip on every bike"
```
Co-Authored-By 라인 포함.

---

### Task 5: 최종 검증 + PR

- [ ] **Step 1: 백엔드 + 프론트 풀 검증**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/service-ops-api && ./gradlew compileJava compileTestJava -q
cd /c/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web && npm run typecheck && npm run lint && npm run build
```
Expected: 전부 성공.

- [ ] **Step 2: 회귀 확인 — 마이그레이션 없음 + connection 소비자 보존**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain && git diff dev --stat | grep -i "db/migration" && echo "MIGRATION ADDED — 검토 필요" || echo "no migration (의도대로)"
cd /c/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web && grep -rn '=== "ONLINE"' components lib | head
```
Expected: 신규 마이그레이션 0개. `=== "ONLINE"` 소비자(filter-compute/maintenance-derive/VehicleDetailDialog 정비/sim)는 그대로(백엔드가 "ONLINE" 유지하므로 정상).

- [ ] **Step 3: PR (→ dev)**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain && git push -u origin cc-telemetry-status && gh pr create --base dev --title "텔레메트리 간소화 + 마커 연결·시동 표기" --body "$(cat <<'EOF'
## Summary
- 수집 축소: device-events 가 시간·위치·속도만 저장(배터리·누적주행·장비-시동 수집 중단, 컬럼은 유지)
- 시동 파생: ingest 시 `gap = 이번−직전 수신` ≤5분 ON / >5분 OFF / 첫 이벤트 ON → `ignition_status` 재사용
- 연결 판정: 120분 무수신 → OFFLINE(기존 4-상태/10분 → 2-상태/120분, 문자열 "ONLINE"/"OFFLINE" 유지로 기존 소비자 보존), 공용 `TelemetryConnection`
- 차량 상세: 텔레메트리 = "마지막 수신" 1행만
- 지도 마커: 모든 차량에 `● 연결 · 시동 ON` 통합 상태 칩(미연결=회색 점 + 시동 "—")

## 배포 영향
- **마이그레이션 없음** (V36 장애 이후 의도적 무-마이그레이션 설계). 재기동만으로 적용.

## Test Plan
- [x] 백엔드 compileJava + compileTestJava
- [x] 프론트 typecheck + lint + build
- [ ] 계약 테스트(CI/Docker): 시동 간격 파생, 연결 120분
- [ ] 프로덕션 QA: 상세=마지막수신만, 마커 상태 칩(시뮬 차량 연결·시동 ON), 미연결 회색 점

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

**1. Spec 커버리지:** 수집축소(T1), 시동 간격 파생 컷오프5분(T1), 연결 120분 2-상태(T2), 상세 마지막수신만(T3), 마커 통합 칩(T4), 시뮬 정합(시뮬이 이미 connectionStatus="ONLINE"+ignitionStatus 세팅 → T4에서 자동 동작, 별도 작업 불필요), 검증·PR(T5). ✓ 마이그레이션 없음(스펙 §1). ✓

**2. 플레이스홀더 스캔:** DTO/서비스/헬퍼/칩/연결유틸 전부 완전 코드. T1 Step5(테스트)·T3 Step2(미사용 헬퍼 제거)는 "grep 후 대상 한정"이라 코드베이스 의존 — 구체 대상·검증법 명시, placeholder 아님.

**3. 타입/이름 일관성:** 백엔드 `TelemetryConnection.status(lastReceivedAt, now)` → "ONLINE"/"OFFLINE", 두 소비자(read DTO·dashboard) 동일 사용. 시동 파생 `TelemetryIgnitionStatus{ON,OFF,UNKNOWN}` 재사용, 컷오프 5분 상수. 프론트 마커 `connectionStatus === "ONLINE"` ↔ 백엔드 문자열 일치. `statusChipMarkup(connectionStatus, ignitionStatus)` ↔ bikeMarkerHtml 인자 ↔ 호출부 `pin.connectionStatus, pin.ignitionStatus` 일관.

**구현자 주의:** "ONLINE"/"OFFLINE" 문자열은 의도적 유지(스펙의 "연결/미연결 2-상태" = 이 두 문자열). 프론트는 "ONLINE"→연결, 그 외→미연결로 표시. drivingStatus/batteryStatus 백엔드 계산은 제거하지 말 것(미사용으로 남김). 배터리/오도미터 컬럼·엔티티 필드는 드롭하지 말 것.
