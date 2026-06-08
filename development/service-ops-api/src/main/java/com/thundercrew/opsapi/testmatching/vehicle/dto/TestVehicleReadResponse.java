package com.thundercrew.opsapi.testmatching.vehicle.dto;

import com.thundercrew.opsapi.testmatching.vehicle.domain.TestBikeType;
import com.thundercrew.opsapi.testmatching.vehicle.domain.TestEngineType;
import com.thundercrew.opsapi.testmatching.vehicle.domain.TestVehicle;
import java.time.Instant;
import java.util.UUID;

public record TestVehicleReadResponse(
        UUID id, Long idx, String plateNumber,
        TestBikeType bikeType, TestEngineType engineType, String imei,
        Instant createdAt, Instant updatedAt
) {
    public static TestVehicleReadResponse from(TestVehicle v) {
        return new TestVehicleReadResponse(
                v.getId(), v.getIdx(), v.getPlateNumber(),
                v.getBikeType(), v.getEngineType(), v.getImei(),
                v.getCreatedAt(), v.getUpdatedAt());
    }
}
