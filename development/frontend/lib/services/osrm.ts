/**
 * OSRM public demo 서버에서 두 좌표 간 도로 경로를 fetch.
 *
 * 반환: { waypoints, durationSeconds }. 실패(네트워크 오류, timeout,
 * 4xx/5xx) 시 빈 경유점 + duration null — 호출부는 routeWaypoints 를 null 로
 * 유지해 직선 lerp fallback 으로 처리한다.
 *
 * durationSeconds 는 실도로 소요시간이다. 시뮬 이동 시간을 이 값으로 맞추면
 * 화면의 "도착 예정"(같은 OSRM 값)과 실제 도착이 일치한다.
 *
 * OSRM 좌표 순서는 [lng, lat] — 반환 시 {lat, lng} 로 변환.
 * `AbortSignal.timeout` 은 Node 17.3+ / 모던 브라우저에서 지원.
 */
export async function fetchOsrmRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<{ waypoints: ReadonlyArray<{ lat: number; lng: number }>; durationSeconds: number | null }> {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${origin.lng},${origin.lat};${destination.lng},${destination.lat}` +
    `?overview=full&geometries=geojson`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    if (!res.ok) return { waypoints: [], durationSeconds: null };
    const json = (await res.json()) as {
      routes?: Array<{
        duration?: number;
        geometry?: { coordinates?: Array<[number, number]> };
      }>;
    };
    const route = json.routes?.[0];
    const coords = route?.geometry?.coordinates ?? [];
    const duration = typeof route?.duration === "number" && Number.isFinite(route.duration)
      ? route.duration
      : null;
    return { waypoints: coords.map(([lng, lat]) => ({ lat, lng })), durationSeconds: duration };
  } catch {
    return { waypoints: [], durationSeconds: null };
  }
}
