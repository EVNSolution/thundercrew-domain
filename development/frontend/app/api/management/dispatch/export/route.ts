import { NextResponse } from "next/server";

import { serviceOpsApiBaseUrl } from "@/lib/services/service-ops-api";
import { getServiceOpsAccessToken } from "@/lib/services/service-ops-session";

/**
 * 배차(dispatch) 주문 xlsx 내려받기 프록시. backend export 는 Bearer 토큰을
 * 요구하는데 브라우저 anchor 는 토큰을 못 실으므로, 다른 management export
 * (vehicles/riders/matching) 와 동일하게 서버 라우트가 세션 토큰을 붙여 프록시한다.
 */
export async function GET() {
  const accessToken = await getServiceOpsAccessToken();
  if (!accessToken) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const baseUrl = serviceOpsApiBaseUrl();
  if (!baseUrl) {
    return new NextResponse("Service OPS API not configured", { status: 503 });
  }

  const response = await fetch(`${baseUrl}/api/v1/dispatch-orders/export`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    return new NextResponse("Export failed", { status: response.status });
  }

  const data = await response.arrayBuffer();
  return new NextResponse(data, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="dispatch-orders.xlsx"',
    },
  });
}
