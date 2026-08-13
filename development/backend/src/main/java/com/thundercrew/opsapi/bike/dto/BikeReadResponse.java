package com.thundercrew.opsapi.bike.dto;

import com.thundercrew.opsapi.bike.domain.Bike;
import com.thundercrew.opsapi.bike.domain.BikeEngineType;
import com.thundercrew.opsapi.bike.domain.BikeOperationStatus;
import com.thundercrew.opsapi.bike.domain.BikePurpose;
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
        /** 용도. 배차 방식(serviceType)과 다른 축이다. */
        BikePurpose purpose,
        BikeServiceType serviceType,
        BikeOperationStatus operationStatus,
        boolean ignitionBlocked,
        String memo,
        BikeWheelType wheelType,
        String imei,
        String terminalId,
        Instant createdAt,
        Instant updatedAt
) {
    public static BikeReadResponse from(Bike bike, BikeServiceType serviceType) {
        return new BikeReadResponse(
                bike.getId(),
                bike.getIdx(),
                bike.getPlateNumber(),
                bike.getVin(),
                bike.getModelName(),
                bike.getEngineType(),
                bike.getPurpose(),
                serviceType,
                bike.getOperationStatus(),
                bike.isIgnitionBlocked(),
                bike.getMemo(),
                bike.getWheelType(),
                bike.getImei(),
                bike.getTerminalId(),
                bike.getCreatedAt(),
                bike.getUpdatedAt()
        );
    }
}
