package com.thundercrew.opsapi.maintenance.dto;

import com.thundercrew.opsapi.maintenance.domain.VehicleMaintenanceRecord;
import java.time.Instant;
import java.util.UUID;

public record VehicleMaintenanceRecordReadResponse(
        UUID id,
        Long idx,
        UUID bikeId,
        UUID itemId,
        Instant servicedAt,
        Integer servicedAtOdometerKm,
        String memo,
        Instant createdAt,
        Instant updatedAt
) {
    public static VehicleMaintenanceRecordReadResponse from(VehicleMaintenanceRecord record) {
        return new VehicleMaintenanceRecordReadResponse(
                record.getId(),
                record.getIdx(),
                record.getBikeId(),
                record.getItemId(),
                record.getServicedAt(),
                record.getServicedAtOdometerKm(),
                record.getMemo(),
                record.getCreatedAt(),
                record.getUpdatedAt()
        );
    }
}
