package com.thundercrew.opsapi.notification.service;

import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import com.thundercrew.opsapi.notification.domain.Notification;
import com.thundercrew.opsapi.notification.dto.NotificationReadResponse;
import com.thundercrew.opsapi.notification.repository.NotificationRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class NotificationCommandService {

    private final NotificationRepository notificationRepository;
    private final Clock clock;

    public NotificationCommandService(NotificationRepository notificationRepository, Clock clock) {
        this.notificationRepository = notificationRepository;
        this.clock = clock;
    }

    public NotificationReadResponse acknowledge(UUID id) {
        Notification notification = notificationRepository.findById(id)
                .filter(n -> n.getDeletedAt() == null)
                .orElseThrow(() -> new ResourceNotFoundException("Notification", id));
        notification.acknowledge(Instant.now(clock));
        return NotificationReadResponse.from(notification);
    }

    public NotificationReadResponse record(
            String type,
            String title,
            String body,
            UUID refBikeId,
            UUID refEntityId,
            UUID refRiderId,
            Instant occurredAt
    ) {
        Notification notification = Notification.create(type, title, body, refBikeId, refEntityId, refRiderId, occurredAt);
        Notification saved = notificationRepository.save(notification);
        return NotificationReadResponse.from(saved);
    }
}
