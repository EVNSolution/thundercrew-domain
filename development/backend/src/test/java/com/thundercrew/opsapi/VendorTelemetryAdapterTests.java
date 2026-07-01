package com.thundercrew.opsapi;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.thundercrew.opsapi.telemetry.domain.TelemetrySource;
import com.thundercrew.opsapi.telemetry.dto.TelemetryIngestRequest;
import com.thundercrew.opsapi.telemetry.dto.TelemetryIngestResponse;
import com.thundercrew.opsapi.telemetry.service.TelemetryIngestionService;
import com.thundercrew.opsapi.vendor.StubVendorTelemetryFeed;
import com.thundercrew.opsapi.vendor.VendorTelemetryAdapter;
import com.thundercrew.opsapi.vendor.VendorTelemetryAdapter.VendorTelemetryPullSummary;
import com.thundercrew.opsapi.vendor.VendorTelemetryFeed;
import com.thundercrew.opsapi.vendor.VendorTelemetryFeed.VendorTelemetryFetchResult;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class VendorTelemetryAdapterTests {

    @Test
    void stubFeedReturnsEmptyAndAdapterDoesNotInvokeIngest() {
        StubVendorTelemetryFeed feed = new StubVendorTelemetryFeed();
        TelemetryIngestionService ingestionService = mock(TelemetryIngestionService.class);
        VendorTelemetryAdapter adapter = new VendorTelemetryAdapter(feed, ingestionService);

        VendorTelemetryPullSummary summary = adapter.pullOnce(null);

        assertThat(summary.succeeded()).isZero();
        assertThat(summary.failed()).isZero();
        assertThat(summary.nextCursor()).isNull();
        assertThat(feed.invocationCount()).isEqualTo(1);
        verify(ingestionService, times(0)).ingest(any(TelemetryIngestRequest.class));
    }

    @Test
    void adapterForwardsAllVendorEventsToIngestionService() {
        Instant now = Instant.parse("2030-01-01T00:00:00Z");
        TelemetryIngestRequest first = sampleEvent("VENDOR-A1", now);
        TelemetryIngestRequest second = sampleEvent("VENDOR-A2", now.plusSeconds(1));
        VendorTelemetryFeed feed = since -> new VendorTelemetryFetchResult(List.of(first, second), now.plusSeconds(1));
        TelemetryIngestionService ingestionService = mock(TelemetryIngestionService.class);
        when(ingestionService.ingest(any(TelemetryIngestRequest.class)))
                .thenReturn(stubIngestResponse());

        VendorTelemetryPullSummary summary = new VendorTelemetryAdapter(feed, ingestionService).pullOnce(null);

        assertThat(summary.succeeded()).isEqualTo(2);
        assertThat(summary.failed()).isZero();
        assertThat(summary.nextCursor()).isEqualTo(now.plusSeconds(1));
        verify(ingestionService).ingest(first);
        verify(ingestionService).ingest(second);
    }

    @Test
    void adapterContinuesBatchWhenSingleEventThrows() {
        Instant now = Instant.parse("2030-02-01T00:00:00Z");
        TelemetryIngestRequest good = sampleEvent("VENDOR-OK", now);
        TelemetryIngestRequest bad = sampleEvent("VENDOR-BAD", now.plusSeconds(1));
        VendorTelemetryFeed feed = since -> new VendorTelemetryFetchResult(List.of(good, bad), now.plusSeconds(1));
        TelemetryIngestionService ingestionService = mock(TelemetryIngestionService.class);
        when(ingestionService.ingest(good)).thenReturn(stubIngestResponse());
        doThrow(new RuntimeException("simulated ingest failure"))
                .when(ingestionService).ingest(bad);

        VendorTelemetryPullSummary summary = new VendorTelemetryAdapter(feed, ingestionService).pullOnce(null);

        assertThat(summary.succeeded()).isEqualTo(1);
        assertThat(summary.failed()).isEqualTo(1);
        assertThat(summary.nextCursor()).isEqualTo(now.plusSeconds(1));
        verify(ingestionService).ingest(good);
        verify(ingestionService).ingest(bad);
    }

    @Test
    void stubFeedKeepsCursorUnchangedAcrossInvocations() {
        StubVendorTelemetryFeed feed = new StubVendorTelemetryFeed();
        Instant cursor = Instant.parse("2030-03-01T00:00:00Z");
        VendorTelemetryFetchResult first = feed.pullRecent(cursor);
        VendorTelemetryFetchResult second = feed.pullRecent(first.nextCursor());

        assertThat(first.events()).isEmpty();
        assertThat(second.events()).isEmpty();
        assertThat(first.nextCursor()).isEqualTo(cursor);
        assertThat(second.nextCursor()).isEqualTo(cursor);
        assertThat(feed.invocationCount()).isEqualTo(2);
    }

    private static TelemetryIngestRequest sampleEvent(String deviceUid, Instant receivedAt) {
        return new TelemetryIngestRequest(
                deviceUid,
                "vendor-event-" + deviceUid,
                receivedAt,
                receivedAt,
                new BigDecimal("37.5005000"),
                new BigDecimal("127.0270000"),
                new BigDecimal("12.5"),
                TelemetrySource.POLLING,
                null);
    }

    private static TelemetryIngestResponse stubIngestResponse() {
        return new TelemetryIngestResponse(
                UUID.randomUUID(),
                UUID.randomUUID(),
                "VENDOR-STUB",
                UUID.randomUUID(),
                Instant.now(),
                false,
                true,
                true,
                "ACCEPTED");
    }
}
