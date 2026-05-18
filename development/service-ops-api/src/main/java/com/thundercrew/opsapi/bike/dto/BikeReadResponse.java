package com.thundercrew.opsapi.bike.dto;

import com.thundercrew.opsapi.bike.domain.Bike;
import com.thundercrew.opsapi.bike.domain.BikeOperationStatus;
import java.time.Instant;
import java.util.UUID;

public record BikeReadResponse(
        UUID id,
        Long idx,
        String plateNumber,
        String vin,
        String modelName,
        BikeOperationStatus operationStatus,
        boolean ignitionBlocked,
        String memo,
        Instant createdAt,
        Instant updatedAt
) {
    public static BikeReadResponse from(Bike bike) {
        return new BikeReadResponse(
                bike.getId(),
                bike.getIdx(),
                bike.getPlateNumber(),
                bike.getVin(),
                bike.getModelName(),
                bike.getOperationStatus(),
                bike.isIgnitionBlocked(),
                bike.getMemo(),
                bike.getCreatedAt(),
                bike.getUpdatedAt()
        );
    }
}
