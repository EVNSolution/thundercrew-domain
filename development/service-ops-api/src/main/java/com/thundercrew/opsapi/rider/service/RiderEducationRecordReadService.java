package com.thundercrew.opsapi.rider.service;

import com.thundercrew.opsapi.common.api.PageResponse;
import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import com.thundercrew.opsapi.rider.dto.RiderEducationRecordReadResponse;
import com.thundercrew.opsapi.rider.repository.RiderEducationRecordRepository;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class RiderEducationRecordReadService {

    private final RiderEducationRecordRepository educationRecordRepository;

    public RiderEducationRecordReadService(RiderEducationRecordRepository educationRecordRepository) {
        this.educationRecordRepository = educationRecordRepository;
    }

    public PageResponse<RiderEducationRecordReadResponse> list(Pageable pageable) {
        return PageResponse.of(
                educationRecordRepository.findByDeletedAtIsNull(pageable)
                        .map(RiderEducationRecordReadResponse::from)
        );
    }

    public PageResponse<RiderEducationRecordReadResponse> listByRider(UUID riderId, Pageable pageable) {
        return PageResponse.of(
                educationRecordRepository
                        .findByRiderIdAndDeletedAtIsNullOrderByCompletedAtDesc(riderId, pageable)
                        .map(RiderEducationRecordReadResponse::from)
        );
    }

    public RiderEducationRecordReadResponse get(UUID id) {
        return educationRecordRepository.findByIdAndDeletedAtIsNull(id)
                .map(RiderEducationRecordReadResponse::from)
                .orElseThrow(() -> new ResourceNotFoundException("RiderEducationRecord", id));
    }
}
