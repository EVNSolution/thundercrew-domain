# 라이더 P1 코어 UI 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox.

**Goal:** 라이더 홈에 내 업무(배차)·차량 위치 지도·주행거리 표시. 백엔드 read 2개 + 프론트 홈 확장.

**Architecture:** 백엔드는 `RiderSelfReadController`에 GET 2개 추가(dispatch/bike/telemetry read 집계). 프론트는 rider-api 확장 + `/rider` 서버컴포넌트 확장 + 경량 NCP 지도 client 컴포넌트.

**Tech Stack:** Spring Boot, Next.js, NCP Maps.

스펙: `docs/superpowers/specs/2026-06-17-rider-p1-core-ui-design.md`. 백엔드 식별자는 Explore로 확인됨(아래 명시).

---

## Task 1 — 백엔드 라이더 read 2개 + 계약 테스트

**Files:**
- Modify: `dispatch/service/DispatchOrderReadService.java` (메서드 추가)
- Create: `rider/dto/RiderVehicleResponse.java`
- Create: `rider/service/RiderVehicleReadService.java`
- Modify: `rider/controller/RiderSelfReadController.java` (GET 2개 추가)
- Create test: `src/test/java/com/thundercrew/opsapi/RiderSelfReadApiContractTests.java`

### Step 1: `DispatchOrderReadService`에 ASSIGNED-by-bike 목록 메서드 추가
기존 `currentByBike`/`listByBike` 옆에 추가. repo 메서드 `findByBikeIdAndStatusAndDeletedAtIsNullOrderBySequenceAsc(bikeId, DispatchOrderStatus.ASSIGNED)` 사용, 기존 매핑 방식(같은 클래스의 toResponse 매퍼) 재사용:
```java
@Transactional(readOnly = true)
public java.util.List<DispatchOrderReadResponse> listAssignedByBike(java.util.UUID bikeId) {
    return dispatchOrderRepository
            .findByBikeIdAndStatusAndDeletedAtIsNullOrderBySequenceAsc(bikeId, DispatchOrderStatus.ASSIGNED)
            .stream()
            .map(this::toResponse)   // 기존 private 매퍼 이름에 맞춰 사용 (currentByBike가 쓰는 것과 동일)
            .toList();
}
```
> 구현 시 이 클래스의 기존 매퍼 메서드명을 확인해 그대로 쓸 것(예: `toResponse`/`map`). repo 필드명도 기존 그대로.

### Step 2: `RiderVehicleResponse` DTO 생성
```java
package com.thundercrew.opsapi.rider.dto;

import com.thundercrew.opsapi.bike.domain.BikeServiceType;
import java.time.Instant;
import java.util.UUID;

public record RiderVehicleResponse(
        UUID bikeId,
        String plateNumber,
        String imei,
        BikeServiceType serviceType,
        Double currentLatitude,
        Double currentLongitude,
        Integer odometerKm,
        String connectionStatus,
        Instant lastReceivedAt
) {
}
```

