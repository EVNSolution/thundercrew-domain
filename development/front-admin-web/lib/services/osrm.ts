/**
 * OSRM public demo 서버에서 두 좌표 간 도로 경로를 fetch.
 *
 * 반환: 경유점 배열 ({lat, lng}[]). 실패(네트워크 오류, timeout, 4xx/5xx)
 * 시 빈 배열 반환 — 호출부는 빈 배열을 받으면 routeWaypoints 를 null 로
 * 유지해 직선 lerp fallback 으로 처리한다.
 *
 * OSRM 좌표 순서는 [lng, lat] — 반환 시 {lat, lng} 로 변환.
 * `AbortSignal.timeout` 은 Node 17.3+ / 모던 브라우저에서 지원.
 */
export async function fetchOsrmRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<ReadonlyArray<{ lat: number; lng: number }>> {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${origin.lng},${origin.lat};${destination.lng},${destination.lat}` +
    `?overview=full&geometries=geojson`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      routes?: Array<{
        geometry?: { coordinates?: Array<[number, number]> };
      }>;
    };
    const coords = json.routes?.[0]?.geometry?.coordinates ?? [];
    return coords.map(([lng, lat]) => ({ lat, lng }));
  } catch {
    return [];
  }
}
