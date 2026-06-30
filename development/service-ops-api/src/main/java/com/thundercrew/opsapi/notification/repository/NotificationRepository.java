package com.thundercrew.opsapi.notification.repository;

import com.thundercrew.opsapi.notification.domain.Notification;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

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

    @Query("select n from Notification n where n.deletedAt is null "
         + "and (n.refRiderId = :riderId or n.refBikeId = :bikeId) order by n.occurredAt desc")
    List<Notification> findRecentForRiderOrBike(@Param("riderId") UUID riderId,
                                                @Param("bikeId") UUID bikeId,
                                                Pageable pageable);
}
