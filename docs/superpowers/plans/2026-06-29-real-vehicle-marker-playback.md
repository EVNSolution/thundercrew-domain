# 실차량 마커 1분 글라이딩 재생 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 지도의 모든 주행 OTOPLUG 차량 마커가, drivingDetail 1분치 GPS 배치를 다음 1분에 걸쳐 부드럽게(보간) 이동하도록 한다(지연 재생, LAG≈75s). 시뮬 차량은 무변경.

**Architecture:** 백엔드 `dashboard/map-state` pin에 `recentTrack`(차량별 최근 120초 점)을 추가(읽기만). 프론트는 오버뷰에 30초 폴링 루프를 신설하고, 250ms tick 클라이언트 보간 엔진이 `playbackClock = now − LAG` 위치를 산출해 실차량 핀 좌표를 override한다. `FullscreenMapHost`의 단일 소스 `overlaidBikePins`의 입력을 `폴링 → 재생 → 시뮬` 체인으로 바꾸면 마커·검색·상세·follow가 모두 live가 된다.

**Tech Stack:** Spring Boot/Java 21 (JdbcTemplate, window function), JUnit MockMvc 계약 테스트 / Next.js 16 App Router, React hooks, `node --test` (.test.mjs, `--experimental-strip-types`).

**Spec:** [docs/superpowers/specs/2026-06-29-real-vehicle-marker-playback-design.md](../specs/2026-06-29-real-vehicle-marker-playback-design.md)

---

## File Structure

**Backend (service-ops-api):**
- Modify `dashboard/dto/DashboardMapStateResponse.java` — `BikePin`에 `recentTrack` + 중첩 `TrackPoint` record
- Modify `dashboard/repository/DashboardMapQueryRepository.java` — `findRecentTracks()` 쿼리
- Modify `dashboard/service/DashboardMapStateService.java` — 트랙 조회 + `toBikePin` 배선
- Modify `test/.../DashboardMapApiContractTests.java` — `bike_recent_states` reset + helper + 신규 테스트

**Frontend (front-admin-web):**
- Modify `lib/services/service-ops-api.ts` — `recentTrack` 타입(raw + frontend) + 정규화
- Create `lib/services/real-vehicle-playback.ts` — 순수함수(merge/interpolate)
- Create `lib/services/real-vehicle-playback.test.mjs` — 순수함수 유닛
- Modify `package.json` — test:service-ops 에 새 테스트 파일 추가
- Create `components/overview/use-polling-bike-pins.ts` — 30초 폴링 훅
- Create `components/overview/use-real-vehicle-playback.ts` — 250ms 재생 훅
- Modify `components/overview/use-trail-waypoints.ts` — 실차량 trail(선택 차량) stub 채우기
- Modify `components/overview/FullscreenMapHost.tsx` — 체인 배선

각 task는 독립적으로 빌드/테스트 가능한 단위다. 백엔드(Task 1)와 프론트 순수함수(Task 2~3)는 서로 독립.

---

## Task 1: 백엔드 — recentTrack 쿼리 + DTO + 서비스 + 계약 테스트

**Files:**
- Modify: `development/service-ops-api/src/main/java/com/thundercrew/opsapi/dashboard/dto/DashboardMapStateResponse.java`
- Modify: `development/service-ops-api/src/main/java/com/thundercrew/opsapi/dashboard/repository/DashboardMapQueryRepository.java`
- Modify: `development/service-ops-api/src/main/java/com/thundercrew/opsapi/dashboard/service/DashboardMapStateService.java`
- Test: `development/service-ops-api/src/test/java/com/thundercrew/opsapi/DashboardMapApiContractTests.java`

- [ ] **Step 1: DTO — `TrackPoint` record + `recentTrack` 필드 추가**

`DashboardMapStateResponse.java`의 `BikePin` record 마지막 필드(`int dispatchQueueCount`) 뒤에 `,` 추가 후 새 필드를 넣고, `BikePin` record 본문에 중첩 record를 선언한다:

```java
    public record BikePin(
            // ... 기존 필드 전부 동일 ...
            DispatchOrderKind currentDispatchKind,
            int dispatchQueueCount,
            List<TrackPoint> recentTrack
    ) {
        public record TrackPoint(
                BigDecimal latitude,
                BigDecimal longitude,
                long t
        ) {
        }
    }
```

