import { NextResponse } from "next/server";

import { loadBatteryStationDetail } from "@/lib/services/battery-station-detail-data";

/**
 * Per-station detail endpoint hit by the marker-click panel. Keeps the
 * service-ops session cookie server-side, mirroring the dashboard map-state
 * and bike-snapshot routes.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ stationId: string }> }
) {
  const { stationId } = await context.params;
  const result = await loadBatteryStationDetail(stationId);
  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
