# 실차량 마커 1분 글라이딩 재생 (Real-vehicle marker delayed-smooth playback)

**Date:** 2026-06-29
**Status:** Design (approved)

## 배경 / 문제

OTOPLUG NT는 주행 중인 단말의 위치를 두 채널로 보낸다:

- `driving` (`csi.terminal.status.data.driving`): 단일 점, ~60초 주기 (`data.drivingData`, time=`msgdate`)
- `drivingDetail` (`csi.terminal.status.data.drivingDetail`): **1분치 배치**, ~10초 간격 점들의 배열 (`data.tripData[]`, time=`timeOfOccurrence`) — 그 1분이 끝나야 한 번에 도착

현재 수신기(`app/api/otoplug/nt/[type]/route.ts`)는 `tripData[]`의 **각 점을 개별 ingest**하여 `device_telemetry_logs` / `bike_recent_states`에 모두 적재한다. 그러나 지도 마커는 `bike_current_states`(=가장 마지막 점)만 읽으므로, 1분치 데이터를 **끝점으로 스냅**한다. 즉 마커가 분당 한 번 순간이동한다.

부드러운 재생(trail/보간)은 **시뮬 차량(IMEI "-")에만** 구현되어 있다:
- `components/overview/use-trail-waypoints.ts:76` — 실차량 분기는 `return null` (stub)
- 250ms 보간 tick은 `components/overview/FleetSimulationContext.tsx:198` — 시뮬 전용 (OSRM 경로 기반)

**목표:** 실제 주행 차량 마커가 drivingDetail 1분치 GPS 점들을 다음 1분에 걸쳐 부드럽게(보간) 이동하도록 한다. 지도의 **모든** 주행 차량에 적용한다. 시뮬 차량 경로는 변경하지 않는다.

## 접근: 지연 부드러운 재생 (delayed-smooth playback)

배치가 1분이 지나야 도착하므로 "실시간 정확도"와 "부드러움"은 trade-off다. 선택: **지연 부드러운 재생**.

- 마커는 항상 `playbackClock = now − LAG` (LAG ≈ 75초) 시점의 보간 위치를 렌더한다.
- 각 실차량은 최근 waypoint 목록 `[{lat, lng, t}]`(t = epoch ms)을 누적 보유한다.
- 250ms tick마다 각 차량의 `playbackClock`에 해당하는 위치를 인접 두 점 사이 **선형 보간**으로 계산해 마커를 이동시킨다.
- 트랙이 고갈(`playbackClock`이 마지막 점을 지남 = 데이터 끊김/정차)되면 마지막 점에 **정지**하고, 새 배치가 도착하면 다시 이동한다.

대안(따라잡기 / 하이브리드)은 매 분 "빠르게 슝→멈춤" 반복 또는 상태 관리 복잡도 때문에 제외했다.

## 아키텍처

### 백엔드 (읽기만 추가)

점은 이미 `bike_recent_states`에 `received_at`과 함께 적재되어 있으므로 읽기 경로만 추가한다.

- `dashboard/map-state` 의 pin DTO에 `recentTrack: List<TrackPoint>` 추가
  - `TrackPoint = { latitude, longitude, t }` (`t` = epoch milliseconds, `received_at` 기준)
  - 차량별 **최근 ~120초**의 점, 시간 오름차순, GPS 유효(위경도 not null)만
  - 정차/오래된 차량은 **빈 배열**
- 쿼리: `bike_recent_states`에서 bike_id별 `received_at >= now() - interval '120 seconds'` 점을 모아 pin에 부착. 점 수 상한(예: 차량당 최근 20점)을 둬 페이로드를 제한한다.

**대안 B2 (분리 엔드포인트):** map-state는 그대로 두고 `dashboard/active-tracks` 별도 폴링. 채택하지 않음(폴링 2회 + 동기화 복잡). 부하가 실제로 문제되면 그때 분리한다. → **B1 (map-state 확장) 채택.**

### 프론트엔드

1. **폴링 루프** — 오버뷰에서 ~30초마다 `dashboard/map-state` 재요청하여 pin + recentTrack을 갱신한다. (현재는 SSR 1회 로드 → 클라이언트 폴링을 신설.) `document.hidden`이면 폴링을 멈춰 낭비를 줄인다.