`BigDecimal`, `List` import는 파일에 이미 존재.

- [ ] **Step 2: 계약 테스트 작성 (실패 확인용)**

`DashboardMapApiContractTests.java` 수정:

(a) `resetRows()`의 삭제 테이블 목록에 `"bike_recent_states"`를 **`"bike_current_states"` 바로 앞**에 추가:

```java
        List.of(
                "bike_recent_states",
                "bike_current_states",
                "rider_bike_contracts",
                "battery_stations",
                "riders",
                "bikes",
                "admin_users"
        ).forEach(table -> jdbcTemplate.update("delete from " + table));
```

(b) 파일에 헬퍼 추가 (기존 `insertCurrentState` 헬퍼 근처):

```java
    private void insertRecentState(UUID bikeId, Instant receivedAt, String lng, String lat) {
        jdbcTemplate.update("""
                insert into bike_recent_states
                    (id, bike_id, received_at, latitude, longitude, ignition_status, telemetry_source)
                values (?, ?, ?::timestamptz, ?, ?, 'ON', 'WEBHOOK')
                """,
                UUID.randomUUID(), bikeId, receivedAt.toString(),
                new java.math.BigDecimal(lat), new java.math.BigDecimal(lng));
    }
```

(c) 신규 테스트:

```java
    @Test
    void mapStateIncludesRecentTrackSortedAscendingForBike() throws Exception {
        Instant now = Instant.now();
        seedBike(ONLINE_BIKE_ID, "서울T-3001", "VIN-TRACK-001", "IN_SERVICE");
        insertCurrentState(ONLINE_BIKE_ID, DEVICE_ID, now.minusSeconds(30), "ON", "10.00", "44.00");
        // 시간 역순으로 삽입 — 응답은 received_at 오름차순으로 정렬돼야 한다.
        insertRecentState(ONLINE_BIKE_ID, now.minusSeconds(30), "127.30", "37.50");
        insertRecentState(ONLINE_BIKE_ID, now.minusSeconds(50), "127.10", "37.50");
        insertRecentState(ONLINE_BIKE_ID, now.minusSeconds(40), "127.20", "37.50");
        // 윈도(120초) 밖 점은 제외돼야 한다.
        insertRecentState(ONLINE_BIKE_ID, now.minusSeconds(300), "127.90", "37.50");

        mockMvc.perform(get("/api/v1/dashboard/map-state")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bikePins[0].bikeId").value(ONLINE_BIKE_ID.toString()))
                .andExpect(jsonPath("$.bikePins[0].recentTrack.length()").value(3))
                .andExpect(jsonPath("$.bikePins[0].recentTrack[0].longitude").value(127.1))
                .andExpect(jsonPath("$.bikePins[0].recentTrack[2].longitude").value(127.3))
                .andExpect(jsonPath("$.bikePins[0].recentTrack[0].t").isNumber());
    }
```

- [ ] **Step 3: 테스트 실행 → 실패 확인**

Run: `cd development/service-ops-api && ./gradlew test --tests "com.thundercrew.opsapi.DashboardMapApiContractTests.mapStateIncludesRecentTrackSortedAscendingForBike"`
Expected: 컴파일 실패(아직 `recentTrack` 필드/쿼리 없음) 또는 단언 실패.

- [ ] **Step 4: Repository — `findRecentTracks` 쿼리 추가**

`DashboardMapQueryRepository.java`에 메서드 + 내부 record 추가. import에 `java.util.ArrayList`, `java.util.LinkedHashMap`, `java.util.Map` 추가. DTO 참조: `import com.thundercrew.opsapi.dashboard.dto.DashboardMapStateResponse.BikePin;`