### Step 3: `RiderVehicleReadService` 생성
`BikeReadService`(또는 `BikeRepository.findByIdAndDeletedAtIsNull`) + `BikeCurrentStateRepository.findByBikeId` + `TelemetryConnection.status` 사용. 활성 차량 없으면 404. 텔레메트리 없으면 위치/odometer/connection null.
```java
package com.thundercrew.opsapi.rider.service;

import com.thundercrew.opsapi.bike.domain.Bike;
import com.thundercrew.opsapi.bike.repository.BikeRepository;
import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import com.thundercrew.opsapi.contract.repository.RiderBikeContractRepository;
import com.thundercrew.opsapi.rider.dto.RiderVehicleResponse;
import com.thundercrew.opsapi.telemetry.domain.BikeCurrentState;
import com.thundercrew.opsapi.telemetry.domain.TelemetryConnection;
import com.thundercrew.opsapi.telemetry.repository.BikeCurrentStateRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RiderVehicleReadService {

    private final RiderBikeContractRepository contractRepository;
    private final BikeRepository bikeRepository;
    private final BikeCurrentStateRepository currentStateRepository;
    private final Clock clock;

    public RiderVehicleReadService(
            RiderBikeContractRepository contractRepository,
            BikeRepository bikeRepository,
            BikeCurrentStateRepository currentStateRepository,
            Clock clock
    ) {
        this.contractRepository = contractRepository;
        this.bikeRepository = bikeRepository;
        this.currentStateRepository = currentStateRepository;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public RiderVehicleResponse getMyVehicle(UUID riderId) {
        UUID bikeId = contractRepository.findActiveByRiderId(riderId)
                .map(c -> c.getBikeId())
                .orElseThrow(() -> new ResourceNotFoundException("RiderVehicle", riderId));
        Bike bike = bikeRepository.findByIdAndDeletedAtIsNull(bikeId)
                .orElseThrow(() -> new ResourceNotFoundException("Bike", bikeId));

        BikeCurrentState state = currentStateRepository.findByBikeId(bikeId).orElse(null);
        Double lat = null, lng = null;
        Integer odo = null;
        String connection = null;
        Instant lastReceivedAt = null;
        if (state != null) {
            lat = state.getLatitude() == null ? null : state.getLatitude().doubleValue();
            lng = state.getLongitude() == null ? null : state.getLongitude().doubleValue();
            odo = state.getOdometerKm();
            lastReceivedAt = state.getLastReceivedAt();
            connection = TelemetryConnection.status(state.getLastReceivedAt(), Instant.now(clock));
        }
        return new RiderVehicleResponse(
                bike.getId(), bike.getPlateNumber(), bike.getImei(), bike.getServiceType(),
                lat, lng, odo, connection, lastReceivedAt);
    }

    // riderId가 곧 활성 차량으로 매핑되는지 외부에서 쓰려면 노출; dispatch endpoint는 컨트롤러에서 contractRepository로 bikeId 도출.
    @Transactional(readOnly = true)
    public UUID activeBikeIdOrNull(UUID riderId) {
        return contractRepository.findActiveByRiderId(riderId).map(c -> c.getBikeId()).orElse(null);
    }
}
```
> `BikeCurrentState` getter명(`getLatitude`/`getLongitude`/`getOdometerKm`/`getLastReceivedAt`)과 `TelemetryConnection.status(Instant,Instant)` 시그니처는 Explore 확인됨. 다르면 실제에 맞춰 조정.

### Step 4: `RiderSelfReadController`에 GET 2개 추가
```java
@GetMapping("/me/dispatch-orders")
java.util.List<DispatchOrderReadResponse> myDispatchOrders(@AuthenticationPrincipal Jwt jwt) {
    UUID riderId = UUID.fromString(jwt.getClaimAsString("riderId"));
    UUID bikeId = riderVehicleReadService.activeBikeIdOrNull(riderId);
    if (bikeId == null) {
        return java.util.List.of();
    }
    return dispatchOrderReadService.listAssignedByBike(bikeId);
}

@GetMapping("/me/vehicle")
RiderVehicleResponse myVehicle(@AuthenticationPrincipal Jwt jwt) {
    UUID riderId = UUID.fromString(jwt.getClaimAsString("riderId"));
    return riderVehicleReadService.getMyVehicle(riderId);
}
```
생성자에 `DispatchOrderReadService`, `RiderVehicleReadService` 주입 추가. import 추가(DispatchOrderReadResponse, DispatchOrderReadService, RiderVehicleResponse, List, etc.).

### Step 5: 계약 테스트 `RiderSelfReadApiContractTests`
`RiderAuthApiContractTests` 패턴 복제(PostgresContainerSupport, admin 시드, 라이더 시드 + credential 발급 + 라이더 로그인). 시나리오:
- 활성 계약 + bike + ASSIGNED 주문 2건 시드 → `GET /me/dispatch-orders` 200, 길이 2, sequence순.
- 활성 차량 없는 라이더 → `GET /me/dispatch-orders` 200 `[]`.
- bike + `bike_current_states` 시드(lat/lng/odometer) → `GET /me/vehicle` 200, plateNumber·latitude·odometerKm 일치, connectionStatus 존재.
- 텔레메트리 없는 bike → `GET /me/vehicle` 200, latitude/odometerKm/connectionStatus null.
- 활성 차량 없는 라이더 → `GET /me/vehicle` 404.
- 미인증 `GET /me/vehicle` → 401.
시드는 jdbcTemplate raw insert(테이블: riders, rider_bike_contracts, bikes, dispatch_orders, bike_current_states, rider_credentials, admin_users). 컬럼은 각 엔티티/마이그레이션 확인해 맞출 것.

