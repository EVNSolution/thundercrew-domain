package com.thundercrew.opsapi.devicesync.dto;

import java.util.List;

public record DeviceApiSyncRunListResponse(
        List<DeviceApiSyncRunResponse> items,
        Page page
) {
    public record Page(
            int number,
            int size,
            long totalItems,
            boolean hasNext,
            boolean hasPrevious
    ) {
    }
}
