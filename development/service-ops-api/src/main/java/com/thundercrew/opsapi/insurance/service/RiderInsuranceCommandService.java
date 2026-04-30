package com.thundercrew.opsapi.insurance.service;

import com.thundercrew.opsapi.common.api.DuplicateActiveResourceException;
import com.thundercrew.opsapi.common.api.InvalidStateTransitionException;
import com.thundercrew.opsapi.common.api.ReferenceDeletedException;
import com.thundercrew.opsapi.common.api.ReferenceNotFoundException;
import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import com.thundercrew.opsapi.insurance.domain.InsuranceItem;
import com.thundercrew.opsapi.insurance.domain.RiderInsurance;
import com.thundercrew.opsapi.insurance.dto.RiderInsuranceCreateRequest;
import com.thundercrew.opsapi.insurance.dto.RiderInsuranceReadResponse;
import com.thundercrew.opsapi.insurance.dto.RiderInsuranceUpdateRequest;
import com.thundercrew.opsapi.insurance.repository.InsuranceItemRepository;
import com.thundercrew.opsapi.insurance.repository.RiderInsuranceRepository;
import com.thundercrew.opsapi.rider.repository.RiderRepository;
import jakarta.persistence.EntityManager;
import java.time.Clock;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RiderInsuranceCommandService {

    private final RiderInsuranceRepository riderInsuranceRepository;
    private final RiderRepository riderRepository;
    private final InsuranceItemRepository insuranceItemRepository;
    private final EntityManager entityManager;
    private final Clock clock;

    public RiderInsuranceCommandService(
            RiderInsuranceRepository riderInsuranceRepository,
            RiderRepository riderRepository,
            InsuranceItemRepository insuranceItemRepository,
            EntityManager entityManager,
            Clock clock
    ) {
        this.riderInsuranceRepository = riderInsuranceRepository;
        this.riderRepository = riderRepository;
        this.insuranceItemRepository = insuranceItemRepository;
        this.entityManager = entityManager;
        this.clock = clock;
    }

    @Transactional
    public RiderInsuranceReadResponse create(RiderInsuranceCreateRequest request) {
        assertActiveRiderReference(request.riderId());
        findEnabledInsuranceItemReference(request.insuranceItemId());
        assertRiderInsurancePairIsNotDuplicated(request.riderId(), request.insuranceItemId());

        RiderInsurance riderInsurance = RiderInsurance.create(
                request.riderId(),
                request.insuranceItemId(),
                request.memo(),
                request.enabled()
        );
        try {
            RiderInsurance saved = riderInsuranceRepository.save(riderInsurance);
            entityManager.flush();
            entityManager.refresh(saved);
            return RiderInsuranceReadResponse.from(saved);
        } catch (DataIntegrityViolationException exception) {
            throw new DuplicateActiveResourceException("RiderInsurance", "riderId/insuranceItemId");
        }
    }

    @Transactional
    public RiderInsuranceReadResponse update(UUID id, RiderInsuranceUpdateRequest request) {
        RiderInsurance riderInsurance = riderInsuranceRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("RiderInsurance", id));
        if (Boolean.TRUE.equals(request.enabled())) {
            assertActiveRiderReference(riderInsurance.getRiderId());
            findEnabledInsuranceItemReference(riderInsurance.getInsuranceItemId());
        }
        riderInsurance.updateOperatorManagedFields(request.memo(), request.enabled());
        entityManager.flush();
        return RiderInsuranceReadResponse.from(riderInsurance);
    }

    @Transactional
    public void softDelete(UUID id) {
        RiderInsurance riderInsurance = riderInsuranceRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("RiderInsurance", id));
        riderInsurance.disableAndMarkDeleted(null, clock.instant());
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

    private InsuranceItem findEnabledInsuranceItemReference(UUID insuranceItemId) {
        InsuranceItem item = insuranceItemRepository.findById(insuranceItemId)
                .orElseThrow(() -> new ReferenceNotFoundException("InsuranceItem", insuranceItemId));
        if (item.isDeleted()) {
            throw new ReferenceDeletedException("InsuranceItem", insuranceItemId);
        }
        if (!item.isEnabled()) {
            throw new InvalidStateTransitionException("Insurance item is disabled and cannot be linked.");
        }
        return item;
    }

    private void assertRiderInsurancePairIsNotDuplicated(UUID riderId, UUID insuranceItemId) {
        if (riderInsuranceRepository.existsByRiderIdAndInsuranceItemIdAndDeletedAtIsNull(riderId, insuranceItemId)) {
            throw new DuplicateActiveResourceException("RiderInsurance", "riderId/insuranceItemId");
        }
    }
}
