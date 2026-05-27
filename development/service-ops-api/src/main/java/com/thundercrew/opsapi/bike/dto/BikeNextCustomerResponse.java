package com.thundercrew.opsapi.bike.dto;

import com.thundercrew.opsapi.bike.domain.BikeNextCustomer;
import java.util.UUID;

public record BikeNextCustomerResponse(
        UUID   bikeId,
        String customerName,
        String customerPhone,
        String address,
        double latitude,
        double longitude
) {
    public static BikeNextCustomerResponse from(BikeNextCustomer entity) {
        return new BikeNextCustomerResponse(
                entity.getBikeId(),
                entity.getCustomerName(),
                entity.getCustomerPhone(),
                entity.getAddress(),
                entity.getLatitude(),
                entity.getLongitude()
        );
    }
}
