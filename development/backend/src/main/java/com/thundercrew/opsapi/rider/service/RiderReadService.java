package com.thundercrew.opsapi.rider.service;

import com.thundercrew.opsapi.common.api.PageResponse;
import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import com.thundercrew.opsapi.rider.domain.Rider;
import com.thundercrew.opsapi.rider.domain.RiderEducationRecord;
import com.thundercrew.opsapi.rider.dto.RiderReadResponse;
import com.thundercrew.opsapi.rider.repository.RiderEducationRecordRepository;
import com.thundercrew.opsapi.rider.repository.RiderRepository;
import java.time.Clock;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class RiderReadService {

    private final RiderRepository riderRepository;
    private final RiderEducationRecordRepository educationRecordRepository;
    private final Clock clock;

    public RiderReadService(
            RiderRepository riderRepository,
            RiderEducationRecordRepository educationRecordRepository,
            Clock clock
    ) {
        this.riderRepository = riderRepository;
        this.educationRecordRepository = educationRecordRepository;
        this.clock = clock;
    }

    public PageResponse<RiderReadResponse> list(Pageable pageable) {
        return PageResponse.of(riderRepository.findByDeletedAtIsNull(pageable).map(RiderReadResponse::from));
    }

    public RiderReadResponse get(UUID id) {
        Rider rider = riderRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("Rider", id));
        RiderEducationRecord latest = findLatestEducation(id);
        return RiderReadResponse.from(rider, latest, clock.instant());
    }

    private RiderEducationRecord findLatestEducation(UUID riderId) {
        List<RiderEducationRecord> records = educationRecordRepository
                .findByRiderIdAndDeletedAtIsNullOrderByCompletedAtDesc(riderId);
        return records.isEmpty() ? null : records.get(0);
    }
}
