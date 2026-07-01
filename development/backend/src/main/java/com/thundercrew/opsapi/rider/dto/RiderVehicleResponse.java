package com.thundercrew.opsapi.rider.dto;

import com.thundercrew.opsapi.bike.domain.BikeServiceType;
import java.time.Instant;
import java.util.UUID;

public record RiderVehicleResponse(
        UUID bikeId,
        String plateNumber,
        String imei,
        BikeServiceType serviceType,
        Double currentLatitude,
        Double currentLongitude,
        Integer odometerKm,
        String connectionStatus,
        Instant lastReceivedAt
) {
}
