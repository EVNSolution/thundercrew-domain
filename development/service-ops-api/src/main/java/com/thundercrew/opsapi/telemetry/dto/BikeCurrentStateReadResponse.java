package com.thundercrew.opsapi.telemetry.dto;

import com.thundercrew.opsapi.telemetry.domain.BikeCurrentState;
import com.thundercrew.opsapi.telemetry.domain.TelemetryConnection;
import com.thundercrew.opsapi.telemetry.domain.TelemetryIgnitionStatus;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.UUID;

public record BikeCurrentStateReadResponse(
        UUID bikeId,
        UUID deviceId,
        UUID telemetryLogId,
        Instant lastReceivedAt,
        BigDecimal latitude,
        BigDecimal longitude,
        BigDecimal speedKph,
        BigDecimal batteryPercent,
        /** 누적 주행거리 (km). 텔레메트리가 안 들어왔으면 null. */
        Integer odometerKm,
        TelemetryIgnitionStatus ignitionStatus,
        String telemetrySource,
        String drivingStatus,
        String connectionStatus,
        String batteryStatus,
        Instant updatedAt
) {
    public static BikeCurrentStateReadResponse from(BikeCurrentState state, Clock clock) {
        return new BikeCurrentStateReadResponse(
                state.getBikeId(),
                state.getDeviceId(),
                state.getTelemetryLogId(),
                state.getLastReceivedAt(),
                state.getLatitude(),
                state.getLongitude(),
                state.getSpeedKph(),
                state.getBatteryPercent(),
                state.getOdometerKm(),
                state.getIgnitionStatus(),
                state.getTelemetrySource().name(),
                drivingStatus(state),
                connectionStatus(state, clock),
                batteryStatus(state),
                state.getUpdatedAt()
        );
    }

    private static String drivingStatus(BikeCurrentState state) {
        if (state.getIgnitionStatus() == TelemetryIgnitionStatus.UNKNOWN) {
            return "UNKNOWN";
        }
        if (state.getIgnitionStatus() == TelemetryIgnitionStatus.OFF) {
            return "PARKED";
        }
        BigDecimal speedKph = state.getSpeedKph() == null ? BigDecimal.ZERO : state.getSpeedKph();
        return speedKph.compareTo(BigDecimal.valueOf(3)) >= 0 ? "DRIVING" : "STOPPED";
    }

    private static String connectionStatus(BikeCurrentState state, Clock clock) {
        return TelemetryConnection.status(state.getLastReceivedAt(), Instant.now(clock));
    }

    private static String batteryStatus(BikeCurrentState state) {
        if (state.getBatteryPercent() == null) {
            return "UNKNOWN";
        }
        if (state.getBatteryPercent().compareTo(BigDecimal.valueOf(20)) < 0) {
            return "CRITICAL";
        }
        if (state.getBatteryPercent().compareTo(BigDecimal.valueOf(50)) < 0) {
            return "LOW";
        }
        return "NORMAL";
    }
}
