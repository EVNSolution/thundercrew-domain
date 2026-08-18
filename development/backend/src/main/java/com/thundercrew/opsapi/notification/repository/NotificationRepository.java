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

    /** 중복 방지의 자연 키가 (엔티티, 타입)인 알림용 — 재배정으로 bikeId 가 바뀌어도 유지. */
    boolean existsByRefEntityIdAndTypeAndOccurredAtAfterAndDeletedAtIsNull(
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