### Step 6: 빌드 + 테스트
`cd development/service-ops-api`
`./gradlew compileJava compileTestJava -q` → 통과
`./gradlew test --tests "*RiderSelfReadApiContractTests" --tests "*ArchitectureBoundaryTests" -q` → 라이더 테스트 통과, ArchUnit 새 위반 0 (기존 issue_70 pre-red는 무관).
(로컬 Docker 없으면 계약 테스트는 컴파일만 확인 — CI/배포에서 실행.)

### Step 7: 커밋
`git add -A && git commit -m "feat(rider): /me/dispatch-orders + /me/vehicle read API"`

---

## Task 2 — 프론트 라이더 홈(업무·지도·주행거리)

**Files:**
- Modify: `lib/services/rider-api.ts` (타입 + 함수 2개)
- Create: `components/rider/RiderMap.tsx` (client)
- Modify: `app/rider/page.tsx` (3섹션)
- Modify: `app/globals.css` (라이더 카드/지도 스타일, 기존 패턴 따라)

### Step 1: `rider-api.ts` 확장
```ts
export type RiderDispatchOrder = {
  id: string;
  bikeId: string;
  customerName: string;
  customerPhone: string;
  address: string;
  latitude: number;
  longitude: number;
  originAddress: string | null;
  originLatitude: number | null;
  originLongitude: number | null;
  sequence: number;
  status: string;
  kind: string; // "PICKUP" | "DELIVERY"
};

export type RiderVehicle = {
  bikeId: string;
  plateNumber: string;
  imei: string | null;
  serviceType: string;
  currentLatitude: number | null;
  currentLongitude: number | null;
  odometerKm: number | null;
  connectionStatus: string | null;
  lastReceivedAt: string | null;
};

export function riderGetDispatchOrders(accessToken: string): Promise<RiderDispatchOrder[]> {
  return call<RiderDispatchOrder[]>("/rider/me/dispatch-orders", { method: "GET" }, accessToken);
}

export async function riderGetVehicle(accessToken: string): Promise<RiderVehicle | null> {
  try {
    return await call<RiderVehicle>("/rider/me/vehicle", { method: "GET" }, accessToken);
  } catch (e) {
    if (e instanceof RiderApiError && e.status === 404) return null;
    throw e;
  }
}
```

