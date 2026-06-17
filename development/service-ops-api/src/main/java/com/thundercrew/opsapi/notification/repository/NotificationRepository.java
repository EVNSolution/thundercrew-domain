package com.thundercrew.opsapi.notification.repository;

import com.thundercrew.opsapi.notification.domain.Notification;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    List<Notification> findTop100ByDeletedAtIsNullOrderByOccurredAtDesc();

    List<Notification> findTop100ByAcknowledgedAtIsNullAndDeletedAtIsNullOrderByOccurredAtDesc();

    List<Notification> findTop100ByTypeAndDeletedAtIsNullOrderByOccurredAtDesc(String type);

    boolean existsByRefBikeIdAndRefEntityIdAndTypeAndOccurredAtAfterAndDeletedAtIsNull(
            UUID bikeId,
            UUID entityId,
            String type,
            Instant after
    );
}
