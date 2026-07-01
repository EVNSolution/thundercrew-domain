package com.thundercrew.opsapi.notification.repository;

import com.thundercrew.opsapi.notification.domain.ReignitionNotification;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReignitionNotificationRepository extends JpaRepository<ReignitionNotification, UUID> {

    List<ReignitionNotification> findTop50ByDeletedAtIsNullOrderByOccurredAtDesc();
}