```java
    public Map<UUID, List<BikePin.TrackPoint>> findRecentTracks(Instant since, int maxPerBike) {
        List<TrackRow> rows = jdbcTemplate.query("""
                select bike_id, latitude, longitude, received_at
                from (
                    select bike_id, latitude, longitude, received_at,
                           row_number() over (partition by bike_id order by received_at desc) as rn
                    from bike_recent_states
                    where received_at >= ?::timestamptz
                      and latitude is not null
                      and longitude is not null
                ) ranked
                where rn <= ?
                order by bike_id, received_at asc
                """,
                (rs, rowNum) -> new TrackRow(
                        rs.getObject("bike_id", UUID.class),
                        rs.getBigDecimal("latitude"),
                        rs.getBigDecimal("longitude"),
                        rs.getTimestamp("received_at").toInstant().toEpochMilli()),
                since.toString(), maxPerBike);

        Map<UUID, List<BikePin.TrackPoint>> byBike = new LinkedHashMap<>();
        for (TrackRow row : rows) {
            byBike.computeIfAbsent(row.bikeId(), key -> new ArrayList<>())
                    .add(new BikePin.TrackPoint(row.latitude(), row.longitude(), row.t()));
        }
        return byBike;
    }

    private record TrackRow(UUID bikeId, BigDecimal latitude, BigDecimal longitude, long t) {
    }
```

- [ ] **Step 5: Service — 트랙 조회 + `toBikePin` 배선**

`DashboardMapStateService.java`:

(a) 클래스 상단에 상수 추가:

```java
    private static final long TRACK_WINDOW_SECONDS = 120;
    private static final int MAX_TRACK_POINTS = 20;
```

(b) `getMapState()`에서 `currentBikeStates` 조회 직후 트랙 맵을 조회하고, `toBikePin` 호출에 인자를 추가:

```java
        Instant trackSince = generatedAt.minusSeconds(TRACK_WINDOW_SECONDS);
        Map<UUID, List<BikePin.TrackPoint>> tracksByBike =
                dashboardMapQueryRepository.findRecentTracks(trackSince, MAX_TRACK_POINTS);
        List<BikePin> bikePins = currentBikeStates.stream()
                .filter(DashboardMapStateService::hasCoordinates)
                .map(row -> toBikePin(
                        row,
                        generatedAt,
                        assignedOrdersByBike.get(row.bikeId()),
                        tracksByBike.getOrDefault(row.bikeId(), List.of())))
                .toList();
```

`import com.thundercrew.opsapi.dashboard.dto.DashboardMapStateResponse.BikePin;`는 파일에 이미 존재.

(c) `toBikePin` 시그니처에 파라미터 추가 + 생성자 마지막 인자로 전달:

```java
    private BikePin toBikePin(BikePinRow row, Instant generatedAt, List<DispatchOrder> assignedOrders,
            List<BikePin.TrackPoint> recentTrack) {
        // ... 기존 본문 동일 ...
        return new BikePin(
                // ... 기존 인자 전부 동일 ...
                currentDispatch == null ? null : currentDispatch.getKind(),
                dispatchQueueCount,
                recentTrack
        );
    }
```

- [ ] **Step 6: 테스트 실행 → 통과 확인**

Run: `cd development/service-ops-api && ./gradlew test --tests "com.thundercrew.opsapi.DashboardMapApiContractTests"`
Expected: PASS (신규 + 기존 테스트 전부). 기존 `mapStateReturnsControlSummaryBikePinsAndStationPins`는 `recentTrack`이 빈 배열로 추가되어도 단언이 영향받지 않아 그대로 green.

- [ ] **Step 7: Commit**

```bash
git add development/service-ops-api
git commit -m "feat: expose recentTrack on dashboard map-state bike pins"
```

---

## Task 2: 프론트 타입 — recentTrack (raw + frontend) + 정규화

**Files:**
- Modify: `development/front-admin-web/lib/services/service-ops-api.ts`

- [ ] **Step 1: raw 타입에 `recentTrack` 추가**

`ServiceOpsDashboardBikePin` (line ~670) 의 마지막 필드 `dispatchQueueCount?: number | null;` 뒤에 추가:

```ts
  recentTrack?: Array<{ latitude: number | string; longitude: number | string; t: number }>;
```

- [ ] **Step 2: frontend 정규화 타입 추가**

`FrontendDashboardBikePin` (line ~777) — `Omit<ServiceOpsDashboardBikePin, ...>`의 키 목록 마지막(`"dispatchQueueCount"`) 뒤에 `| "recentTrack"`를 추가하고, `& { ... }` 본문 마지막(`dispatchQueueCount: number;`) 뒤에 정규화 필드를 추가:

```ts
export type RealVehicleTrackPoint = { lat: number; lng: number; t: number };

export type FrontendDashboardBikePin = Omit<
  ServiceOpsDashboardBikePin,
  // ... 기존 키 ...
  | "dispatchQueueCount"
  | "recentTrack"
> & {
  // ... 기존 필드 ...
  dispatchQueueCount: number;
  recentTrack: RealVehicleTrackPoint[];
};
```

