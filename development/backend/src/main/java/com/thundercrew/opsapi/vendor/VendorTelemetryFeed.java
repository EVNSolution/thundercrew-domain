package com.thundercrew.opsapi.vendor;

import com.thundercrew.opsapi.telemetry.dto.TelemetryIngestRequest;
import java.time.Instant;
import java.util.List;

/**
 * Pulls a recent batch of telemetry events from a third-party vendor and
 * normalises each event into our internal {@link TelemetryIngestRequest}
 * shape. A vendor-specific implementation lives outside this package; the
 * default in-tree implementation is {@link StubVendorTelemetryFeed} and
 * returns an empty result so the polling skeleton can ship before the real
 * vendor docs arrive.
 *
 * <p>The feed is the only piece that is allowed to know about vendor URLs,
 * authentication, payload field names, and rate-limit handling — once a
 * vendor implementation is wired in, everything downstream
 * ({@link VendorTelemetryAdapter}, {@link VendorTelemetryPollingScheduler})
 * can stay unchanged.</p>
 */
public interface VendorTelemetryFeed {

    /**
     * Pull telemetry events that the vendor has emitted since {@code since}.
     *
     * @param since the cursor returned by the previous successful call, or
     *              {@code null} on the very first poll.
     * @return events normalised to {@link TelemetryIngestRequest} plus a
     *         next-cursor that the scheduler must persist before the next
     *         call.
     */
    VendorTelemetryFetchResult pullRecent(Instant since);

    /**
     * Result of a single {@link #pullRecent(Instant)} call.
     *
     * @param events     normalised events ready for {@code TelemetryIngestionService.ingest}.
     * @param nextCursor opaque cursor (typically the latest event's
     *                   {@code receivedAt}); the scheduler hands it back on
     *                   the next call. {@code null} means "no progress made
     *                   — replay from the same cursor next time".
     */
    record VendorTelemetryFetchResult(List<TelemetryIngestRequest> events, Instant nextCursor) {

        public static VendorTelemetryFetchResult empty(Instant nextCursor) {
            return new VendorTelemetryFetchResult(List.of(), nextCursor);
        }
    }
}
