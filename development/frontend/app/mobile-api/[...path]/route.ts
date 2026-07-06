export const dynamic = "force-dynamic";

/**
 * Mobile backend proxy.
 *
 * The native rider app authenticates with JWT bearer tokens, but it has no
 * public network path to the Spring service-ops-api: `thcr.cleversystem.ai`
 * is the Next.js front, whose middleware 307-redirects every session-less
 * `/api/*` request to `/login`, and the backend (:8080) is not exposed by
 * nginx. So the app calls `/mobile-api/...` here; this handler is bypassed in
 * middleware.ts (like `/api/otoplug/`) and forwards the request straight to
 * the backend.
 *
 * The backend enforces role-based auth (SecurityConfig: rider-auth login /
 * refresh are permitAll, `/api/v1/rider/**` requires ROLE_RIDER), so this
 * proxy is a dumb pass-through — it forwards the Authorization header and lets
 * the backend decide. An allow-list keeps only the rider surface reachable so
 * admin endpoints are never proxied.
 *
 * App base URL is `https://thcr.cleversystem.ai/mobile-api`, and the client
 * appends `/api/v1/...`, so `path` here is e.g. `["api","v1","rider-auth",
 * "login"]` → forwarded to `${SERVICE_OPS_API_BASE_URL}/api/v1/rider-auth/login`.
 */

// Only the rider-facing surface is proxied. Everything else → 404.
const ALLOWED_PREFIXES = ["api/v1/rider-auth/", "api/v1/rider/"];

function resolveTarget(pathSegments: string[]): string | null {
  const joined = pathSegments.join("/");
  const allowed = ALLOWED_PREFIXES.some((prefix) => joined.startsWith(prefix));
  if (!allowed) {
    return null;
  }
  const base = (process.env.SERVICE_OPS_API_BASE_URL ?? "").replace(/\/$/, "");
  if (!base) {
    return null;
  }
  return `${base}/${joined}`;
}

async function handler(
  request: Request,
  context: { params: Promise<{ path: string[] }> }
): Promise<Response> {
  const { path } = await context.params;
  const target = resolveTarget(path);
  if (target === null) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  // Preserve the query string (e.g. offered-calls filters).
  const search = new URL(request.url).search;
  const targetUrl = `${target}${search}`;

  // Forward only Authorization + Content-Type; never the front's session cookie.
  const headers: Record<string, string> = {};
  const authorization = request.headers.get("authorization");
  if (authorization) {
    headers["Authorization"] = authorization;
  }
  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers["Content-Type"] = contentType;
  }

  const method = request.method;
  const hasBody = method !== "GET" && method !== "HEAD";
  const body = hasBody ? await request.arrayBuffer() : undefined;

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, {
      method,
      headers,
      body,
      cache: "no-store",
      redirect: "manual",
    });
  } catch (error) {
    console.error("[mobile-api] upstream fetch failed:", error);
    return Response.json({ error: "upstream_unavailable" }, { status: 502 });
  }

  // Pass the backend's status + body straight back to the app.
  const responseBody = await upstream.arrayBuffer();
  const responseHeaders = new Headers();
  const upstreamContentType = upstream.headers.get("content-type");
  if (upstreamContentType) {
    responseHeaders.set("Content-Type", upstreamContentType);
  }
  return new Response(responseBody, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const PUT = handler;
export const DELETE = handler;
