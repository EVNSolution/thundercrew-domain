package com.thundercrew.opsapi.bike.dto;

import com.thundercrew.opsapi.bike.domain.Bike;
import com.thundercrew.opsapi.bike.domain.BikeEngineType;
import com.thundercrew.opsapi.bike.domain.BikeOperationStatus;
import com.thundercrew.opsapi.bike.domain.BikeServiceType;
import com.thundercrew.opsapi.bike.domain.BikeWheelType;
import java.time.Instant;
import java.util.UUID;

public record BikeReadResponse(
        UUID id,
        Long idx,
        String plateNumber,
        String vin,
        String modelName,
        BikeEngineType engineType,
        BikeServiceType serviceType,
        BikeOperationStatus operationStatus,
        boolean ignitionBlocked,
        String memo,
        BikeWheelType wheelType,
        String imei,
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
                bike.getEngineType(),
                bike.getServiceType(),
                bike.getOperationStatus(),
                bike.isIgnitionBlocked(),
                bike.getMemo(),
                bike.getWheelType(),
                bike.getImei(),
                bike.getCreatedAt(),
                bike.getUpdatedAt()
        );
    }
}
