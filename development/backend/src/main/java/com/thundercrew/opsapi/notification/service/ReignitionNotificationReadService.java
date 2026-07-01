package com.thundercrew.opsapi.notification.service;

import com.thundercrew.opsapi.notification.dto.ReignitionNotificationReadResponse;
import com.thundercrew.opsapi.notification.repository.ReignitionNotificationRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class ReignitionNotificationReadService {

    private final ReignitionNotificationRepository reignitionNotificationRepository;

    public ReignitionNotificationReadService(ReignitionNotificationRepository reignitionNotificationRepository) {
        this.reignitionNotificationRepository = reignitionNotificationRepository;
    }

    public List<ReignitionNotificationReadResponse> listRecent() {
        return reignitionNotificationRepository.findTop50ByDeletedAtIsNullOrderByOccurredAtDesc().stream()
                .map(ReignitionNotificationReadResponse::from)
                .toList();
    }
}
