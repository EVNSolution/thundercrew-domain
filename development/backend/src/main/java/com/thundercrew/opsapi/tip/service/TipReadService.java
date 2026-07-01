package com.thundercrew.opsapi.tip.service;

import com.thundercrew.opsapi.common.api.PageResponse;
import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import com.thundercrew.opsapi.tip.domain.TipStatus;
import com.thundercrew.opsapi.tip.dto.TipReadResponse;
import com.thundercrew.opsapi.tip.repository.TipRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class TipReadService {

    private final TipRepository tipRepository;

    public TipReadService(TipRepository tipRepository) {
        this.tipRepository = tipRepository;
    }

    public List<TipReadResponse> listPublished() {
        return tipRepository.findByStatusAndDeletedAtIsNull(TipStatus.PUBLISHED).stream()
                .map(TipReadResponse::from)
                .toList();
    }

    public PageResponse<TipReadResponse> listTips(Pageable pageable) {
        return PageResponse.of(tipRepository.findByDeletedAtIsNull(pageable).map(TipReadResponse::from));
    }

    public TipReadResponse getTip(UUID id) {
        return tipRepository.findByIdAndDeletedAtIsNull(id)
                .map(TipReadResponse::from)
                .orElseThrow(() -> new ResourceNotFoundException("Tip", id));
    }
}
