package com.thundercrew.opsapi.tip.service;

import jakarta.persistence.EntityManager;
import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import com.thundercrew.opsapi.notification.service.NotificationCommandService;
import com.thundercrew.opsapi.tip.domain.Tip;
import com.thundercrew.opsapi.tip.dto.TipCreateRequest;
import com.thundercrew.opsapi.tip.dto.TipReadResponse;
import com.thundercrew.opsapi.tip.dto.TipSubmissionCreateRequest;
import com.thundercrew.opsapi.tip.dto.TipUpdateRequest;
import com.thundercrew.opsapi.tip.repository.TipRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class TipCommandService {

    private final TipRepository tipRepository;
    private final NotificationCommandService notificationCommandService;
    private final Clock clock;
    private final EntityManager entityManager;

    public TipCommandService(TipRepository tipRepository, NotificationCommandService notificationCommandService,
            Clock clock, EntityManager entityManager) {
        this.tipRepository = tipRepository;
        this.notificationCommandService = notificationCommandService;
        this.clock = clock;
        this.entityManager = entityManager;
    }

    public TipReadResponse createTip(TipCreateRequest request) {
        Tip tip = Tip.create(request.address(), request.content(), request.latitude(), request.longitude());
        // idx 는 DB bigserial 이라 save() 직후에는 엔티티에 값이 없다. 응답에 idx 를
        // 실어야 하므로 flush 후 refresh 로 읽어온다 (BikeCommandService 와 같은 방식).
        Tip saved = tipRepository.save(tip);
        entityManager.flush();
        entityManager.refresh(saved);
        return TipReadResponse.from(saved);
    }

    public TipReadResponse updateTip(UUID id, TipUpdateRequest request) {
        Tip tip = tipRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("Tip", id));
        tip.update(request.address(), request.content(), request.latitude(), request.longitude());
        return TipReadResponse.from(tip);
    }

    public void deleteTip(UUID id) {
        Tip tip = tipRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("Tip", id));
        tip.markDeleted(null, clock.instant());
    }

    public TipReadResponse submit(TipSubmissionCreateRequest request) {
        Tip tip = Tip.createSubmission(
                request.address(),
                request.content(),
                request.latitude(),
                request.longitude(),
                request.riderId());
        Tip saved = tipRepository.save(tip);
        notificationCommandService.record(
                "TIP_SUBMISSION",
                "팁 제출: " + request.address(),
                request.content(),
                null,
                saved.getId(),
                request.riderId(),
                Instant.now(clock));
        return TipReadResponse.from(saved);
    }

    public TipReadResponse publish(UUID id) {
        Tip tip = tipRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("Tip", id));
        tip.publish();
        return TipReadResponse.from(tip);
    }
}
