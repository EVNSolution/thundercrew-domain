package com.thundercrew.opsapi.notification.service;

import jakarta.persistence.EntityManager;
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
    private final EntityManager entityManager;

    public ReignitionNotificationCommandService(EntityManager entityManager, ReignitionNotificationRepository reignitionNotificationRepository) {
        this.entityManager = entityManager;
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
        // idx 는 DB bigserial 이라 save() 직후에는 엔티티에 값이 없다. 응답에 idx 를
        // 실어야 하므로 flush 후 refresh 로 읽어온다 (BikeCommandService 와 같은 방식).
        ReignitionNotification saved = reignitionNotificationRepository.save(notification);
        entityManager.flush();
        entityManager.refresh(saved);
        return ReignitionNotificationReadResponse.from(saved);
    }
}
