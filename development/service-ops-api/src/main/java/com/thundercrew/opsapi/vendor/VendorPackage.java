/**
 * Vendor telemetry adapter layer. Holds the {@link
 * com.thundercrew.opsapi.vendor.VendorTelemetryFeed} interface that vendor
 * integrations implement, the default {@link
 * com.thundercrew.opsapi.vendor.StubVendorTelemetryFeed} (returns no events
 * — used until real vendor docs land), the {@link
 * com.thundercrew.opsapi.vendor.VendorTelemetryAdapter} that pipes feed
 * results into the existing telemetry ingest service, and the disabled-
 * by-default {@link
 * com.thundercrew.opsapi.vendor.VendorTelemetryPollingScheduler}.
 */
package com.thundercrew.opsapi.vendor;
