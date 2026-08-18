import { NextRequest, NextResponse } from "next/server";

import { getServiceOpsAccessToken } from "@/lib/services/service-ops-session";

/**
 * 도착 예정 시간(ETA) 프록시 — 차량 현 위치 → 다음 목적지.
 *
 * 1차: OSRM 공개 데모 서버(실도로 경로 소요시간). 지도 타일(OpenFreeMap)과
 * 같은 무SLA 무료 서비스 결이고, 포커스된 차량 1대당 폴링만 하는 가벼운
 * 사용량이다. 운영 의존도가 커지면 자체 OSRM 호스팅으로 교체한다.
 * 폴백: OSRM 무응답 시 직선거리 × 도로 보정계수 ÷ 도심 평균 속도 추정 —
 * ETA 표기가 끊기지 않게 한다.
 *
 * 좌표를 소수 4자리(≈11m)로 반올림한 키로 짧게 캐시해 폴링 중 중복 호출을
 * 줄인다. (프로세스 로컬 — 서버리스 다중 인스턴스면 인스턴스별 캐시.)
 */
const OSRM_BASE = "https://router.project-osrm.org";
const CACHE_TTL_MS = 30_000;
const OSRM_TIMEOUT_MS = 4_000;
/** 직선거리 → 도로거리 보정계수 (도심 격자 경험값). */
const ROAD_FACTOR = 1.35;
/** 배송 이륜차 도심 평균 주행 속도 (km/h). */
const AVG_SPEED_KMH = 22;

type EtaResult = { durationSeconds: number; source: "osrm" | "estimate" };
const cache = new Map<string, { at: number; value: EtaResult }>();

export async function GET(request: NextRequest) {
  // 다른 overview 라우트와 같은 세션 가드 — 무인증 공개 프록시가 되지 않게.
  const accessToken = await getServiceOpsAccessToken();
  if (!accessToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const read = (name: string): number | null => {
    const raw = params.get(name);
    if (raw === null || raw.trim() === "") return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  };
  const fromLat = read("fromLat");
  const fromLng = read("fromLng");
  const toLat = read("toLat");
  const toLng = read("toLng");
  if (
    fromLat === null || fromLng === null || toLat === null || toLng === null ||
    Math.abs(fromLat) > 90 || Math.abs(toLat) > 90 ||
    Math.abs(fromLng) > 180 || Math.abs(toLng) > 180
  ) {
    return NextResponse.json({ error: "invalid coordinates" }, { status: 400 });
  }

  const key = [fromLat, fromLng, toLat, toLng].map((v) => v.toFixed(4)).join(",");
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json(hit.value);
  }

  let value: EtaResult | null = null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), OSRM_TIMEOUT_MS);
    const response = await fetch(
      `${OSRM_BASE}/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=false&alternatives=false&steps=false`,
      { signal: controller.signal, cache: "no-store" }
    );
    clearTimeout(timer);
    if (response.ok) {
      const body = (await response.json()) as {
        code?: string;
        routes?: Array<{ duration?: number }>;
      };
      const duration = body.code === "Ok" ? body.routes?.[0]?.duration : undefined;
      if (typeof duration === "number" && Number.isFinite(duration)) {
        value = { durationSeconds: Math.round(duration), source: "osrm" };
      }
    }
  } catch {
    // 폴백으로 진행 — 공개 데모 서버라 간헐 실패는 정상 경로다.
  }

  if (!value) {
    const distanceKm = haversineKm(fromLat, fromLng, toLat, toLng) * ROAD_FACTOR;
    value = {
      durationSeconds: Math.round((distanceKm / AVG_SPEED_KMH) * 3600),
      source: "estimate"
    };
  }

  cache.set(key, { at: Date.now(), value });
  // 캐시 무한 성장 방지 — 오래된 항목 정리.
  if (cache.size > 500) {
    const cutoff = Date.now() - CACHE_TTL_MS;
    for (const [k, v] of cache) {
      if (v.at < cutoff) cache.delete(k);
    }
  }
  return NextResponse.json(value);
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
