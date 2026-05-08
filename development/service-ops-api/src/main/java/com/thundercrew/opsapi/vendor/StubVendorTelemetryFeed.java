package com.thundercrew.opsapi.vendor;

import java.time.Instant;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.stereotype.Component;

/**
 * Default {@link VendorTelemetryFeed}. Always returns an empty result so the
 * polling skeleton can ship before real vendor documentation is available;
 * runtime sees the scheduler call this stub, log "0 events", and move on.
 *
 * <p>Activated when the application uses the default
 * {@code thundercrew.vendor-telemetry.feed-implementation=stub} property
 * and no other {@link VendorTelemetryFeed} bean is registered. A real
 * vendor implementation will register itself with a different qualifying
 * property so this stub is bypassed in production.</p>
 */
@Component
@ConditionalOnMissingBean(VendorTelemetryFeed.class)
@ConditionalOnProperty(
        prefix = "thundercrew.vendor-telemetry",
        name = "feed-implementation",
        havingValue = "stub",
        matchIfMissing = true)
public class StubVendorTelemetryFeed implements VendorTelemetryFeed {

    private final AtomicLong invocationCount = new AtomicLong();

    @Override
    public VendorTelemetryFetchResult pullRecent(Instant since) {
        invocationCount.incrementAndGet();
        // Stub does not advance the cursor — operators should see "no
        // progress yet" until the real feed is wired in. Returning {@code
        // since} unchanged keeps the scheduler's cursor handling code
        // exercised in tests.
        return VendorTelemetryFetchResult.empty(since);
    }

    /** Inspect how many times the stub has been called — useful in tests. */
    public long invocationCount() {
        return invocationCount.get();
    }

    /**
     * Marker so the application context can confirm the stub is actually
     * picked up by Spring instead of silently falling back to a real
     * implementation when both are present.
     */
    @Configuration
    static class StubVendorTelemetryFeedConfiguration {
    }
}