- [ ] **Step 3: `toFrontendDashboardMapState` 정규화**

(line ~2059) bikePins 매핑 객체의 마지막 필드(`dispatchQueueCount: pin.dispatchQueueCount ?? 0`) 뒤에 추가:

```ts
      dispatchQueueCount: pin.dispatchQueueCount ?? 0,
      recentTrack: (pin.recentTrack ?? []).map((p) => ({
        lat: toNumber(p.latitude),
        lng: toNumber(p.longitude),
        t: p.t
      }))
```

`toNumber`는 같은 파일에서 이미 사용 중.

- [ ] **Step 4: typecheck**

Run: `cd development/front-admin-web && npx tsc --noEmit`
Expected: PASS (no errors). `dashboard-dummy-bikes.ts`가 `FrontendDashboardBikePin`을 합성한다면 `recentTrack` 누락으로 에러가 날 수 있다 — 그 경우 합성 핀에 `recentTrack: []`를 추가한다(시뮬 차량은 트랙 없음).

- [ ] **Step 5: Commit**

```bash
git add development/front-admin-web/lib/services/service-ops-api.ts
git commit -m "feat: add recentTrack to frontend dashboard bike pin type"
```

---

## Task 3: 재생 순수함수 + 유닛 테스트

**Files:**
- Create: `development/front-admin-web/lib/services/real-vehicle-playback.ts`
- Create: `development/front-admin-web/lib/services/real-vehicle-playback.test.mjs`
- Modify: `development/front-admin-web/package.json`

- [ ] **Step 1: 순수함수 구현**

`lib/services/real-vehicle-playback.ts`:

```ts
import type { RealVehicleTrackPoint } from "@/lib/services/service-ops-api";

export type TrackPoint = RealVehicleTrackPoint;

/** 마커가 보여주는 재생 시계의 실시간 대비 지연(ms). */
export const PLAYBACK_LAG_MS = 75_000;
/** 트랙 버퍼 보존 윈도(ms). 이보다 오래된 점은 버린다. */
export const TRACK_RETENTION_MS = 180_000;

/**
 * 기존 버퍼에 새 점들을 합친다: concat → t 중복 제거 → t 오름차순 정렬 →
 * floorMs 이전 점 제거. 입력은 변형하지 않는다(새 배열 반환).
 */
export function mergeTrack(
  existing: ReadonlyArray<TrackPoint>,
  incoming: ReadonlyArray<TrackPoint>,
  floorMs: number
): TrackPoint[] {
  const byTime = new Map<number, TrackPoint>();
  for (const p of existing) byTime.set(p.t, p);
  for (const p of incoming) byTime.set(p.t, p); // 같은 t 는 최신(incoming)으로 덮어씀
  return [...byTime.values()]
    .filter((p) => p.t >= floorMs)
    .sort((a, b) => a.t - b.t);
}

/**
 * clockMs 시점의 보간 위치. 트랙 양 끝을 벗어나면 끝점에 고정(clamp).
 * 점이 2개 미만이면 단일 점 또는 null.
 */
export function interpolateAt(
  track: ReadonlyArray<TrackPoint>,
  clockMs: number
): { lat: number; lng: number } | null {
  if (track.length === 0) return null;
  if (track.length === 1) return { lat: track[0].lat, lng: track[0].lng };
  if (clockMs <= track[0].t) return { lat: track[0].lat, lng: track[0].lng };
  const last = track[track.length - 1];
  if (clockMs >= last.t) return { lat: last.lat, lng: last.lng };

  // clockMs 를 감싸는 인접 두 점 탐색(트랙이 짧아 선형 탐색으로 충분).
  for (let i = 0; i < track.length - 1; i++) {
    const a = track[i];
    const b = track[i + 1];
    if (clockMs >= a.t && clockMs <= b.t) {
      const span = b.t - a.t;
      const f = span === 0 ? 0 : (clockMs - a.t) / span;
      return {
        lat: a.lat + (b.lat - a.lat) * f,
        lng: a.lng + (b.lng - a.lng) * f
      };
    }
  }
  return { lat: last.lat, lng: last.lng };
}

/** 재생 가능 여부 — 보간하려면 최소 2점 필요. */
export function isPlayable(track: ReadonlyArray<TrackPoint>): boolean {
  return track.length >= 2;
}
```

