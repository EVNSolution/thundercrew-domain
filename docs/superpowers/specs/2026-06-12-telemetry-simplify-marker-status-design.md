# 텔레메트리 간소화 + 마커 연결·시동 표기 Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement the plan derived from this spec.

**Goal:** 텔레메트리 수집을 **시간·위치·속도**로 축소하고, **시동**은 수신 간격으로 파생(ON 60초/OFF 60분, 컷오프 5분)·**연결**은 120분 무수신으로 판정한다. 차량 상세의 텔레메트리 값은 "마지막 수신"만 남기고, **연결·시동을 지도 마커의 통합 상태 칩**으로 옮긴다.

**Architecture:** 텔레메트리 컬럼은 유지(파괴적 마이그레이션 없음). `ignition_status` 컬럼을 **장비 전송값 대신 간격 파생값** 저장에 재사용. 연결 판정을 기존 4-상태(10분)에서 **2-상태(연결/미연결, 120분)** 로 단순화하고, 읽기 DTO와 대시보드 핀 빌더 양쪽에 적용. 프론트는 상세 축소 + 마커 칩 추가 + 시뮬 정합.

**Tech Stack:** Spring Boot (Java 21), JPA, Next.js App Router, TypeScript, NCP Maps.

**확정 파라미터:** 시동 컷오프 = **5분**, 연결 임계 = **120분**, ON 케이던스 60초 / OFF 케이던스 60분.

**비범위:** `battery_percent`·`odometer_km` 컬럼 물리 삭제(드롭 안 함, 수집·표시만 중단), 실제 장비 연동, 시동 히스테리시스/노이즈 필터링, drivingStatus/batteryStatus 계산 로직 제거(미사용으로 남겨둠).

---

## 1. 데이터 수집 (백엔드 ingest)

`POST /api/v1/telemetry/device-events` (`TelemetryIngestRequest` / `TelemetryIngestionService`):

- **유지 저장**: `deviceUid`, `receivedAt`, `latitude`, `longitude`, `speedKph` + 멱등/감사 메타(`vendorEventId`, `payloadHash`, `deviceReportedAt`, `telemetrySource`, `rawPayload`).
- **수집 중단**: 요청 DTO에서 `batteryPercent`, `odometerKm`, **`ignitionStatus`** 필드 제거. 세 컬럼(`device_telemetry_logs`/`bike_recent_states`/`bike_current_states`)은 **드롭하지 않음**(이미 nullable; `ignition_status`는 §2 파생값으로 채움).
- 마이그레이션: 신규 마이그레이션 **불필요**. 단, 만약 `ignition_status`가 `NOT NULL`이면 파생값을 항상 채우므로 제약 위반 없음(현 스키마 `varchar(20) not null` → 파생 ON/OFF로 항상 채움). **기존 행 변경/제약 변경 없음.**

## 2. 시동(ignition) 파생 — 간격 기반 (ingest 시점)

`TelemetryIngestionService`가 current-state upsert 전에 계산:
- `previous = 직전 bike_current_states.lastReceivedAt` (해당 bike의 기존 current-state).
- `gap = incoming.receivedAt − previous`.
- `gap ≤ 5분` → `ON`, `gap > 5분` → `OFF`. 저장은 기존 `ignition_status` 컬럼(`TelemetryIgnitionStatus{ON,OFF,UNKNOWN}`) 재사용.
- **첫 이벤트**(해당 bike의 current-state 없음): 직전이 없으므로 방금 수신 = `ON` 으로 간주.
- out-of-order 가드: current-state는 `incoming.receivedAt > current.lastReceivedAt` 일 때만 upsert(기존 규칙 유지). 간격 계산도 이 조건에서만.
- **알려진 트레이드오프(간격 기반 채택):** ON 차량이 급정지하면 다음 수신 전까지 ON 유지. 120분 무수신 시 §3 연결 판정이 "미연결"로 덮음.

## 3. 연결(connection) 판정 — 120분 2-상태 (읽기 시점)

`now − lastReceivedAt ≤ 120분` → **CONNECTED(연결)**, 초과 → **DISCONNECTED(미연결)**.

- 적용 위치 두 곳을 **2-상태로 단순화**(기존 4-상태 ONLINE/SIGNAL_LOST/PARKED_OFFLINE_NORMAL/STALE_UNKNOWN + 10분 임계 대체):
  - `BikeCurrentStateReadResponse` (텔레메트리 읽기 API `connectionStatus`).
  - `DashboardMapStateService`/`DashboardMapStateResponse` (지도 핀 `connectionStatus` — 마커가 읽는 값).