### Step 2: `RiderMap.tsx` (경량 NCP 지도)
```tsx
"use client";

import { useEffect, useRef } from "react";
import { loadNcpMapsSdk } from "@/lib/maps/load-ncp-sdk";
import type { RiderDispatchOrder, RiderVehicle } from "@/lib/services/rider-api";

type Props = { vehicle: RiderVehicle | null; orders: RiderDispatchOrder[] };

const SEOUL = { lat: 37.5665, lng: 126.978 };

export default function RiderMap({ vehicle, orders }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let map: any;
    let cancelled = false;
    loadNcpMapsSdk()
      .then(() => {
        if (cancelled || !ref.current) return;
        const naver = (window as any).naver;
        if (!naver?.maps) return;
        const hasVehicle = vehicle?.currentLatitude != null && vehicle?.currentLongitude != null;
        const center = hasVehicle
          ? { lat: vehicle!.currentLatitude!, lng: vehicle!.currentLongitude! }
          : orders.length > 0
            ? { lat: orders[0].latitude, lng: orders[0].longitude }
            : SEOUL;
        map = new naver.maps.Map(ref.current, {
          center: new naver.maps.LatLng(center.lat, center.lng),
          zoom: 13
        });
        const bounds = new naver.maps.LatLngBounds();
        let any = false;
        orders.forEach((o, i) => {
          const pos = new naver.maps.LatLng(o.latitude, o.longitude);
          new naver.maps.Marker({
            position: pos, map,
            icon: { content: destPinSvg(i + 1), anchor: new naver.maps.Point(12, 28), size: new naver.maps.Size(24, 30) }
          });
          bounds.extend(pos); any = true;
        });
        if (hasVehicle) {
          const pos = new naver.maps.LatLng(vehicle!.currentLatitude!, vehicle!.currentLongitude!);
          new naver.maps.Marker({
            position: pos, map,
            icon: { content: bikePinSvg(), anchor: new naver.maps.Point(14, 14), size: new naver.maps.Size(28, 28) }
          });
          bounds.extend(pos); any = true;
        }
        if (any && (orders.length + (hasVehicle ? 1 : 0)) > 1) map.fitBounds(bounds);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [vehicle, orders]);

  const empty = (!vehicle || vehicle.currentLatitude == null) && orders.length === 0;
  return (
    <div style={{ position: "relative", width: "100%", height: 260, borderRadius: 12, overflow: "hidden", background: "#e5e7eb" }}>
      <div ref={ref} style={{ width: "100%", height: "100%" }} />
      {empty ? (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#6b7280", fontSize: 14 }}>
          표시할 위치가 없습니다
        </div>
      ) : null}
    </div>
  );
}

function destPinSvg(n: number): string {
  return `<div style="display:grid;place-items:center;width:24px;height:30px;color:#fff;font:700 11px sans-serif">
    <svg width="24" height="30" viewBox="0 0 24 30" style="position:absolute"><path d="M12 0C5.4 0 0 5.4 0 12c0 8 12 18 12 18s12-10 12-18C24 5.4 18.6 0 12 0z" fill="#2563eb"/></svg>
    <span style="position:relative;top:-3px">${n}</span></div>`;
}
function bikePinSvg(): string {
  return `<div style="width:28px;height:28px;border-radius:50%;background:#16a34a;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);display:grid;place-items:center;color:#fff;font:700 12px sans-serif">🛵</div>`;
}
```
> `loadNcpMapsSdk`, `@/types/naver-maps` 존재 확인됨. `any` 캐스팅 최소화하되 타입이 번거로우면 naver 전역은 `(window as any).naver` 허용(MapShell도 유사). lint 통과 필수 — 미사용 import/var 없게.

### Step 3: `app/rider/page.tsx` 확장
서버 컴포넌트. `getMe` 후 activeBikeId 있으면 `riderGetDispatchOrders` + `riderGetVehicle` 병렬. 섹션: 프로필 헤더 → 주행거리 카드(odometerKm ?? "—" + 번호판 + connectionStatus 칩) → `<RiderMap vehicle orders />` → 내 업무 목록(카드: kind 배지, 고객명, 전화 `tel:` 링크, 주소, originAddress 있으면 출발지) → 로그아웃 form. 빈 상태 문구 포함. activeBikeId null이면 "배정된 차량이 없습니다"만.
```tsx
const accessToken = await getRiderAccessToken();
// ... me fetch ...
let vehicle = null; let orders = [];
if (me.activeBikeId) {
  [vehicle, orders] = await Promise.all([riderGetVehicle(accessToken), riderGetDispatchOrders(accessToken)]);
}
```
(타입 import: RiderVehicle, RiderDispatchOrder. RiderMap는 client라 page에서 직접 import해 props 전달 가능.)

### Step 4: `globals.css` 라이더 스타일 (선택, 기존 패턴 따라 최소)
카드/리스트/칩 클래스 몇 개. 인라인 스타일로 충분하면 생략 가능.

### Step 5: 검증
`cd development/front-admin-web && npm run typecheck && npm run lint && npm run build`
통과 + `/rider` 라우트 생성. 경쟁 dev 서버 띄우지 말 것.

### Step 6: 커밋
`git add -A && git commit -m "feat(rider): home with tasks, vehicle map, odometer"`

---

## Self-Review
- 스펙 커버: dispatch-orders/vehicle 엔드포인트(T1), 홈 3섹션+지도(T2). 텔레메트리 graceful null(T1 vehicle, T2 빈 상태) — 일치.
- 타입 일관성: 백엔드 `RiderVehicleResponse` ↔ 프론트 `RiderVehicle` 필드 1:1. dispatch DTO ↔ `RiderDispatchOrder`.
- 인프라: NCP origin 허용목록(rider 호스트)은 코드 밖 — 스펙에 명시, 배포 후 사용자 적용.
- Placeholder 없음(식별자 일부는 "실제 확인" 주석으로 표시 — 구현 시 검증).
