package com.thundercrew.opsapi.notification.dto;

import com.thundercrew.opsapi.notification.domain.ReignitionNotification;
import java.time.Instant;
import java.util.UUID;

public record ReignitionNotificationReadResponse(
        UUID id,
        Long idx,
        UUID bikeId,
        String plateNumber,
        Instant occurredAt,
        String nextCustomerName,
        String nextAddress,
        Double nextLatitude,
        Double nextLongitude,
        Instant createdAt
) {
    public static ReignitionNotificationReadResponse from(ReignitionNotification notification) {
        return new ReignitionNotificationReadResponse(
                notification.getId(),
                notification.getIdx(),
                notification.getBikeId(),
                notification.getPlateNumber(),
                notification.getOccurredAt(),
                notification.getNextCustomerName(),
                notification.getNextAddress(),
                notification.getNextLatitude(),
                notification.getNextLongitude(),
                notification.getCreatedAt()
        );
    }
}