- [ ] **Step 2: 유닛 테스트 작성**

`lib/services/real-vehicle-playback.test.mjs`:

```js
import assert from "node:assert/strict";
import test from "node:test";

import { mergeTrack, interpolateAt, isPlayable } from "./real-vehicle-playback.ts";

test("interpolateAt clamps before first point", () => {
  const track = [{ lat: 0, lng: 0, t: 100 }, { lat: 10, lng: 20, t: 200 }];
  assert.deepEqual(interpolateAt(track, 50), { lat: 0, lng: 0 });
});

test("interpolateAt clamps after last point (parked/stale)", () => {
  const track = [{ lat: 0, lng: 0, t: 100 }, { lat: 10, lng: 20, t: 200 }];
  assert.deepEqual(interpolateAt(track, 500), { lat: 10, lng: 20 });
});

test("interpolateAt linear midpoint", () => {
  const track = [{ lat: 0, lng: 0, t: 100 }, { lat: 10, lng: 20, t: 200 }];
  assert.deepEqual(interpolateAt(track, 150), { lat: 5, lng: 10 });
});

test("interpolateAt single point returns that point", () => {
  assert.deepEqual(interpolateAt([{ lat: 3, lng: 4, t: 100 }], 999), { lat: 3, lng: 4 });
});

test("interpolateAt empty returns null", () => {
  assert.equal(interpolateAt([], 100), null);
});

test("mergeTrack dedups by t, sorts, drops below floor", () => {
  const existing = [{ lat: 0, lng: 0, t: 100 }, { lat: 1, lng: 1, t: 200 }];
  const incoming = [{ lat: 9, lng: 9, t: 200 }, { lat: 2, lng: 2, t: 300 }];
  const merged = mergeTrack(existing, incoming, 150);
  assert.deepEqual(merged.map((p) => p.t), [200, 300]); // 100 dropped, 200 deduped
  assert.deepEqual(merged[0], { lat: 9, lng: 9, t: 200 }); // incoming wins on tie
});

test("isPlayable needs >= 2 points", () => {
  assert.equal(isPlayable([{ lat: 0, lng: 0, t: 1 }]), false);
  assert.equal(isPlayable([{ lat: 0, lng: 0, t: 1 }, { lat: 1, lng: 1, t: 2 }]), true);
});
```

- [ ] **Step 3: test:service-ops 스크립트에 파일 추가**

`package.json`의 `test:service-ops` 스크립트 끝에 ` lib/services/real-vehicle-playback.test.mjs`를 덧붙인다:

```json
    "test:service-ops": "node --experimental-strip-types --test lib/services/service-ops-api.test.mjs lib/services/service-ops-session-core.test.mjs lib/services/real-vehicle-playback.test.mjs"
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `cd development/front-admin-web && npm run test:service-ops`
Expected: PASS (신규 7 테스트 포함 전부).

- [ ] **Step 5: Commit**

```bash
git add development/front-admin-web/lib/services/real-vehicle-playback.ts development/front-admin-web/lib/services/real-vehicle-playback.test.mjs development/front-admin-web/package.json
git commit -m "feat: real-vehicle playback interpolation pure functions + tests"
```

---

## Task 4: usePollingBikePins 훅 (30초 폴링)

**Files:**
- Create: `development/front-admin-web/components/overview/use-polling-bike-pins.ts`

기존 `DashboardCanvas`의 폴링 패턴(자체 `/api/dashboard/map-state` 라우트, `no-store`, 실패 시 이전 스냅샷 유지)을 오버뷰용으로 재사용한다. `document.hidden`이면 폴링 스킵.

- [ ] **Step 1: 훅 구현**

```ts
"use client";

import { useEffect, useRef, useState } from "react";

import type {
  DashboardMapStateResult
} from "@/lib/services/dashboard-map-state-data";
import type { FrontendDashboardBikePin } from "@/lib/services/service-ops-api";

const DEFAULT_POLL_INTERVAL_MS = 30_000;

