package com.thundercrew.opsapi.devicesync.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.thundercrew.opsapi.devicesync.domain.DeviceApiSyncRunStatus;
import com.thundercrew.opsapi.devicesync.domain.DeviceApiSyncType;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record DeviceApiSyncRunResponse(
        UUID id,
        Long idx,
        DeviceApiSyncType syncType,
        DeviceApiSyncRunStatus status,
        String externalTraceId,
        Instant startedAt,
        Instant finishedAt,
        int totalCount,
        int successCount,
        int failureCount,
        JsonNode requestSummary,
        JsonNode responseSummary,
        String errorCode,
        String errorMessage,
        Instant createdAt,
        Instant updatedAt,
        List<DeviceApiSyncResultResponse> results
) {
}
