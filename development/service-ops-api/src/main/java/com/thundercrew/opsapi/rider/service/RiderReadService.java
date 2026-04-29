package com.thundercrew.opsapi.rider.service;

import com.thundercrew.opsapi.common.api.PageResponse;
import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import com.thundercrew.opsapi.rider.dto.RiderReadResponse;
import com.thundercrew.opsapi.rider.repository.RiderRepository;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class RiderReadService {

    private final RiderRepository riderRepository;

    public RiderReadService(RiderRepository riderRepository) {
        this.riderRepository = riderRepository;
    }

    public PageResponse<RiderReadResponse> list(Pageable pageable) {
        return PageResponse.of(riderRepository.findByDeletedAtIsNull(pageable).map(RiderReadResponse::from));
    }

    public RiderReadResponse get(UUID id) {
        return riderRepository.findByIdAndDeletedAtIsNull(id)
                .map(RiderReadResponse::from)
                .orElseThrow(() -> new ResourceNotFoundException("Rider", id));
    }
}
