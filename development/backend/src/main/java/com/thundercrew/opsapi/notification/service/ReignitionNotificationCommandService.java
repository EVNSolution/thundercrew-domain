package com.thundercrew.opsapi.notification.service;

import com.thundercrew.opsapi.notification.domain.ReignitionNotification;
import com.thundercrew.opsapi.notification.dto.ReignitionNotificationCreateRequest;
import com.thundercrew.opsapi.notification.dto.ReignitionNotificationReadResponse;
import com.thundercrew.opsapi.notification.repository.ReignitionNotificationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class ReignitionNotificationCommandService {

    private final ReignitionNotificationRepository reignitionNotificationRepository;

    public ReignitionNotificationCommandService(ReignitionNotificationRepository reignitionNotificationRepository) {
        this.reignitionNotificationRepository = reignitionNotificationRepository;
    }

    public ReignitionNotificationReadResponse record(ReignitionNotificationCreateRequest req) {
        ReignitionNotification notification = ReignitionNotification.create(
                req.bikeId(),
                req.plateNumber(),
                req.occurredAt(),
                req.nextCustomerName(),
                req.nextAddress(),
                req.nextLatitude(),
                req.nextLongitude()
        );
        ReignitionNotification saved = reignitionNotificationRepository.save(notification);
        return ReignitionNotificationReadResponse.from(saved);
    }
}
