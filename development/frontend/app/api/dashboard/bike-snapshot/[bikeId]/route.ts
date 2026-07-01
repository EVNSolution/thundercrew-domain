import { NextResponse } from "next/server";

import { loadBikeSnapshot } from "@/lib/services/dashboard-bike-snapshot-data";

/**
 * Per-bike join snapshot endpoint hit by the marker-click detail panel.
 * Like the other dashboard routes, it keeps the service-ops cookie
 * server-side and forwards the loader result with a no-store cache header.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ bikeId: string }> }
) {
  const { bikeId } = await context.params;
  const result = await loadBikeSnapshot(bikeId);
  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
