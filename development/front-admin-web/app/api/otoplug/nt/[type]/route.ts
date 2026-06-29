export const dynamic = "force-dynamic";

/**
 * OTOPLUG NT (Notification) webhook receiver.
 *
 * OTOPLUG calls this endpoint when a registered NT event fires. We parse the
 * payload, skip records with bad GPS, convert each record to the internal
 * telemetry ingest format, and POST to the Java service-ops-api.
 *
 * Supported `type` path segments:
 *   - driving        → single drivingData record (~60 s periodic)
 *   - driving-detail → array of tripData records (10 s batches)
 *
 * All other types are acknowledged (result: 0) and silently ignored so OTOPLUG
 * does not keep retrying unknown notification channels.
 *
 * OTOPLUG retry semantics: result != 0 OR status >= 400 → retry. We only
 * return non-zero / non-200 for auth failures and upstream 5xx errors.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IngestBody {
  deviceUid: string;
  vendorEventId: string;
  receivedAt: string;
  latitude: number;
  longitude: number;
  speedKph: number;
  telemetrySource: "WEBHOOK";
  rawPayload: unknown;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a KST timestamp string "yyyyMMddHHmmss" to a UTC ISO-8601 string.
 * Returns null when the string is missing or not exactly 14 digits.
 */
function kstToIso(s?: string): string | null {
  if (!s || !/^\d{14}$/.test(s)) return null;
  const y = +s.slice(0, 4),
    mo = +s.slice(4, 6),
    d = +s.slice(6, 8);
  const h = +s.slice(8, 10),
    mi = +s.slice(10, 12),
    se = +s.slice(12, 14);
  // KST = UTC+9 → subtract 9 h to get UTC epoch
  const utcMs = Date.UTC(y, mo - 1, d, h, mi, se) - 9 * 3600 * 1000;
  return new Date(utcMs).toISOString();
}

/**
 * Build an ingest body for one telemetry record.
 * Returns null when the record's GPS coordinates are absent or zero (bad fix).
 */
function toIngest(
  imei: string,
  rec: Record<string, unknown>,
  timeStr: string | undefined
): IngestBody | null {
  const lat = Number(rec.latitude);
  const lng = Number(rec.longitude);

  // Skip records with missing or zero GPS — OTOPLUG sends "0" for no-fix.
  if (Number.isNaN(lat) || Number.isNaN(lng) || (lat === 0 && lng === 0)) {
    return null;
  }

  const speedRaw = Number(rec.speed);
  const speedKph =
    Number.isFinite(speedRaw) && speedRaw >= 0 ? speedRaw : 0;

  const receivedAt = kstToIso(timeStr) ?? new Date().toISOString();

  return {
    deviceUid: imei,
    vendorEventId: `${imei}:${timeStr ?? Date.now()}`,
    receivedAt,
    latitude: lat,
    longitude: lng,
    speedKph,
    telemetrySource: "WEBHOOK",
    rawPayload: rec,
  };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(
  req: Request,
  context: { params: Promise<{ type: string }> }
) {
  try {
    const { type } = await context.params;

    // ------------------------------------------------------------------
    // 1. Validate type — only driving and driving-detail are handled.
    // ------------------------------------------------------------------
    if (type !== "driving" && type !== "driving-detail") {
      return Response.json({ result: 0 }, { status: 200 });
    }

    // ------------------------------------------------------------------
    // 2. Channel token check.
    //
    // Both NT observers (driving · drivingDetail) are registered by the
    // backend with the same shared channel token, so we validate against a
    // single env var rather than per-type ones.
    // ------------------------------------------------------------------
    const expectedToken = process.env.OTOPLUG_CHANNEL_TOKEN;
    const receivedToken = req.headers.get("OTOPLUG-Channel-Token");

    if (expectedToken) {
      if (receivedToken !== expectedToken) {
        return Response.json({ result: 1 }, { status: 401 });
      }
    } else {
      console.warn(
        "[otoplug] channel token not configured, skipping validation"
      );
    }

    // ------------------------------------------------------------------
    // 3. Parse body + extract IMEI.
    // ------------------------------------------------------------------
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ result: 1 }, { status: 400 });
    }

    // Safe nested-access helpers for an untyped JSON blob.
    function asObj(v: unknown): Record<string, unknown> | undefined {
      return v !== null && typeof v === "object" && !Array.isArray(v)
        ? (v as Record<string, unknown>)
        : undefined;
    }
    function asStr(v: unknown): string | undefined {
      return typeof v === "string" ? v : undefined;
    }

    const data = asObj(asObj(body)?.data);
    const imei = asStr(data?.imei);
    if (!imei) {
      console.warn(`[otoplug] received type=${type} but no data.imei in payload`);
      return Response.json({ result: 1 }, { status: 400 });
    }
    console.log(`[otoplug] received type=${type} imei=${imei}`);

    // ------------------------------------------------------------------
    // 4. Build records list depending on type.
    // ------------------------------------------------------------------
    const records: Array<{ rec: Record<string, unknown>; timeStr?: string }> =
      [];

    if (type === "driving") {
      const drivingData = asObj(data?.drivingData);
      if (drivingData) {
        records.push({
          rec: drivingData,
          timeStr: asStr(drivingData.msgdate),
        });
      }
    } else {
      // driving-detail
      const tripDataRaw = data?.tripData;
      if (Array.isArray(tripDataRaw)) {
        for (const item of tripDataRaw) {
          const rec = asObj(item);
          if (rec) {
            records.push({
              rec,
              timeStr: asStr(rec.timeOfOccurrence),
            });
          }
        }
      }
    }

    // ------------------------------------------------------------------
    // 5 + 6. Convert and ingest each record.
    // ------------------------------------------------------------------
    const base = (process.env.SERVICE_OPS_API_BASE_URL ?? "").replace(
      /\/$/,
      ""
    );
    const ingestUrl = `${base}/api/v1/telemetry/device-events`;

    let hasServerError = false;
    let ingested = 0;
    let skipped = 0;

    for (const { rec, timeStr } of records) {
      const ingestBody = toIngest(imei, rec, timeStr);

      if (!ingestBody) {
        // Bad/empty GPS — skip silently.
        skipped++;
        continue;
      }

      let res: Response;
      try {
        res = await fetch(ingestUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(ingestBody),
          cache: "no-store",
        });
      } catch (fetchErr) {
        console.error("[otoplug] fetch to ingest endpoint failed:", fetchErr);
        hasServerError = true;
        continue;
      }

      if (res.status >= 500) {
        console.error(
          `[otoplug] ingest endpoint returned ${res.status} for imei=${imei} vendorEventId=${ingestBody.vendorEventId}`
        );
        hasServerError = true;
      } else if (res.status >= 400) {
        // 4xx from ingest (e.g. validation error) — log but don't retry-storm.
        console.warn(
          `[otoplug] ingest rejected record (${res.status}) for imei=${imei} vendorEventId=${ingestBody.vendorEventId}`
        );
      } else {
        ingested++;
      }
    }

    console.log(
      `[otoplug] type=${type} imei=${imei} records=${records.length} ingested=${ingested} skipped=${skipped}`
    );

    // ------------------------------------------------------------------
    // 7. Return result.
    // ------------------------------------------------------------------
    if (hasServerError) {
      return Response.json({ result: 1 }, { status: 500 });
    }

    return Response.json({ result: 0 }, { status: 200 });
  } catch (err) {
    console.error("[otoplug] unexpected error in NT webhook handler:", err);
    return Response.json({ result: 1 }, { status: 500 });
  }
}
