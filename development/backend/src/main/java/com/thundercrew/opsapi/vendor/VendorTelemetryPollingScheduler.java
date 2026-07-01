package com.thundercrew.opsapi.vendor;

import com.thundercrew.opsapi.vendor.VendorTelemetryAdapter.VendorTelemetryPullSummary;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicReference;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Disabled-by-default polling scheduler that drives
 * {@link VendorTelemetryAdapter}. Activated by setting
 * {@code thundercrew.vendor-telemetry.enabled=true} in the runtime
 * environment; tests and dev runs leave it off so the adapter and its
 * scheduler bean tree do not interfere with the normal admin/dashboard
 * workflows.
 *
 * <p>The cursor is held in-memory only. A real vendor implementation will
 * want to persist it (e.g. via {@code device_api_sync_runs}) so a restart
 * does not replay the same window — that is intentionally out of scope for
 * the F-1 skeleton.</p>
 */
@Component
@ConditionalOnProperty(
        prefix = "thundercrew.vendor-telemetry",
        name = "enabled",
        havingValue = "true")
public class VendorTelemetryPollingScheduler {

    private static final Logger LOGGER = LoggerFactory.getLogger(VendorTelemetryPollingScheduler.class);

    private final VendorTelemetryAdapter adapter;
    private final AtomicReference<Instant> cursor = new AtomicReference<>();

    public VendorTelemetryPollingScheduler(VendorTelemetryAdapter adapter) {
        this.adapter = adapter;
    }

    @Scheduled(
            fixedDelayString = "${thundercrew.vendor-telemetry.poll-interval-ms:60000}",
            initialDelayString = "${thundercrew.vendor-telemetry.initial-delay-ms:30000}"
    )
    public void poll() {
        Instant since = cursor.get();
        try {
            VendorTelemetryPullSummary summary = adapter.pullOnce(since);
            if (summary.nextCursor() != null) {
                cursor.set(summary.nextCursor());
            }
        } catch (RuntimeException exception) {
            LOGGER.error("Vendor telemetry polling cycle failed: {}", exception.toString());
        }
    }

    /** Visible for testing. */
    Instant currentCursor() {
        return cursor.get();
    }

    /**
     * Required to enable {@code @Scheduled} only when the polling bean is
     * activated. Keeping the {@link EnableScheduling} annotation on a
     * conditional inner config means the rest of the codebase does not
     * accidentally start a Spring scheduler thread pool when vendor polling
     * is off.
     */
    @Configuration
    @ConditionalOnProperty(
            prefix = "thundercrew.vendor-telemetry",
            name = "enabled",
            havingValue = "true")
    @EnableScheduling
    static class VendorTelemetrySchedulingConfiguration {

        @Bean
        VendorTelemetrySchedulingMarker vendorTelemetrySchedulingMarker() {
            return new VendorTelemetrySchedulingMarker();
        }
    }

    /** Marker bean so tests can assert that scheduling was activated. */
    public static final class VendorTelemetrySchedulingMarker {
    }
}
