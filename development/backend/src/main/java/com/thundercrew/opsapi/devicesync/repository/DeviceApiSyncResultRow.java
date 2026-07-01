package com.thundercrew.opsapi.devicesync.repository;

import com.thundercrew.opsapi.devicesync.domain.DeviceApiSyncResultStatus;
import java.time.Instant;
import java.util.UUID;

public record DeviceApiSyncResultRow(
        UUID id,
        Long idx,
        UUID runId,
        String deviceUid,
        UUID deviceId,
        DeviceApiSyncResultStatus status,
        Integer httpStatus,
        String externalEventId,
        String requestSummary,
        String responseSummary,
        String errorCode,
        String errorMessage,
        Instant createdAt
) {
}
