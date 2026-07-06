package com.thundercrew.opsapi.contract.service;

import com.thundercrew.opsapi.audit.service.AuditLogCommandService;
import com.thundercrew.opsapi.common.api.InvalidStateTransitionException;
import com.thundercrew.opsapi.common.api.PeriodOverlapException;
import com.thundercrew.opsapi.common.api.ReferenceDeletedException;
import com.thundercrew.opsapi.common.api.ReferenceNotFoundException;
import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import com.thundercrew.opsapi.contract.domain.ContractTemplate;
import com.thundercrew.opsapi.contract.domain.RiderBikeContract;
import com.thundercrew.opsapi.contract.dto.RiderBikeContractCreateRequest;
import com.thundercrew.opsapi.contract.dto.RiderBikeContractReadResponse;
import com.thundercrew.opsapi.contract.dto.RiderBikeContractTerminateRequest;
import com.thundercrew.opsapi.contract.dto.RiderBikeContractUpdateRequest;
import com.thundercrew.opsapi.contract.repository.ContractTemplateRepository;
import com.thundercrew.opsapi.contract.repository.RiderBikeContractRepository;
import com.thundercrew.opsapi.insurance.domain.InsuranceItem;
import com.thundercrew.opsapi.insurance.domain.RiderInsurance;
import com.thundercrew.opsapi.insurance.repository.InsuranceItemRepository;
import com.thundercrew.opsapi.insurance.repository.RiderInsuranceRepository;
import jakarta.persistence.EntityManager;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RiderBikeContractCommandService {

    private static final Instant OPEN_ENDED_OVERLAP_BOUND = Instant.parse("9999-12-31T23:59:59Z");

    static final String AUTO_INSURANCE_SKIP_TEMPLATE_NOT_OPTED_IN = "TEMPLATE_NOT_OPTED_IN";
    static final String AUTO_INSURANCE_SKIP_DEFAULT_ITEM_MISSING = "DEFAULT_INSURANCE_ITEM_MISSING";
    static final String AUTO_INSURANCE_SKIP_DEFAULT_ITEM_NOT_FOUND = "DEFAULT_INSURANCE_ITEM_NOT_FOUND";
    static final String AUTO_INSURANCE_SKIP_DEFAULT_ITEM_DELETED = "DEFAULT_INSURANCE_ITEM_DELETED";
    static final String AUTO_INSURANCE_SKIP_DEFAULT_ITEM_DISABLED = "DEFAULT_INSURANCE_ITEM_DISABLED";
    static final String AUTO_INSURANCE_SKIP_ALREADY_LINKED = "RIDER_INSURANCE_ALREADY_LINKED";
    static final String AUTO_INSURANCE_SKIP_DUPLICATE_ON_INSERT = "RIDER_INSURANCE_DUPLICATE_ON_INSERT";

    private final RiderBikeContractRepository riderBikeContractRepository;
    private final ContractTemplateRepository contractTemplateRepository;
    private final InsuranceItemRepository insuranceItemRepository;
    private final RiderInsuranceRepository riderInsuranceRepository;
    private final EntityManager entityManager;
    private final AuditLogCommandService auditLogCommandService;

    public RiderBikeContractCommandService(
            RiderBikeContractRepository riderBikeContractRepository,
            ContractTemplateRepository contractTemplateRepository,
            InsuranceItemRepository insuranceItemRepository,
            RiderInsuranceRepository riderInsuranceRepository,
            EntityManager entityManager,
            AuditLogCommandService auditLogCommandService
    ) {
        this.riderBikeContractRepository = riderBikeContractRepository;
        this.contractTemplateRepository = contractTemplateRepository;
        this.insuranceItemRepository = insuranceItemRepository;
        this.riderInsuranceRepository = riderInsuranceRepository;
        this.entityManager = entityManager;
        this.auditLogCommandService = auditLogCommandService;
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
                request.memo(),
                request.serviceType()
        );
        RiderBikeContract saved = riderBikeContractRepository.save(contract);
        entityManager.flush();
        entityManager.refresh(saved);

        AutoInsuranceOutcome outcome = tryAutoIssueInsurance(saved, template);
        auditLogCommandService.log("CONTRACT", saved.getId(), "__created__", null, "riderId=" + saved.getRiderId() + " bikeId=" + saved.getBikeId());
        return RiderBikeContractReadResponse.from(saved, outcome.riderInsuranceId(), outcome.skipReason());
    }

    @Transactional
    public RiderBikeContractReadResponse update(UUID id, RiderBikeContractUpdateRequest request) {
        RiderBikeContract contract = findActiveContract(id);
        contract.updateMemo(request.memo());
        entityManager.flush();
        auditLogCommandService.log("CONTRACT", contract.getId(), "__updated__", null, "riderId=" + contract.getRiderId() + " bikeId=" + contract.getBikeId());
        return RiderBikeContractReadResponse.from(contract);
    }

    @Transactional
    public RiderBikeContractReadResponse terminate(UUID id, RiderBikeContractTerminateRequest request) {
        RiderBikeContract contract = findActiveContract(id);
        assertContractCanTerminate(contract, request.terminatedAt());
        contract.terminate(request.terminatedAt(), request.terminatedReason());
        entityManager.flush();
        auditLogCommandService.log("CONTRACT", contract.getId(), "__terminated__", "riderId=" + contract.getRiderId() + " bikeId=" + contract.getBikeId(), null);
        return RiderBikeContractReadResponse.from(contract);
    }

    /**
     * Resolve the contract template's automatic-insurance pointer and, when
     * everything lines up, create a matching {@link RiderInsurance} row in the
     * same transaction. Each early return carries a short SKIP token so the
     * response can explain *why* the package didn't auto-issue without the
     * service throwing — failing the contract for an insurance-side problem
     * would surprise the operator.
     */
    private AutoInsuranceOutcome tryAutoIssueInsurance(RiderBikeContract contract, ContractTemplate template) {
        if (!template.isIncludesInsurance()) {
            return AutoInsuranceOutcome.skip(AUTO_INSURANCE_SKIP_TEMPLATE_NOT_OPTED_IN);
        }
        UUID defaultInsuranceItemId = template.getDefaultInsuranceItemId();
        if (defaultInsuranceItemId == null) {
            return AutoInsuranceOutcome.skip(AUTO_INSURANCE_SKIP_DEFAULT_ITEM_MISSING);
        }
        InsuranceItem item = insuranceItemRepository.findById(defaultInsuranceItemId).orElse(null);
        if (item == null) {
            return AutoInsuranceOutcome.skip(AUTO_INSURANCE_SKIP_DEFAULT_ITEM_NOT_FOUND);
        }
        if (item.isDeleted()) {
            return AutoInsuranceOutcome.skip(AUTO_INSURANCE_SKIP_DEFAULT_ITEM_DELETED);
        }
        if (!item.isEnabled()) {
            return AutoInsuranceOutcome.skip(AUTO_INSURANCE_SKIP_DEFAULT_ITEM_DISABLED);
        }
        if (riderInsuranceRepository.existsByRiderIdAndInsuranceItemIdAndDeletedAtIsNull(
                contract.getRiderId(), defaultInsuranceItemId)) {
            return AutoInsuranceOutcome.skip(AUTO_INSURANCE_SKIP_ALREADY_LINKED);
        }

        RiderInsurance auto = RiderInsurance.create(
                contract.getRiderId(),
                defaultInsuranceItemId,
                "Auto-issued from contract template " + template.getName(),
                Boolean.TRUE,
                contract.getStartAt(),
                contract.getEndAt(),
                contract.getId()
        );
        try {
            RiderInsurance saved = riderInsuranceRepository.save(auto);
            entityManager.flush();
            entityManager.refresh(saved);
            return AutoInsuranceOutcome.issued(saved.getId());
        } catch (DataIntegrityViolationException exception) {
            // A concurrent caller (or a race between the existsBy… check and
            // the actual insert) raced us to the unique index. Translate to
            // SKIP so the contract still succeeds; the rider already has an
            // active link to the same item, which is the desired end state.
            return AutoInsuranceOutcome.skip(AUTO_INSURANCE_SKIP_DUPLICATE_ON_INSERT);
        }
    }

    private RiderBikeContract findActiveContract(UUID id) {
        return riderBikeContractRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("RiderBikeContract", id));
    }

    private void assertContractCanTerminate(RiderBikeContract contract, Instant terminatedAt) {
        if (contract.getTerminatedAt() != null) {
            throw new InvalidStateTransitionException("Rider-bike contract is already terminated.");
        }
        if (terminatedAt.isBefore(contract.getStartAt())) {
            throw new InvalidStateTransitionException("Rider-bike contract termination time cannot be before start time.");
        }
        if (contract.getEndAt() != null && !terminatedAt.isBefore(contract.getEndAt())) {
            throw new InvalidStateTransitionException("Rider-bike contract termination time must be before finite end time.");
        }
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

    private record AutoInsuranceOutcome(UUID riderInsuranceId, String skipReason) {
        static AutoInsuranceOutcome issued(UUID riderInsuranceId) {
            return new AutoInsuranceOutcome(riderInsuranceId, null);
        }

        static AutoInsuranceOutcome skip(String reason) {
            return new AutoInsuranceOutcome(null, reason);
        }
    }
}