- 공용 헬퍼로 추출 권장(예: `TelemetryConnectionStatus.of(lastReceivedAt, clock)` → `CONNECTED|DISCONNECTED`)해 두 곳이 같은 규칙을 쓰게 한다.
- `drivingStatus`/`batteryStatus` 계산 필드는 **건드리지 않음**(프론트가 더 이상 표시만 안 함). 핀/읽기 DTO의 `ignitionStatus`는 §2 파생값을 그대로 노출.

## 4. 차량 상세 — 텔레메트리 섹션 축소 (프론트)

`VehicleDetailDialog.tsx` 텔레메트리 섹션(현재 연결/시동/배터리/누적주행/속도/마지막수신 6행):
- **"마지막 수신" 1행만 유지**. 나머지 5행 제거.
- 관련 헬퍼(`renderConnectionPill`/`renderIgnitionLabel`/`renderBatteryLabel`/`renderSpeedLabel` 및 odometer 행) 중 마지막수신만 남기고 정리.
- 데이터원(`useSimulatedCurrentTelemetry(maintenance.currentState, …)`)은 유지하되 `lastReceivedAt`만 사용.

## 5. 지도 마커 — 통합 상태 칩 (프론트, 안 C)

`MapShell.tsx` `bikeMarkerHtml`에 **모든 차량 마커** 공통 상태 칩 추가:
- 형태: `● 연결 · 시동 ON`(초록 점) / `● 미연결 · 시동 —`(회색 점).
  - 점 색 = 연결(연결=초록 `#1d9e75` / 미연결=회색 `#5f5e5a`).
  - 텍스트 = `연결|미연결` + `· 시동 ON|OFF`. **미연결이면 시동은 "—"** (수신 없음 → 시동 불명).
- 기존 "배송 N건"(`serviceBadgeMarkup`, `servicePhase != null`) 칩은 활성 배차 차량에만 그대로. 상태 칩은 그와 **별도 줄**로 항상 표시.
- 입력: 핀의 `connectionStatus`(§3 2-상태) + `ignitionStatus`(§2 파생). `bikeMarkerHtml` 시그니처에 두 값 전달.
- 라벨 표시(`showLabel`)와 무관하게 상태 칩은 노출(연결/시동은 핵심 운영 지표).

## 6. 시뮬레이션 정합 (프론트)

시뮬 차량(deviceUid=`-1` 매칭, `FleetSimulationContext`):
- 마커 상태 칩: 연결 = **연결**(시뮬은 항상 수신), 시동 = 시뮬 주행상태(이동/활성 → ON, 아니면 OFF). `useSimulatedBikePins`가 핀에 `connectionStatus="CONNECTED"`, `ignitionStatus` 세팅(기존 ignition 로직 재사용).
- `useSimulatedCurrentTelemetry`: 상세가 마지막수신만 쓰므로 battery override 등은 무의미 → 정리(최소: `lastReceivedAt`만 신뢰). 배터리/속도 override 제거 가능(YAGNI).

---

## 7. 데이터 흐름
```
장비 → POST device-events(time/loc/speed) → ingest: gap=now-prevLastReceived → ignition ON/OFF 파생 → ignition_status 저장 + current_state upsert
대시보드 map-state: connectionStatus = (now-lastReceivedAt ≤120분 ? 연결 : 미연결), ignitionStatus = 파생값 → 핀
프론트: 마커 = [배송 N건(활성 시)] + [● 연결/미연결 · 시동 ON/OFF/—];  상세 = 마지막 수신만
시뮬 차량: 연결=연결, 시동=주행상태
```

## 8. 검증
- 백엔드 `compileJava + compileTestJava`. 계약 테스트: ingest가 battery/odometer/ignition 없이 수신·저장, 간격≤5분→ON·>5분→OFF·첫이벤트→ON, 연결 ≤120분→연결·>120분→미연결(현재 시각 주입 가능한 clock 사용).
- 프론트 `typecheck + lint + build`.
- 프로덕션 QA: 차량상세 텔레메트리=마지막수신만, 마커에 `● 연결 · 시동 ON` 칩(시뮬 차량 ON), 미연결 차량은 회색 점 + 시동 "—".

## 9. 비범위 재확인
컬럼 물리 삭제, 실제 장비 연동, drivingStatus/batteryStatus 로직 제거, 시동 노이즈 필터/히스테리시스는 포함하지 않는다.
