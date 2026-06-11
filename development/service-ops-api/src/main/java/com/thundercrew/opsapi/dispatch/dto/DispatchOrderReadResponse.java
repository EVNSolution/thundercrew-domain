package com.thundercrew.opsapi.dispatch.dto;

import com.thundercrew.opsapi.dispatch.domain.DispatchOrder;
import com.thundercrew.opsapi.dispatch.domain.DispatchOrderStatus;
import java.time.Instant;
import java.util.UUID;

public record DispatchOrderReadResponse(
        UUID id,
        Long idx,
        UUID bikeId,
        String customerName,
        String customerPhone,
        String address,
        double latitude,
        double longitude,
        long sequence,
        DispatchOrderStatus status,
        Instant completedAt,
        Instant createdAt
) {
    public static DispatchOrderReadResponse from(DispatchOrder order) {
        return new DispatchOrderReadResponse(
                order.getId(),
                order.getIdx(),
                order.getBikeId(),
                order.getCustomerName(),
                order.getCustomerPhone(),
                order.getAddress(),
                order.getLatitude(),
                order.getLongitude(),
                order.getSequence(),
                order.getStatus(),
                order.getCompletedAt(),
                order.getCreatedAt()
        );
    }
}
