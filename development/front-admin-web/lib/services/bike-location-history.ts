/**
 * 차량 GPS 이력 조회.
 *
 * 백엔드 API `/telemetry/bikes/:bikeId/location-history` 완성 후 실제 fetch 로 교체.
 * 현재는 항상 빈 배열 반환 → 실제 차량 경로선 미표시.
 */
export type BikeLocationPoint = {
  lat: number;
  lng: number;
  recordedAt?: string;
};

export async function fetchBikeLocationHistory(
  _bikeId: string
): Promise<BikeLocationPoint[]> {
  return [];
}
