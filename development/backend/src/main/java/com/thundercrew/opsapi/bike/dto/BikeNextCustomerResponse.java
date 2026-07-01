package com.thundercrew.opsapi.bike.dto;

import com.thundercrew.opsapi.bike.domain.BikeNextCustomer;
import java.util.UUID;

public record BikeNextCustomerResponse(
        UUID   bikeId,
        // 다음 고객 (null = 설정 안 됨 또는 이미 promote 됨)
        String customerName,
        String customerPhone,
        String address,
        Double latitude,
        Double longitude,
        // 현재 고객 (null = 아직 한 번도 이동한 적 없음)
        String currentCustomerName,
        String currentCustomerPhone,
        String currentCustomerAddress,
        Double currentCustomerLat,
        Double currentCustomerLng
) {
    public static BikeNextCustomerResponse from(BikeNextCustomer entity) {
        return new BikeNextCustomerResponse(
                entity.getBikeId(),
                entity.getCustomerName(),
                entity.getCustomerPhone(),
                entity.getAddress(),
                entity.getLatitude(),
                entity.getLongitude(),
                entity.getCurrentCustomerName(),
                entity.getCurrentCustomerPhone(),
                entity.getCurrentCustomerAddress(),
                entity.getCurrentCustomerLat(),
                entity.getCurrentCustomerLng()
        );
    }
}
