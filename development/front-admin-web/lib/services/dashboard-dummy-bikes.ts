import type { FrontendDashboardBikePin, FrontendVehicle } from "@/lib/services/service-ops-api";

/**
 * 텔레메트리가 아직 없는 등록 차량에 대해 서울 근방 deterministic random
 * 좌표를 생성해서 지도 핀으로 표시한다. bikeId를 seed로 쓰므로 폴링마다
 * 위치가 튀지 않고, 서버 재시작해도 같은 차량은 같은 위치에 표시된다.
 *
 * 실제 텔레메트리가 들어오면 해당 차량은 이미 bikePins에 포함되므로
 * 자동으로 이 로직을 건너뛴다.
 */

// 서울 근방 좌표 범위
const LAT_MIN = 37.44;
const LAT_MAX = 37.65;
const LNG_MIN = 126.87;
const LNG_MAX = 127.10;

/**
 * 문자열을 seed로 0~1 사이 deterministic 숫자를 생성하는 간단한 해시.
 * 암호학적 보안은 불필요 — 위치 분산만 되면 충분.
 */
function hashToFloat(seed: string, salt: number): number {
  let h = salt;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  return ((h >>> 0) % 10000) / 10000;
}

/**
 * 등록된 차량 목록과 현재 텔레메트리 핀 목록을 비교해서,
 * 텔레메트리가 없는 차량에 대해 랜덤 좌표 핀을 생성한다.
 */
export function generatePinsForUntrackedVehicles(
  vehicles: FrontendVehicle[],
  existingBikeIds: Set<string>
): FrontendDashboardBikePin[] {
  const generatedAt = new Date().toISOString();

  return vehicles
    .filter((v) => v.slug && !existingBikeIds.has(v.slug))
    .map((vehicle) => {
      const id = vehicle.slug;
      const lat = LAT_MIN + hashToFloat(id, 1) * (LAT_MAX - LAT_MIN);
      const lng = LNG_MIN + hashToFloat(id, 2) * (LNG_MAX - LNG_MIN);
      const battery = Math.round(hashToFloat(id, 3) * 100);
      const isDriving = hashToFloat(id, 4) > 0.5;
      const batteryStatus = battery <= 20 ? "LOW" : battery <= 50 ? "MEDIUM" : "HEALTHY";

      return {
        bikeId: id,
        slug: id,
        bikeIdx: vehicle.idx ?? null,
        plateNumber: vehicle.plateNumber,
        modelName: vehicle.model,
        operationStatus: vehicle.operationStatus ?? "READY",
        activeRiderLabel: null,
        deviceId: null,
        lastReceivedAt: generatedAt,
        latitude: lat,
        longitude: lng,
        speedKph: isDriving ? Math.round(hashToFloat(id, 5) * 40 + 10) : 0,
        batteryPercent: battery,
        ignitionStatus: isDriving ? "ON" : "OFF",
        telemetrySource: "SIMULATED",
        drivingStatus: isDriving ? "DRIVING" : "PARKED",
        connectionStatus: "ONLINE" as const,
        batteryStatus,
        pinLabel: vehicle.plateNumber
      };
    });
}
