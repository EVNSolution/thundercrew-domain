package com.thundercrew.opsapi.notification.dto;

import com.thundercrew.opsapi.notification.domain.Notification;
import java.time.Instant;
import java.util.UUID;

public record NotificationReadResponse(
        UUID id,
        Long idx,
        String type,
        String title,
        String body,
        UUID refBikeId,
        UUID refEntityId,
        UUID refRiderId,
        Instant occurredAt,
        Instant acknowledgedAt,
        Instant createdAt
) {
    public static NotificationReadResponse from(Notification notification) {
        return new NotificationReadResponse(
                notification.getId(),
                notification.getIdx(),
                notification.getType(),
                notification.getTitle(),
                notification.getBody(),
                notification.getRefBikeId(),
                notification.getRefEntityId(),
                notification.getRefRiderId(),
                notification.getOccurredAt(),
                notification.getAcknowledgedAt(),
                notification.getCreatedAt()
        );
    }
}
