package com.thundercrew.opsapi.devicesync.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.thundercrew.opsapi.devicesync.domain.DeviceApiSyncResultStatus;
import java.time.Instant;
import java.util.UUID;

public record DeviceApiSyncResultResponse(
        UUID id,
        Long idx,
        UUID runId,
        String deviceUid,
        UUID deviceId,
        DeviceApiSyncResultStatus status,
        Integer httpStatus,
        String externalEventId,
        JsonNode requestSummary,
        JsonNode responseSummary,
        String errorCode,
        String errorMessage,
        Instant createdAt
) {
}
