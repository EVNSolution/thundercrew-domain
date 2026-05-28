import type { FrontendDashboardBikePin, FrontendVehicle } from "@/lib/services/service-ops-api";
import type { VehicleCurrentTelemetrySummary } from "@/lib/services/vehicle-maintenance-data";

/**
 * 텔레메트리가 아직 없는 등록 차량에 대해 deterministic 더미 텔레메트리를
 * 생성한다. bikeId 를 seed 로 쓰므로 폴링 / 화면 reload 마다 값이 튀지 않고
 * 서버 재시작에도 같은 차량은 같은 값으로 보인다.
 *
 * 운영자가 받은 실 텔레메트리 스펙(차량 속도, 차량 총주행거리, 연료 잔량,
 * 시간 정보, 위치 정보) 다섯 필드 모두에 대해 값을 생성. 표(`bikePins`) 와
 * 차량 상세 패널(`bundle.currentState`) 두 소비처가 동일한 시뮬레이터 결과를
 * 보도록 통합 — 같은 차량이 표에서는 90% 잔량인데 상세에선 다른 값으로 뜨는
 * 불일치 방지.
 *
 * 실제 텔레메트리가 들어오면 backend 가 진짜 데이터를 응답하므로 fallback 이
 * 자동으로 건너뛴다.
 */

// 서울 근방 좌표 범위. 위치는 demo 용도라 실제 차량 운영 영역과 겹치지 않게
// 고정 박스만 잡는다.
const LAT_MIN = 37.44;
const LAT_MAX = 37.65;
const LNG_MIN = 126.87;
const LNG_MAX = 127.10;

// 누적 주행거리 가상 범위 — 짧게 운영된 차량 ~ 어느 정도 마일리지 쌓인 차량
// 까지 자연스러운 분포. 실제 차량 odometer 도 이 범위 안이 일반적.
const ODOMETER_KM_MIN = 800;
const ODOMETER_KM_MAX = 15_000;

/**
 * 문자열을 seed 로 0~1 사이 deterministic 숫자를 생성하는 간단한 해시. 암호
 * 학적 보안 불필요 — bike 별 분산만 되면 충분.
 */
function hashToFloat(seed: string, salt: number): number {
  let h = salt;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  return ((h >>> 0) % 10_000) / 10_000;
}

type SimulatedBikeTelemetry = {
  latitude: number;
  longitude: number;
  speedKph: number;
  batteryPercent: number;
  batteryStatus: "LOW" | "MEDIUM" | "HEALTHY" | "CRITICAL";
  ignitionStatus: "ON" | "OFF";
  drivingStatus: "DRIVING" | "PARKED" | "STOPPED";
  odometerKm: number;
  lastReceivedAt: string;
};

/**
 * bikeId 한 건에 대해 텔레메트리 모든 필드를 일관되게 시뮬레이션. 같은 bikeId
 * 면 같은 결과 — `salt` 값들이 서로 다른 필드를 같은 hash 로 가져가지 않도록
 * 분리되어 있다. `now` 는 lastReceivedAt 으로 사용 — 호출 시점마다 살짝 갱신
 * 되어 "방금 수신" 으로 보임.
 */
function simulateBikeTelemetry(bikeId: string, now: Date = new Date()): SimulatedBikeTelemetry {
  const lat = LAT_MIN + hashToFloat(bikeId, 1) * (LAT_MAX - LAT_MIN);
  const lng = LNG_MIN + hashToFloat(bikeId, 2) * (LNG_MAX - LNG_MIN);
  const battery = Math.round(hashToFloat(bikeId, 3) * 100);
  const isDriving = hashToFloat(bikeId, 4) > 0.5;
  const speedKph = isDriving ? Math.round(hashToFloat(bikeId, 5) * 40 + 10) : 0;
  const odometerKm = Math.round(
    ODOMETER_KM_MIN + hashToFloat(bikeId, 6) * (ODOMETER_KM_MAX - ODOMETER_KM_MIN)
  );

  const batteryStatus: SimulatedBikeTelemetry["batteryStatus"] =
    battery < 20 ? "CRITICAL" : battery <= 50 ? "LOW" : "HEALTHY";

  return {
    latitude: lat,
    longitude: lng,
    speedKph,
    batteryPercent: battery,
    batteryStatus,
    ignitionStatus: isDriving ? "ON" : "OFF",
    drivingStatus: isDriving ? "DRIVING" : "PARKED",
    odometerKm,
    lastReceivedAt: now.toISOString()
  };
}

/**
 * 등록된 차량 목록과 현재 텔레메트리 핀 목록을 비교해서, 텔레메트리가 없는
 * 차량에 대해 시뮬레이션 핀을 생성한다. 표 컬럼(속도/잔량/연결/시동) 이 이
 * 핀에서 값을 가져온다.
 */
export function generatePinsForUntrackedVehicles(
  vehicles: FrontendVehicle[],
  existingBikeIds: Set<string>
): FrontendDashboardBikePin[] {
  const now = new Date();

  return vehicles
    .filter((v) => v.slug && !existingBikeIds.has(v.slug))
    .map((vehicle) => {
      const id = vehicle.slug;
      const sim = simulateBikeTelemetry(id, now);

      return {
        bikeId: id,
        slug: id,
        bikeIdx: vehicle.idx ?? null,
        plateNumber: vehicle.plateNumber,
        modelName: vehicle.model,
        operationStatus: vehicle.operationStatus ?? "READY",
        activeRiderLabel: null,
        deviceId: null,
        lastReceivedAt: sim.lastReceivedAt,
        latitude: sim.latitude,
        longitude: sim.longitude,
        speedKph: sim.speedKph,
        batteryPercent: sim.batteryPercent,
        ignitionStatus: sim.ignitionStatus,
        telemetrySource: "SIMULATED",
        drivingStatus: sim.drivingStatus,
        connectionStatus: "ONLINE" as const,
        batteryStatus: sim.batteryStatus === "HEALTHY" ? "NORMAL" : sim.batteryStatus,
        pinLabel: vehicle.plateNumber,
        serviceType: vehicle.serviceType ?? "DELIVERY",
        nextCustomerLat: null,
        nextCustomerLng: null
      };
    });
}

/**
 * 차량 상세 패널이 backend 의 `getBikeCurrentState` 에서 null 을 받았을 때
 * 쓰는 시뮬레이션 fallback. `generatePinsForUntrackedVehicles` 와 같은
 * `simulateBikeTelemetry` 결과를 공유해 표와 상세 패널이 같은 값을 보이게
 * 한다.
 *
 * `bikeId` 가 빈 문자열이면 null — 잘못된 식별자에 대해 가짜 값을 만들지
 * 않는다.
 */
export function simulateBikeCurrentTelemetrySummary(
  bikeId: string
): VehicleCurrentTelemetrySummary | null {
  if (!bikeId) return null;
  const sim = simulateBikeTelemetry(bikeId);
  return {
    odometerKm: sim.odometerKm,
    connectionStatus: "ONLINE",
    ignitionStatus: sim.ignitionStatus,
    batteryPercent: sim.batteryPercent,
    batteryStatus: sim.batteryStatus === "HEALTHY" ? "NORMAL" : sim.batteryStatus,
    speedKph: sim.speedKph,
    drivingStatus: sim.drivingStatus,
    lastReceivedAt: sim.lastReceivedAt
  };
}
