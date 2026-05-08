import { NextResponse } from "next/server";

import { loadDashboardMapState } from "@/lib/services/dashboard-map-state-data";

/**
 * Polling endpoint for the client `DashboardCanvas`. Server components hand
 * the initial fetch through props; the client refresher hits this route on a
 * fixed cadence so the polling cost stays inside the Next.js process and the
 * NCP-targeted client never sees the service-ops cookie.
 */
export async function GET() {
  const result = await loadDashboardMapState();
  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