/**
 * SSR 로 받은 초기 핀을 시드로, `/api/dashboard/map-state` 를 고정 주기로
 * 폴링해 최신 bikePins(recentTrack 포함)를 반환한다. 실패하면 직전 스냅샷
 * 유지. 탭이 백그라운드(`document.hidden`)면 폴링을 건너뛴다.
 *
 * service-ops 쿠키는 라우트(서버) 안에 머무르므로 브라우저는 쿠키를 보지
 * 않는다 — DashboardCanvas 와 동일한 이유로 자체 라우트를 친다.
 */
export function usePollingBikePins(
  initialPins: ReadonlyArray<FrontendDashboardBikePin>,
  pollIntervalMs: number = DEFAULT_POLL_INTERVAL_MS
): ReadonlyArray<FrontendDashboardBikePin> {
  const [pins, setPins] = useState<ReadonlyArray<FrontendDashboardBikePin>>(initialPins);
  const intervalRef = useRef(pollIntervalMs);

  useEffect(() => {
    intervalRef.current = pollIntervalMs;
  }, [pollIntervalMs]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function fetchOnce() {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const response = await fetch("/api/dashboard/map-state", {
          cache: "no-store",
          credentials: "same-origin"
        });
        if (!response.ok) return;
        const next = (await response.json()) as DashboardMapStateResult;
        if (!cancelled) setPins(next.data.bikePins);
      } catch {
        // 이전 스냅샷 유지.
      }
    }

    function schedule() {
      timer = setTimeout(async () => {
        await fetchOnce();
        if (!cancelled) schedule();
      }, intervalRef.current);
    }

    schedule();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  return pins;
}
```

- [ ] **Step 2: typecheck**

Run: `cd development/front-admin-web && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add development/front-admin-web/components/overview/use-polling-bike-pins.ts
git commit -m "feat: usePollingBikePins overview map-state poll hook"
```

---

## Task 5: useRealVehiclePlayback 훅 (250ms 보간 재생)

**Files:**
- Create: `development/front-admin-web/components/overview/use-real-vehicle-playback.ts`

폴링 핀의 `recentTrack`을 bikeId별 ref 버퍼에 누적(merge)하고, 250ms tick마다 `now − PLAYBACK_LAG_MS` 위치를 보간해 **재생 가능한 실차량 핀의 좌표만** override한다. 트랙이 없거나 1점뿐인 핀(시뮬 차량 포함)은 그대로 통과.

- [ ] **Step 1: 훅 구현**

```ts
"use client";

import { useEffect, useRef, useState } from "react";

import type { FrontendDashboardBikePin } from "@/lib/services/service-ops-api";
import {
  PLAYBACK_LAG_MS,
  TRACK_RETENTION_MS,
  type TrackPoint,
  interpolateAt,
  isPlayable,
  mergeTrack
} from "@/lib/services/real-vehicle-playback";

const TICK_MS = 250;

/**
 * 폴링으로 들어온 핀의 recentTrack 을 bikeId 별 버퍼에 누적하고, 250ms
 * tick 마다 playbackClock = now − LAG 의 보간 위치로 실차량 핀 좌표를
 * override 한다. 재생 불가(트랙 < 2)인 핀은 변형 없이 통과시키므로 시뮬
 * 차량(트랙 없음)은 영향받지 않는다.
 *
 * 버퍼는 ref 라 폴링 사이에도 유지된다. tick 이 setState 로 새 배열을
 * 만들어 마커가 매끄럽게 이동.
 */
