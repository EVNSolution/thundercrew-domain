package com.thundercrew.opsapi.notification.service;

import com.thundercrew.opsapi.notification.dto.NotificationReadResponse;
import com.thundercrew.opsapi.notification.repository.NotificationRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class NotificationReadService {

    private final NotificationRepository notificationRepository;

    public NotificationReadService(NotificationRepository notificationRepository) {
        this.notificationRepository = notificationRepository;
    }

    public List<NotificationReadResponse> listForRiderOrBike(UUID riderId, UUID bikeId) {
        UUID effectiveBikeId = bikeId != null ? bikeId : new UUID(0, 0);
        return notificationRepository.findRecentForRiderOrBike(riderId, effectiveBikeId, PageRequest.of(0, 100))
                .stream()
                .map(NotificationReadResponse::from)
                .toList();
    }

    public List<NotificationReadResponse> listRecent(boolean unacknowledgedOnly, String typeOrNull) {
        if (typeOrNull != null) {
            return notificationRepository
                    .findTop100ByTypeAndDeletedAtIsNullOrderByOccurredAtDesc(typeOrNull)
                    .stream()
                    .map(NotificationReadResponse::from)
                    .toList();
        }
        if (unacknowledgedOnly) {
            return notificationRepository
                    .findTop100ByAcknowledgedAtIsNullAndDeletedAtIsNullOrderByOccurredAtDesc()
                    .stream()
                    .map(NotificationReadResponse::from)
                    .toList();
        }
        return notificationRepository
                .findTop100ByDeletedAtIsNullOrderByOccurredAtDesc()
                .stream()
                .map(NotificationReadResponse::from)
                .toList();
    }
}
