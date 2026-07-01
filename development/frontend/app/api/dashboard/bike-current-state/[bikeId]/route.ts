import { NextResponse } from "next/server";

import { loadBikeCurrentState } from "@/lib/services/bike-current-state-data";

/**
 * Per-bike telemetry endpoint hit by the marker-click detail panel. Keeps
 * the service-ops cookie server-side, mirroring the dashboard map-state
 * route. Path param matches the backend's URL shape so operators can grep
 * `bikeId` consistently across server and client logs.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ bikeId: string }> }
) {
  const { bikeId } = await context.params;
  const result = await loadBikeCurrentState(bikeId);
  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
