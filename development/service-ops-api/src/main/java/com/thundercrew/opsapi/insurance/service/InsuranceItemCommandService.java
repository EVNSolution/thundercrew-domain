package com.thundercrew.opsapi.insurance.service;

import com.thundercrew.opsapi.common.api.DuplicateActiveResourceException;
import com.thundercrew.opsapi.common.api.InvalidStateTransitionException;
import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import com.thundercrew.opsapi.insurance.domain.InsuranceCategory;
import com.thundercrew.opsapi.insurance.domain.InsuranceCoverageType;
import com.thundercrew.opsapi.insurance.domain.InsuranceDurationUnit;
import com.thundercrew.opsapi.insurance.domain.InsuranceItem;
import com.thundercrew.opsapi.insurance.dto.InsuranceItemCreateRequest;
import com.thundercrew.opsapi.insurance.dto.InsuranceItemReadResponse;
import com.thundercrew.opsapi.insurance.dto.InsuranceItemUpdateRequest;
import com.thundercrew.opsapi.insurance.repository.InsuranceItemRepository;
import com.thundercrew.opsapi.insurance.repository.RiderInsuranceRepository;
import jakarta.persistence.EntityManager;
import java.time.Clock;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class InsuranceItemCommandService {

    private final InsuranceItemRepository insuranceItemRepository;
    private final RiderInsuranceRepository riderInsuranceRepository;
    private final EntityManager entityManager;
    private final Clock clock;

    public InsuranceItemCommandService(
            InsuranceItemRepository insuranceItemRepository,
            RiderInsuranceRepository riderInsuranceRepository,
            EntityManager entityManager,
            Clock clock
    ) {
        this.insuranceItemRepository = insuranceItemRepository;
        this.riderInsuranceRepository = riderInsuranceRepository;
        this.entityManager = entityManager;
        this.clock = clock;
    }

    @Transactional
    public InsuranceItemReadResponse create(InsuranceItemCreateRequest request) {
        assertNameIsNotDuplicated(request.name());
        assertDefaultPeriodIsConsistent(
                request.defaultDurationUnit(),
                request.defaultDurationValue()
        );
        InsuranceItem item = InsuranceItem.create(
                request.name(),
                request.description(),
                request.enabled(),
                request.category(),
                request.coverageType(),
                request.defaultDurationUnit(),
                request.defaultDurationValue()
        );
        try {
            InsuranceItem saved = insuranceItemRepository.save(item);
            entityManager.flush();
            entityManager.refresh(saved);
            return InsuranceItemReadResponse.from(saved);
        } catch (DataIntegrityViolationException exception) {
            throw new DuplicateActiveResourceException("InsuranceItem", "name");
        }
    }

    @Transactional
    public InsuranceItemReadResponse update(UUID id, InsuranceItemUpdateRequest request) {
        InsuranceItem item = insuranceItemRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("InsuranceItem", id));
        if (StringUtils.hasText(request.name())
                && insuranceItemRepository.existsByNameAndIdNotAndDeletedAtIsNull(request.name(), id)) {
            throw new DuplicateActiveResourceException("InsuranceItem", "name");
        }
        if (request.defaultDurationProvided()) {
            assertDefaultPeriodIsConsistent(
                    request.defaultDurationUnit(),
                    request.defaultDurationValue()
            );
        }
        try {
            item.updateOperatorManagedFields(
                    request.name(),
                    request.description(),
                    request.enabled(),
                    request.category(),
                    request.coverageTypeProvided(),
                    request.coverageType(),
                    request.defaultDurationProvided(),
                    request.defaultDurationUnit(),
                    request.defaultDurationValue()
            );
            entityManager.flush();
            return InsuranceItemReadResponse.from(item);
        } catch (DataIntegrityViolationException exception) {
            throw new DuplicateActiveResourceException("InsuranceItem", "name");
        }
    }

    @Transactional
    public void softDelete(UUID id) {
        InsuranceItem item = insuranceItemRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("InsuranceItem", id));
        if (riderInsuranceRepository.existsByInsuranceItemIdAndEnabledTrueAndDeletedAtIsNull(id)) {
            throw new InvalidStateTransitionException(
                    "Insurance item cannot be deleted while active rider insurance links reference it."
            );
        }
        item.disableAndMarkDeleted(null, clock.instant());
    }

    private void assertNameIsNotDuplicated(String name) {
        if (insuranceItemRepository.existsByNameAndDeletedAtIsNull(name)) {
            throw new DuplicateActiveResourceException("InsuranceItem", "name");
        }
    }

    /**
     * 단위와 값은 함께 들어와야 한다. 한쪽만 있으면 잘못된 상태.
     */
    private void assertDefaultPeriodIsConsistent(
            InsuranceDurationUnit unit,
            Integer value
    ) {
        if ((unit == null) != (value == null)) {
            throw new InvalidStateTransitionException(
                    "defaultDurationUnit 과 defaultDurationValue 는 함께 제공되어야 합니다.");
        }
    }
}
