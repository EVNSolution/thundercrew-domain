import { NextResponse } from "next/server";

import { serviceOpsApiBaseUrl } from "@/lib/services/service-ops-api";
import { getServiceOpsAccessToken } from "@/lib/services/service-ops-session";

/**
 * Proxy route: GET /api/dispatch/completion-photo/[id]
 *
 * Fetches the completion photo for a dispatch order from the backend and
 * streams it back to the browser. Auth is forwarded via Bearer token from
 * the server-side session (same mechanism as other authenticated routes).
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const baseUrl = serviceOpsApiBaseUrl();
  if (!baseUrl) {
    return new NextResponse("서비스 설정 오류", { status: 500 });
  }

  const accessToken = await getServiceOpsAccessToken();
  if (!accessToken) {
    return new NextResponse("인증이 필요합니다.", { status: 401 });
  }

  const backendUrl = `${baseUrl}/api/v1/dispatch-orders/${encodeURIComponent(id)}/completion-photo`;

  const headers = new Headers();
  headers.set("authorization", `Bearer ${accessToken}`);

  let backendResponse: Response;
  try {
    backendResponse = await fetch(backendUrl, {
      method: "GET",
      cache: "no-store",
      headers
    });
  } catch {
    return new NextResponse("백엔드 연결 오류", { status: 502 });
  }

  if (backendResponse.status === 404) {
    return new NextResponse("사진을 찾을 수 없습니다.", { status: 404 });
  }

  if (!backendResponse.ok) {
    return new NextResponse("사진 조회에 실패했습니다.", { status: backendResponse.status });
  }

  const contentType = backendResponse.headers.get("content-type") ?? "application/octet-stream";
  const body = await backendResponse.arrayBuffer();

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=300"
    }
  });
}
