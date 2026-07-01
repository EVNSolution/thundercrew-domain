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