export function useRealVehiclePlayback(
  pins: ReadonlyArray<FrontendDashboardBikePin>
): FrontendDashboardBikePin[] {
  const buffersRef = useRef<Map<string, TrackPoint[]>>(new Map());
  const pinsRef = useRef(pins);
  const [played, setPlayed] = useState<FrontendDashboardBikePin[]>(() => [...pins]);

  // 폴링으로 핀이 바뀌면 버퍼에 새 트랙을 merge.
  useEffect(() => {
    pinsRef.current = pins;
    const now = Date.now();
    const floor = now - TRACK_RETENTION_MS;
    const buffers = buffersRef.current;
    const liveIds = new Set<string>();
    for (const pin of pins) {
      liveIds.add(pin.bikeId);
      const incoming = pin.recentTrack ?? [];
      if (incoming.length === 0 && !buffers.has(pin.bikeId)) continue;
      const merged = mergeTrack(buffers.get(pin.bikeId) ?? [], incoming, floor);
      if (merged.length > 0) buffers.set(pin.bikeId, merged);
      else buffers.delete(pin.bikeId);
    }
    // 사라진 차량 버퍼 정리.
    for (const id of [...buffers.keys()]) {
      if (!liveIds.has(id)) buffers.delete(id);
    }
  }, [pins]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      const clock = now - PLAYBACK_LAG_MS;
      const floor = now - TRACK_RETENTION_MS;
      const buffers = buffersRef.current;
      const next = pinsRef.current.map((pin) => {
        const track = buffers.get(pin.bikeId);
        if (!track || !isPlayable(track)) return pin;
        // 보존 윈도 밖 점 정리(메모리 상한).
        const trimmed = track.filter((p) => p.t >= floor);
        if (trimmed.length !== track.length) buffers.set(pin.bikeId, trimmed);
        if (!isPlayable(trimmed)) return pin;
        const pos = interpolateAt(trimmed, clock);
        if (!pos) return pin;
        return { ...pin, latitude: pos.lat, longitude: pos.lng };
      });
      setPlayed(next);
    }, TICK_MS);
    return () => clearInterval(timer);
  }, []);

  return played;
}
```

- [ ] **Step 2: typecheck**

Run: `cd development/front-admin-web && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add development/front-admin-web/components/overview/use-real-vehicle-playback.ts
git commit -m "feat: useRealVehiclePlayback 250ms interpolation tick"
```

---

## Task 6: FullscreenMapHost 배선 (폴링 → 재생 → 시뮬)

**Files:**
- Modify: `development/front-admin-web/components/overview/FullscreenMapHost.tsx`

`overlaidBikePins`(line ~112)가 마커·검색·`bikePinById`(상세/follow)를 모두 먹이므로, 그 **입력만** 체인으로 교체하면 다운스트림 전체가 live가 된다. `seedBikePins`는 시뮬 차량 식별/진행 보존을 위해 **SSR prop(`bikePins`)에 그대로** 둔다(폴링 핀으로 바꾸면 30초마다 시뮬이 리셋됨).

- [ ] **Step 1: import 추가**

파일 상단 import 블록에 추가:

```ts
import { usePollingBikePins } from "@/components/overview/use-polling-bike-pins";
import { useRealVehiclePlayback } from "@/components/overview/use-real-vehicle-playback";
```

- [ ] **Step 2: 체인 배선**

기존 (line ~112-113):

```ts
  const overlaidBikePins = useSimulatedBikePins(bikePins);
  const trailWaypoints = useTrailWaypoints(selectedBikeId);
```

으로 교체:

```ts
  const polledPins = usePollingBikePins(bikePins);
  const playedPins = useRealVehiclePlayback(polledPins);
  const overlaidBikePins = useSimulatedBikePins(playedPins);
  const trailWaypoints = useTrailWaypoints(selectedBikeId, playedPins);
