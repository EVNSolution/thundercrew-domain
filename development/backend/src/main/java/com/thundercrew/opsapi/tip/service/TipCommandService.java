package com.thundercrew.opsapi.tip.service;

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

    public TipCommandService(TipRepository tipRepository, NotificationCommandService notificationCommandService, Clock clock) {
        this.tipRepository = tipRepository;
        this.notificationCommandService = notificationCommandService;
        this.clock = clock;
    }

    public TipReadResponse createTip(TipCreateRequest request) {
        Tip tip = Tip.create(request.address(), request.content(), request.latitude(), request.longitude());
        return TipReadResponse.from(tipRepository.save(tip));
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
