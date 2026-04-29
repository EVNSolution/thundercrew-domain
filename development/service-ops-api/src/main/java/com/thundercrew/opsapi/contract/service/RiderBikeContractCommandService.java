package com.thundercrew.opsapi.contract.service;

import com.thundercrew.opsapi.common.api.InvalidStateTransitionException;
import com.thundercrew.opsapi.common.api.PeriodOverlapException;
import com.thundercrew.opsapi.common.api.ReferenceDeletedException;
import com.thundercrew.opsapi.common.api.ReferenceNotFoundException;
import com.thundercrew.opsapi.contract.domain.ContractTemplate;
import com.thundercrew.opsapi.contract.domain.RiderBikeContract;
import com.thundercrew.opsapi.contract.dto.RiderBikeContractCreateRequest;
import com.thundercrew.opsapi.contract.dto.RiderBikeContractReadResponse;
import com.thundercrew.opsapi.contract.repository.ContractTemplateRepository;
import com.thundercrew.opsapi.contract.repository.RiderBikeContractRepository;
import jakarta.persistence.EntityManager;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RiderBikeContractCommandService {

    private static final Instant OPEN_ENDED_OVERLAP_BOUND = Instant.parse("9999-12-31T23:59:59Z");

    private final RiderBikeContractRepository riderBikeContractRepository;
    private final ContractTemplateRepository contractTemplateRepository;
    private final EntityManager entityManager;

    public RiderBikeContractCommandService(
            RiderBikeContractRepository riderBikeContractRepository,
            ContractTemplateRepository contractTemplateRepository,
            EntityManager entityManager
    ) {
        this.riderBikeContractRepository = riderBikeContractRepository;
        this.contractTemplateRepository = contractTemplateRepository;
        this.entityManager = entityManager;
    }

    @Transactional
    public RiderBikeContractReadResponse create(RiderBikeContractCreateRequest request) {
        assertActiveRiderReference(request.riderId());
        assertActiveBikeReference(request.bikeId());
        ContractTemplate template = findEnabledTemplateReference(request.contractTemplateId());
        Instant endAt = deriveEndAt(request.startAt(), template);
        lockAssignmentReferences(request.riderId(), request.bikeId());
        assertNoOverlap(request.riderId(), request.bikeId(), request.startAt(), endAt);

        RiderBikeContract contract = RiderBikeContract.create(
                request.riderId(),
                request.bikeId(),
                request.contractTemplateId(),
                request.startAt(),
                endAt,
                request.memo()
        );
        RiderBikeContract saved = riderBikeContractRepository.save(contract);
        entityManager.flush();
        entityManager.refresh(saved);
        return RiderBikeContractReadResponse.from(saved);
    }

    private void assertActiveRiderReference(UUID riderId) {
        if (riderBikeContractRepository.existsActiveRiderById(riderId)) {
            return;
        }
        if (riderBikeContractRepository.existsRiderById(riderId)) {
            throw new ReferenceDeletedException("Rider", riderId);
        }
        throw new ReferenceNotFoundException("Rider", riderId);
    }

    private void assertActiveBikeReference(UUID bikeId) {
        if (riderBikeContractRepository.existsActiveBikeById(bikeId)) {
            return;
        }
        if (riderBikeContractRepository.existsBikeById(bikeId)) {
            throw new ReferenceDeletedException("Bike", bikeId);
        }
        throw new ReferenceNotFoundException("Bike", bikeId);
    }

    private ContractTemplate findEnabledTemplateReference(UUID templateId) {
        ContractTemplate template = contractTemplateRepository.findById(templateId)
                .orElseThrow(() -> new ReferenceNotFoundException("ContractTemplate", templateId));
        if (template.isDeleted()) {
            throw new ReferenceDeletedException("ContractTemplate", templateId);
        }
        if (!template.isEnabled()) {
            throw new InvalidStateTransitionException("Contract template is disabled and cannot be assigned.");
        }
        return template;
    }

    private Instant deriveEndAt(Instant startAt, ContractTemplate template) {
        Integer durationMinutes = template.getDurationMinutes();
        if (durationMinutes == null) {
            return null;
        }
        return startAt.plus(Duration.ofMinutes(durationMinutes));
    }

    private void lockAssignmentReferences(UUID riderId, UUID bikeId) {
        List.of(
                        "rider-bike-contract:bike:" + bikeId,
                        "rider-bike-contract:rider:" + riderId
                )
                .stream()
                .sorted()
                .forEach(this::lockByKey);
    }

    private void lockByKey(String lockKey) {
        entityManager.createNativeQuery("select pg_advisory_xact_lock(hashtextextended(?1, 0))")
                .setParameter(1, lockKey)
                .getSingleResult();
    }

    private void assertNoOverlap(UUID riderId, UUID bikeId, Instant startAt, Instant endAt) {
        Instant effectiveEndAt = endAt == null ? OPEN_ENDED_OVERLAP_BOUND : endAt;
        if (riderBikeContractRepository.existsOverlappingRiderPeriod(riderId, startAt, effectiveEndAt)) {
            throw new PeriodOverlapException("Rider already has an overlapping bike contract.");
        }
        if (riderBikeContractRepository.existsOverlappingBikePeriod(bikeId, startAt, effectiveEndAt)) {
            throw new PeriodOverlapException("Bike already has an overlapping rider contract.");
        }
    }
}
