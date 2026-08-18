package com.thundercrew.opsapi.dispatch.dto;

import com.thundercrew.opsapi.dispatch.domain.CompletedSource;
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
        String originAddress,
        Double originLatitude,
        Double originLongitude,
        long sequence,
        DispatchOrderStatus status,
        Instant completedAt,
        Instant createdAt,
        UUID completedBy,
        boolean hasCompletionPhoto,
        Instant scheduledAt,
        Integer serviceMinutes,
        CompletedSource completedSource,
        Instant arrivalDetectedAt
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
                order.getOriginAddress(),
                order.getOriginLatitude(),
                order.getOriginLongitude(),
                order.getSequence(),
                order.getStatus(),
                order.getCompletedAt(),
                order.getCreatedAt(),
                order.getCompletedBy(),
                order.getCompletionPhoto() != null && order.getCompletionPhoto().length > 0,
                order.getScheduledAt(),
                order.getServiceMinutes(),
                order.getCompletedSource(),
                order.getArrivalDetectedAt()
        );
    }
}
