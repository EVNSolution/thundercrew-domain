package com.thundercrew.opsapi.rider.repository;

import com.thundercrew.opsapi.rider.domain.RiderEducationRecord;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.Repository;

public interface RiderEducationRecordRepository extends Repository<RiderEducationRecord, UUID> {

    RiderEducationRecord save(RiderEducationRecord record);

    Optional<RiderEducationRecord> findByIdAndDeletedAtIsNull(UUID id);

    Page<RiderEducationRecord> findByDeletedAtIsNull(Pageable pageable);

    Page<RiderEducationRecord> findByRiderIdAndDeletedAtIsNullOrderByCompletedAtDesc(UUID riderId, Pageable pageable);

    List<RiderEducationRecord> findByRiderIdAndDeletedAtIsNullOrderByCompletedAtDesc(UUID riderId);

    boolean existsByCertificateNoAndDeletedAtIsNull(String certificateNo);

    boolean existsByCertificateNoAndIdNotAndDeletedAtIsNull(String certificateNo, UUID id);
}
