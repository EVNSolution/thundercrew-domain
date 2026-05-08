import { NextResponse } from "next/server";

import {
  type BatteryStationCountUpdateInput,
  type ServiceOpsApiError,
  serviceOpsApiConfigured
} from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";

export type StationBatteryCountUpdateResult = {
  ok: boolean;
  station: import("@/lib/services/service-ops-api").FrontendBatteryStation | null;
  notice?: string;
};

/**
 * Inline battery-count edit endpoint hit by the station detail panel.
 * Keeps the service-ops session cookie server-side and returns the freshly
 * updated station so the panel can reflect new counts without waiting for
 * the next dashboard polling cycle.
 *
 * Validation rules ({@code availableBatteryCount <= currentBatteryCount <=
 * maxBatteryCapacity}, all non-negative) live on the backend; this route
 * surfaces backend errors as a friendly notice.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ stationId: string }> }
) {
  const { stationId } = await context.params;

  if (!serviceOpsApiConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        station: null,
        notice: "SERVICE_OPS_API_BASE_URL이 없어 카운트를 갱신할 수 없습니다."
      },
      {
        headers: { "Cache-Control": "no-store" }
      }
    );
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    return NextResponse.json(
      {
        ok: false,
        station: null,
        notice: "관리자 세션이 없어 카운트를 갱신할 수 없습니다. 다시 로그인해 주세요."
      },
      {
        headers: { "Cache-Control": "no-store" }
      }
    );
  }

  let body: Partial<BatteryStationCountUpdateInput>;
  try {
    body = (await request.json()) as Partial<BatteryStationCountUpdateInput>;
  } catch {
    return NextResponse.json(
      { ok: false, station: null, notice: "요청 본문을 해석할 수 없습니다." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const payload = sanitizePayload(body);
  if (!payload.ok) {
    return NextResponse.json(
      { ok: false, station: null, notice: payload.notice },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const station = await client.updateBatteryStationCounts(stationId, payload.value);
    return NextResponse.json(
      { ok: true, station },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        station: null,
        notice: `카운트 갱신 실패.${formatServiceOpsError(error)}`
      },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}

function sanitizePayload(
  body: Partial<BatteryStationCountUpdateInput>
):
  | { ok: true; value: BatteryStationCountUpdateInput }
  | { ok: false; notice: string } {
  const max = toNonNegativeInt(body.maxBatteryCapacity, "최대 보관 수량");
  if (!max.ok) return { ok: false, notice: max.notice };
  const current = toNonNegativeInt(body.currentBatteryCount, "현재 보관 수량");
  if (!current.ok) return { ok: false, notice: current.notice };
  const available = toNonNegativeInt(body.availableBatteryCount, "가용 수량");
  if (!available.ok) return { ok: false, notice: available.notice };

  if (current.value > max.value) {
    return { ok: false, notice: "현재 보관 수량은 최대 보관 수량을 넘을 수 없습니다." };
  }
  if (available.value > current.value) {
    return { ok: false, notice: "가용 수량은 현재 보관 수량을 넘을 수 없습니다." };
  }

  return {
    ok: true,
    value: {
      maxBatteryCapacity: max.value,
      currentBatteryCount: current.value,
      availableBatteryCount: available.value,
      reason: body.reason ? String(body.reason).trim() || null : null,
      memo: body.memo ? String(body.memo).trim() || null : null
    }
  };
}

function toNonNegativeInt(
  raw: unknown,
  label: string
): { ok: true; value: number } | { ok: false; notice: string } {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
    return { ok: false, notice: `${label}은 0 이상의 정수여야 합니다.` };
  }
  return { ok: true, value: n };
}

function formatServiceOpsError(error: unknown): string {
  const apiError = error as Partial<ServiceOpsApiError> | undefined;
  if (apiError?.code) {
    return ` (${apiError.code})`;
  }
  if (error instanceof Error) {
    return ` (${error.message})`;
  }
  return "";
}
