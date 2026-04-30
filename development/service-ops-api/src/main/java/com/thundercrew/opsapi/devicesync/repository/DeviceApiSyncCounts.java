package com.thundercrew.opsapi.devicesync.repository;

public record DeviceApiSyncCounts(
        int totalCount,
        int successCount,
        int failureCount
) {
}