2. **재생 엔진 `useRealVehiclePlayback(pins)`**
   - 차량별 트랙 버퍼를 `useRef`에 누적: 폴링으로 들어온 새 점을 기존 버퍼에 **append + dedup(같은 t 제거) + 정렬(t 오름차순) + 오래된 점 정리**(예: `now − 180s` 이전 제거).
   - 250ms `setInterval` tick: 각 실차량에 대해 `playbackClock = now − LAG`로 보간 위치 계산.
   - 결과를 pin 좌표에 override한 새 핀 배열을 반환한다.
   - 대상: `telemetrySource === "WEBHOOK"` 이고 `recentTrack.length >= 2`인 실차량만. 시뮬 차량(IMEI "-")은 건드리지 않는다.

3. **보간 순수함수 `interpolateAt(track, clockMs)`**
   - `clockMs <= track[0].t` → `track[0]` 반환 (아직 재생 시작 전)
   - `clockMs >= track[last].t` → `track[last]` 반환 (고갈 → 정지)
   - 그 외 → `clockMs`를 감싸는 인접 두 점 `a, b` 찾아 `f = (clockMs − a.t)/(b.t − a.t)`로 선형 보간
   - `track.length < 2` → 단일 점 또는 null

4. **머지** — `components/overview/use-simulated-bike-pins.ts`가 시뮬 핀을 overlay하는 것과 동일한 패턴으로, real 재생 위치를 실차량 핀에 overlay한다. 시뮬=기존 경로 / real=새 경로로 분리되어 충돌하지 않는다.

5. **선택 차량 trail** — `useTrailWaypoints`의 실차량 stub(`return null`)을 선택 차량의 recentTrack(재생된 구간까지)으로 채워 polyline을 표시한다. 마커 글라이딩은 전 차량, trail polyline은 **선택 차량만**(전체 trail은 지도 과밀).

## 결정 / 엣지 케이스

- **LAG = 75초** (초기값). 분 경계 직후 배치 도착 + 지터 흡수. prod에서 raw payload(#510 로그) 도착 시각 분포를 보고 튜닝.
- **주행/정차 판정**: 트랙에 신선한 점이 있으면 주행(재생), 비었거나 마지막 점이 오래됨(> 3분)이면 정차 → `bike_current_states` 위치에 정지.
- **점 1개**: 보간 불가 → 그 점에 정지.
- **timestamp 역행/중복**: append 시 정렬 + dedup, 단조 증가 보장.
- **폴링 실패**: 기존 버퍼로 계속 재생(고갈되면 정지), 다음 폴링에서 복구.
- **연속성**: 새 트랙은 append만 하고 과거 재생 구간은 건드리지 않아 마커 점프를 방지한다.
- **driving 단일 점**도 같은 트랙 버퍼에 들어가 보간 점 밀도를 보강한다.

## 스코프

- **MVP (핵심 요청):** 백엔드 recentTrack + 폴링 + 재생 엔진 + 머지 → 모든 주행 차량 마커 글라이딩
- **포함(가벼움):** 선택 차량 trail polyline
- **YAGNI 제외:** 따라잡기/하이브리드 재생, 전체 차량 trail, 서버 push(SSE/WebSocket — 폴링으로 충분)

## 테스트

- **백엔드 계약 테스트:** map-state recentTrack — 차량별 최근 120초 점/정렬/상한/정차 차량 빈 배열.
- **프론트 유닛:** `interpolateAt`(트랙+clock→위치 경계 케이스), 트랙 버퍼 merge/dedup/정리.
- **검증:** 배포 후 #510 raw 로그로 배치 도착 확인 + 실주행(또는 RR) 차량 마커가 끊김 없이 이동하는지 관측.

## 미해결 / 후속

- LAG·폴링 주기·트랙 상한의 prod 튜닝 (raw payload 도착 분포 확인 후).
- 정차 중 위치 갱신이 필요하면 별도의 **RR 폴링**(설계 별건)과 결합.
