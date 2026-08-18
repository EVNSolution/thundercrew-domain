package com.thundercrew.opsapi.rider.service;

import com.thundercrew.opsapi.common.api.DuplicateActiveResourceException;
import com.thundercrew.opsapi.common.api.InvalidStateTransitionException;
import com.thundercrew.opsapi.common.api.ReferenceDeletedException;
import com.thundercrew.opsapi.common.api.ReferenceNotFoundException;
import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import com.thundercrew.opsapi.rider.domain.RiderEducationRecord;
import com.thundercrew.opsapi.rider.domain.RiderEducationType;
import com.thundercrew.opsapi.rider.domain.RiderTrainingStatus;
import com.thundercrew.opsapi.rider.dto.RiderEducationRecordCreateRequest;
import com.thundercrew.opsapi.rider.dto.RiderEducationRecordReadResponse;
import com.thundercrew.opsapi.rider.dto.RiderEducationRecordUpdateRequest;
import com.thundercrew.opsapi.rider.repository.RiderEducationRecordRepository;
import com.thundercrew.opsapi.rider.repository.RiderRepository;
import jakarta.persistence.EntityManager;
import java.time.Clock;
import java.time.Instant;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class RiderEducationRecordCommandService {

    private final RiderEducationRecordRepository educationRecordRepository;
    private final RiderRepository riderRepository;
    private final EntityManager entityManager;
    private final Clock clock;

    public RiderEducationRecordCommandService(
            RiderEducationRecordRepository educationRecordRepository,
            RiderRepository riderRepository,
            EntityManager entityManager,
            Clock clock
    ) {
        this.educationRecordRepository = educationRecordRepository;
        this.riderRepository = riderRepository;
        this.entityManager = entityManager;
        this.clock = clock;
    }

    @Transactional
    public RiderEducationRecordReadResponse create(RiderEducationRecordCreateRequest request) {
        assertActiveRiderReference(request.riderId());
        assertExpiryIsAfterCompletion(request.completedAt(), request.expiresAt());
        assertCertificateNoIsAvailable(request.certificateNo(), null);

        RiderEducationRecord record = RiderEducationRecord.create(
                request.riderId(),
                request.educationType(),
                request.courseName(),
                request.completedAt(),
                request.expiresAt(),
                StringUtils.hasText(request.certificateNo()) ? request.certificateNo() : null,
                request.issuingAuthority(),
                request.evidenceUrl(),
                request.memo()
        );
        try {
            RiderEducationRecord saved = educationRecordRepository.save(record);
            entityManager.flush();
            entityManager.refresh(saved);
            syncTrainingStatus(request.riderId());
            return RiderEducationRecordReadResponse.from(saved);
        } catch (DataIntegrityViolationException exception) {
            throw new DuplicateActiveResourceException("RiderEducationRecord", "certificateNo");
        }
    }

    @Transactional
    public RiderEducationRecordReadResponse update(UUID id, RiderEducationRecordUpdateRequest request) {
        RiderEducationRecord record = educationRecordRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("RiderEducationRecord", id));

        Instant effectiveCompletedAt = request.completedAtProvided()
                ? request.completedAt()
                : record.getCompletedAt();
        Instant effectiveExpiresAt = request.expiresAtProvided()
                ? request.expiresAt()
                : record.getExpiresAt();
        assertExpiryIsAfterCompletion(effectiveCompletedAt, effectiveExpiresAt);

        if (request.certificateNoProvided()) {
            String newCertificateNo = StringUtils.hasText(request.certificateNo())
                    ? request.certificateNo()
                    : null;
            assertCertificateNoIsAvailable(newCertificateNo, id);
        }

        try {
            record.updateOperatorManagedFields(
                    request.educationType(),
                    request.courseName(),
                    request.completedAtProvided(),
                    request.completedAt(),
                    request.expiresAtProvided(),
                    request.expiresAt(),
                    request.certificateNoProvided(),
                    request.certificateNo(),
                    request.issuingAuthority(),
                    request.evidenceUrl(),
                    request.memo()
            );
            entityManager.flush();
            syncTrainingStatus(record.getRiderId());
            return RiderEducationRecordReadResponse.from(record);
        } catch (DataIntegrityViolationException exception) {
            throw new DuplicateActiveResourceException("RiderEducationRecord", "certificateNo");
        }
    }

    @Transactional
    public void softDelete(UUID id) {
        RiderEducationRecord record = educationRecordRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("RiderEducationRecord", id));
        record.markDeletedNow(null, clock.instant());
        entityManager.flush();
        syncTrainingStatus(record.getRiderId());
    }

    /**
     * riders.training_status 를 교육 기록에서 파생해 맞춘다 — 최신
     * completedAt 기록의 유형, 기록이 없으면 INCOMPLETE. 이 컬럼은 원래
     * 엑셀 업로드만 채우던 표시용 캐시라, 기록 CRUD 가 소스가 되도록
     * 여기서 매번 재계산한다. (호출 전 flush 로 기록 변경이 보이는 상태여야
     * 한다.)
     */
    private void syncTrainingStatus(UUID riderId) {
        RiderTrainingStatus derived = educationRecordRepository
                .findByRiderIdAndDeletedAtIsNullOrderByCompletedAtDesc(riderId)
                .stream()
                .findFirst()
                .map(latest -> latest.getEducationType() == RiderEducationType.ONLINE
                        ? RiderTrainingStatus.ONLINE
                        : RiderTrainingStatus.OFFLINE)
                .orElse(RiderTrainingStatus.INCOMPLETE);
        riderRepository.findByIdAndDeletedAtIsNull(riderId)
                .ifPresent(rider -> rider.updateTrainingStatus(derived));
    }

    private void assertActiveRiderReference(UUID riderId) {
        if (riderRepository.findByIdAndDeletedAtIsNull(riderId).isPresent()) {
            return;
        }
        if (riderRepository.existsById(riderId)) {
            throw new ReferenceDeletedException("Rider", riderId);
        }
        throw new ReferenceNotFoundException("Rider", riderId);
    }

    private void assertExpiryIsAfterCompletion(Instant completedAt, Instant expiresAt) {
        if (completedAt != null && expiresAt != null && !expiresAt.isAfter(completedAt)) {
            throw new InvalidStateTransitionException("expiresAt must be after completedAt.");
        }
    }

    private void assertCertificateNoIsAvailable(String certificateNo, UUID excludeId) {
        if (!StringUtils.hasText(certificateNo)) {
            return;
        }
        boolean duplicate = excludeId == null
                ? educationRecordRepository.existsByCertificateNoAndDeletedAtIsNull(certificateNo)
                : educationRecordRepository.existsByCertificateNoAndIdNotAndDeletedAtIsNull(certificateNo, excludeId);
        if (duplicate) {
            throw new DuplicateActiveResourceException("RiderEducationRecord", "certificateNo");
        }
    }

    /**
     * Future-extension hook used by the read service when it wants to derive
     * the latest education type for a rider — kept here so the command
     * service stays the single source of truth for {@link RiderEducationType}.
     */
    public RiderEducationType domainTypeOf(RiderEducationRecord record) {
        return record == null ? null : record.getEducationType();
    }
}
