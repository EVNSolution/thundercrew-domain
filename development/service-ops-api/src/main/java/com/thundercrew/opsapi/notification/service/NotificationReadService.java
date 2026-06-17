package com.thundercrew.opsapi.notification.service;

import com.thundercrew.opsapi.notification.dto.NotificationReadResponse;
import com.thundercrew.opsapi.notification.repository.NotificationRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class NotificationReadService {

    private final NotificationRepository notificationRepository;

    public NotificationReadService(NotificationRepository notificationRepository) {
        this.notificationRepository = notificationRepository;
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
