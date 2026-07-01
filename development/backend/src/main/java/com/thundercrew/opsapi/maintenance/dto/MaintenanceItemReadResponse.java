package com.thundercrew.opsapi.maintenance.dto;

import com.thundercrew.opsapi.maintenance.domain.MaintenanceCategory;
import com.thundercrew.opsapi.maintenance.domain.MaintenanceItem;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;

public record MaintenanceItemReadResponse(
        UUID id,
        Long idx,
        String name,
        Set<MaintenanceCategory> categories,
        Integer cycleKm,
        Integer cycleMonths,
        String memo,
        Integer alertThresholdPercent,
        Instant createdAt,
        Instant updatedAt
) {
    public static MaintenanceItemReadResponse from(MaintenanceItem item) {
        return new MaintenanceItemReadResponse(
                item.getId(),
                item.getIdx(),
                item.getName(),
                item.getCategories(),
                item.getCycleKm(),
                item.getCycleMonths(),
                item.getMemo(),
                item.getAlertThresholdPercent(),
                item.getCreatedAt(),
                item.getUpdatedAt()
        );
    }
}
