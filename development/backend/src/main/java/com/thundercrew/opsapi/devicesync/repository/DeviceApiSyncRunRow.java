package com.thundercrew.opsapi.devicesync.repository;

import com.thundercrew.opsapi.devicesync.domain.DeviceApiSyncRunStatus;
import com.thundercrew.opsapi.devicesync.domain.DeviceApiSyncType;
import java.time.Instant;
import java.util.UUID;

public record DeviceApiSyncRunRow(
        UUID id,
        Long idx,
        DeviceApiSyncType syncType,
        DeviceApiSyncRunStatus status,
        String externalTraceId,
        UUID requestedByAdminId,
        Instant startedAt,
        Instant finishedAt,
        int totalCount,
        int successCount,
        int failureCount,
        String requestSummary,
        String responseSummary,
        String errorCode,
        String errorMessage,
        Instant createdAt,
        Instant updatedAt
) {
}
