import { NextResponse } from "next/server";

import { serviceOpsApiBaseUrl } from "@/lib/services/service-ops-api";
import { getServiceOpsAccessToken } from "@/lib/services/service-ops-session";

export async function GET() {
  const accessToken = await getServiceOpsAccessToken();
  if (!accessToken) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const baseUrl = serviceOpsApiBaseUrl();
  if (!baseUrl) {
    return new NextResponse("Service OPS API not configured", { status: 503 });
  }

  const response = await fetch(`${baseUrl}/api/v1/contracts/export`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    return new NextResponse("Export failed", { status: response.status });
  }

  const data = await response.arrayBuffer();
  return new NextResponse(data, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="matching.xlsx"',
    },
  });
}
