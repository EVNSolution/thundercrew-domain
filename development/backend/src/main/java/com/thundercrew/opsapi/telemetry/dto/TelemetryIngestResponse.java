package com.thundercrew.opsapi.telemetry.dto;

import com.thundercrew.opsapi.telemetry.domain.DeviceTelemetryLog;
import java.time.Instant;
import java.util.UUID;

public record TelemetryIngestResponse(
        UUID telemetryLogId,
        UUID deviceId,
        String deviceUid,
        UUID bikeId,
        Instant receivedAt,
        boolean duplicate,
        boolean recentStateCreated,
        boolean currentStateUpdated,
        String ingestionStatus
) {
    public static TelemetryIngestResponse of(
            DeviceTelemetryLog log,
            boolean duplicate,
            boolean recentStateCreated,
            boolean currentStateUpdated,
            String ingestionStatus
    ) {
        return new TelemetryIngestResponse(
                log.getId(),
                log.getDeviceId(),
                log.getDeviceUid(),
                log.getBikeId(),
                log.getReceivedAt(),
                duplicate,
                recentStateCreated,
                currentStateUpdated,
                ingestionStatus
        );
    }
}
