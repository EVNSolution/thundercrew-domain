import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const BACKEND_BASE = process.env.SERVICE_OPS_API_BASE_URL ?? "";
const TOKEN_COOKIE = "thundercrew_ops_access_token";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params;
  if (!["vehicles", "riders", "matchings"].includes(type)) {
    return NextResponse.json({ error: "invalid type" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const backendUrl = `${BACKEND_BASE}/api/v1/test-matching/export/${type}`;
  const upstream = await fetch(backendUrl, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!upstream.ok) {
    return NextResponse.json({ error: "backend error" }, { status: upstream.status });
  }

  const blob = await upstream.blob();
  const filename = `test_${type}.xlsx`;
  return new NextResponse(blob, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
