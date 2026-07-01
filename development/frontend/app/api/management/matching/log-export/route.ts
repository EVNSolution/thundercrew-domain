import { NextResponse } from "next/server";

import { serviceOpsApiBaseUrl } from "@/lib/services/service-ops-api";
import { getServiceOpsAccessToken } from "@/lib/services/service-ops-session";

/**
 * 매칭 로그 다운로드 — 종료된 계약까지 포함한 전체 이력(상태·종료시각 컬럼 포함).
 * 활성만 받는 `/export`(재업로드용 템플릿)와 별개의 읽기 전용 로그다.
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

  const response = await fetch(`${baseUrl}/api/v1/contracts/log-export`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    return new NextResponse("Log export failed", { status: response.status });
  }

  const data = await response.arrayBuffer();
  return new NextResponse(data, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="matching-log.xlsx"',
    },
  });
}
