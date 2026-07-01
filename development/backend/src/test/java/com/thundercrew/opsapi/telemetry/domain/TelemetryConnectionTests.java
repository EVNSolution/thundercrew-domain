package com.thundercrew.opsapi.telemetry.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class TelemetryConnectionTests {

    private static final Instant NOW = Instant.parse("2026-07-01T00:00:00Z");

    private static Instant ago(Duration d) {
        return NOW.minus(d);
    }

    @Test
    void ignitionOnWithinTwoMinutesIsOnline() {
        assertThat(TelemetryConnection.status(ago(Duration.ofMinutes(1)), NOW, TelemetryIgnitionStatus.ON))
                .isEqualTo("ONLINE");
    }

    @Test
    void ignitionOnBeyondTwoMinutesIsOffline() {
        assertThat(TelemetryConnection.status(ago(Duration.ofMinutes(3)), NOW, TelemetryIgnitionStatus.ON))
                .isEqualTo("OFFLINE");
    }

    @Test
    void ignitionOffWithin120MinutesIsOnline() {
        assertThat(TelemetryConnection.status(ago(Duration.ofMinutes(90)), NOW, TelemetryIgnitionStatus.OFF))
                .isEqualTo("ONLINE");
    }

    @Test
    void ignitionOffBeyond120MinutesIsOffline() {
        assertThat(TelemetryConnection.status(ago(Duration.ofMinutes(130)), NOW, TelemetryIgnitionStatus.OFF))
                .isEqualTo("OFFLINE");
    }

    @Test
    void unknownIgnitionUsesLaxThreshold() {
        assertThat(TelemetryConnection.status(ago(Duration.ofMinutes(30)), NOW, TelemetryIgnitionStatus.UNKNOWN))
                .isEqualTo("ONLINE");
    }

    @Test
    void nullLastReceivedIsOffline() {
        assertThat(TelemetryConnection.status(null, NOW, TelemetryIgnitionStatus.ON))
                .isEqualTo("OFFLINE");
    }
}
