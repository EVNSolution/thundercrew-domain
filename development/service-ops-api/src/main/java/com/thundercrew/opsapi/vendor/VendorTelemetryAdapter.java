package com.thundercrew.opsapi.vendor;

import com.thundercrew.opsapi.telemetry.dto.TelemetryIngestRequest;
import com.thundercrew.opsapi.telemetry.service.TelemetryIngestionService;
import com.thundercrew.opsapi.vendor.VendorTelemetryFeed.VendorTelemetryFetchResult;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicInteger;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Pipes vendor-fetched events into our existing
 * {@link TelemetryIngestionService}. Sits between the polling scheduler and
 * the ingest service so the scheduler stays trivial and any retry / dead-
 * letter logic can be added here later without touching the feed contract.
 */
@Component
public class VendorTelemetryAdapter {

    private static final Logger LOGGER = LoggerFactory.getLogger(VendorTelemetryAdapter.class);

    private final VendorTelemetryFeed feed;
    private final TelemetryIngestionService ingestionService;

    public VendorTelemetryAdapter(VendorTelemetryFeed feed, TelemetryIngestionService ingestionService) {
        this.feed = feed;
        this.ingestionService = ingestionService;
    }

    /**
     * Pull one batch from the vendor feed and forward each event to the
     * ingest service. Returns the cursor to persist for the next pull and a
     * count of how many events succeeded vs. failed in this batch.
     */
    public VendorTelemetryPullSummary pullOnce(Instant since) {
        VendorTelemetryFetchResult result = feed.pullRecent(since);
        if (result.events().isEmpty()) {
            LOGGER.debug("Vendor telemetry pull: 0 events (cursor={})", result.nextCursor());
            return new VendorTelemetryPullSummary(0, 0, result.nextCursor());
        }

        AtomicInteger ok = new AtomicInteger();
        AtomicInteger failed = new AtomicInteger();
        for (TelemetryIngestRequest event : result.events()) {
            try {
                ingestionService.ingest(event);
                ok.incrementAndGet();
            } catch (RuntimeException exception) {
                failed.incrementAndGet();
                // Single bad vendor event must not stop the rest of the
                // batch. The vendor feed implementation is the right place
                // to handle dead-letter buffering for retried events; we
                // just log and continue here.
                LOGGER.warn(
                        "Vendor telemetry ingest failed for deviceUid={} vendorEventId={}: {}",
                        event.deviceUid(),
                        event.vendorEventId(),
                        exception.toString());
            }
        }
        LOGGER.info(
                "Vendor telemetry pull: ok={} failed={} cursor={}",
                ok.get(),
                failed.get(),
                result.nextCursor());
        return new VendorTelemetryPullSummary(ok.get(), failed.get(), result.nextCursor());
    }

    public record VendorTelemetryPullSummary(int succeeded, int failed, Instant nextCursor) {
    }
}
