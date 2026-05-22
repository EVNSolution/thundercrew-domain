package com.thundercrew.opsapi.maintenance.dto;

import com.thundercrew.opsapi.maintenance.domain.MaintenanceAppliesTo;
import com.thundercrew.opsapi.maintenance.domain.MaintenanceItem;
import java.time.Instant;
import java.util.UUID;

public record MaintenanceItemReadResponse(
        UUID id,
        Long idx,
        String name,
        MaintenanceAppliesTo appliesTo,
        UUID parentItemId,
        Integer cycleKm,
        Integer cycleMonths,
        String cycleLabel,
        int displayOrder,
        boolean enabled,
        String memo,
        Instant createdAt,
        Instant updatedAt
) {
    public static MaintenanceItemReadResponse from(MaintenanceItem item) {
        return new MaintenanceItemReadResponse(
                item.getId(),
                item.getIdx(),
                item.getName(),
                item.getAppliesTo(),
                item.getParentItemId(),
                item.getCycleKm(),
                item.getCycleMonths(),
                item.getCycleLabel(),
                item.getDisplayOrder(),
                item.isEnabled(),
                item.getMemo(),
                item.getCreatedAt(),
                item.getUpdatedAt()
        );
    }
}
