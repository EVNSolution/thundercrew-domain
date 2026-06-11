package com.thundercrew.opsapi.tip.service;

import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import com.thundercrew.opsapi.tip.domain.Tip;
import com.thundercrew.opsapi.tip.dto.TipCreateRequest;
import com.thundercrew.opsapi.tip.dto.TipReadResponse;
import com.thundercrew.opsapi.tip.dto.TipUpdateRequest;
import com.thundercrew.opsapi.tip.repository.TipRepository;
import java.time.Clock;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class TipCommandService {

    private final TipRepository tipRepository;
    private final Clock clock;

    public TipCommandService(TipRepository tipRepository, Clock clock) {
        this.tipRepository = tipRepository;
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
        return TipReadResponse.from(tipRepository.save(tip));
    }

    public void deleteTip(UUID id) {
        Tip tip = tipRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("Tip", id));
        tip.markDeleted(null, clock.instant());
        tipRepository.save(tip);
    }
}