```

`seedBikePins(bikePins)` 효과(line ~115-117)와 deps는 **변경하지 않는다**(SSR prop 유지).

- [ ] **Step 3: typecheck**

Run: `cd development/front-admin-web && npx tsc --noEmit`
Expected: `useTrailWaypoints` 의 2번째 인자가 아직 없으면 에러 — 이는 Task 7에서 시그니처를 확장해 해소한다. Task 7을 먼저 끝내고 이 단계를 재실행하거나, Task 6과 7을 한 묶음으로 진행한다.

- [ ] **Step 4: Commit**

```bash
git add development/front-admin-web/components/overview/FullscreenMapHost.tsx
git commit -m "feat: wire polling + real-vehicle playback into overview map host"
```

---

## Task 7: 선택 차량 trail (실차량 stub 채우기)

**Files:**
- Modify: `development/front-admin-web/components/overview/use-trail-waypoints.ts`

`useTrailWaypoints`의 실차량 분기(`return null`)를, 선택 차량의 live 핀 `recentTrack`을 polyline waypoint로 반환하도록 채운다. 시뮬 분기는 그대로.

- [ ] **Step 1: 시그니처 + 실차량 분기 구현**

import 추가:

```ts
import type { FrontendDashboardBikePin } from "@/lib/services/service-ops-api";
```

함수 시그니처에 핀 배열 인자 추가하고 실차량 분기 교체:

```ts
export function useTrailWaypoints(
  selectedBikeId: string | null,
  pins: ReadonlyArray<FrontendDashboardBikePin>
): ReadonlyArray<TrailWaypoint> | null {
  const { simulated } = useFleetSimulation();

  return useMemo(() => {
    if (!selectedBikeId) return null;

    // IMEI=-1 시뮬 차량
    const sim = simulated.get(selectedBikeId);
    if (sim) {
      if (
        sim.phase === "MOVING" &&
        sim.routeWaypoints !== null &&
        sim.routeWaypoints.length >= 2
      ) {
        return traveledWaypoints(sim.routeWaypoints, sim.progress);
      }
      return null;
    }

    // 실제 차량 — 선택 차량의 recentTrack 을 polyline 으로. 2점 미만이면 미표시.
    const pin = pins.find((p) => p.bikeId === selectedBikeId);
    const track = pin?.recentTrack ?? [];
    if (track.length < 2) return null;
    return track.map((p) => ({ lat: p.lat, lng: p.lng }));
  }, [selectedBikeId, simulated, pins]);
}
```

함수 상단 JSDoc의 "실제 차량 — stub: 현재 null" 문구도 실제 동작에 맞게 수정한다.

- [ ] **Step 2: typecheck (Task 6 포함 전체)**

Run: `cd development/front-admin-web && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add development/front-admin-web/components/overview/use-trail-waypoints.ts
git commit -m "feat: real-vehicle trail polyline from recentTrack for selected bike"
```

---

## Task 8: 최종 검증 + PR

**Files:** (없음 — 검증/PR)

- [ ] **Step 1: 프론트 전체 검증**

Run: `cd development/front-admin-web && npm run test:service-ops && npx tsc --noEmit && npm run lint`
Expected: 모두 PASS.

- [ ] **Step 2: 백엔드 검증**

Run: `cd development/service-ops-api && ./gradlew test --tests "com.thundercrew.opsapi.DashboardMapApiContractTests"`
Expected: PASS.

- [ ] **Step 3: 런타임 관측 (배포 후 — verify 스킬)**

  - 데이터 흐름: `recentTrack`이 비어도 마커가 정상 표시되는지(정차 차량) + 주행 차량이 부드럽게 이동하는지.
  - prod 배포 후 #510 raw 로그로 drivingDetail 배치 도착 확인 → 같은 시간대에 지도 마커가 끊김 없이 글라이딩하는지 관측. (NT는 주행 중에만 오므로, 실주행 또는 sim 차량으로 회귀 없음 확인.)
  - ⚠️ 사용자가 자체 dev 서버를 돌리므로 경쟁 프리뷰 서버는 띄우지 않는다(메모리 [[feedback_preview_workflow]]). HTTP/빌드/로그로 검증.

- [ ] **Step 4: PR (→ dev)**

```bash
git push -u origin cc-realvehicle-marker-playback
gh pr create --base dev --head cc-realvehicle-marker-playback \
  --title "feat: 실차량 마커 1분 글라이딩 재생" \
  --body "## 요약
- 백엔드: map-state pin에 recentTrack(최근 120초 점) 추가
- 프론트: 30초 폴링 + 250ms 보간 재생(LAG 75s)으로 모든 주행 실차량 마커 글라이딩
- 선택 차량 trail polyline / 시뮬 차량 무영향

스펙: docs/superpowers/specs/2026-06-29-real-vehicle-marker-playback-design.md"
```

---

## Self-Review

- **Spec coverage:** ✅ 백엔드 recentTrack(Task 1) / 폴링(Task 4) / 재생 엔진(Task 3,5) / 머지(Task 6) / 선택 trail(Task 7) / 테스트(Task 1,3) — 스펙 항목 전부 task로 매핑.
- **Placeholder scan:** 없음. LAG/윈도/주기는 상수로 명시.
- **Type consistency:** `RealVehicleTrackPoint{lat,lng,t}`(frontend) ↔ `TrackPoint`(playback alias) ↔ backend `TrackPoint{latitude,longitude,t}`(JSON→정규화 Task 2). `recentTrack` 명칭 전 구간 일치. `interpolateAt`/`mergeTrack`/`isPlayable` 시그니처가 Task 3 정의와 Task 5 사용처 일치. `useTrailWaypoints(selectedBikeId, pins)` 2-인자가 Task 6 호출과 Task 7 정의 일치.
- **YAGNI:** 따라잡기/하이브리드/전체 trail/서버 push 제외 — 스펙대로.
