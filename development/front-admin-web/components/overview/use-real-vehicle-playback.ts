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
