package com.thundercrew.opsapi.contract.service;

import com.thundercrew.opsapi.common.api.DuplicateActiveResourceException;
import com.thundercrew.opsapi.common.api.InvalidStateTransitionException;
import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import com.thundercrew.opsapi.contract.domain.ContractCategory;
import com.thundercrew.opsapi.contract.domain.ContractDurationUnit;
import com.thundercrew.opsapi.contract.domain.ContractReturnType;
import com.thundercrew.opsapi.contract.domain.ContractTemplate;
import com.thundercrew.opsapi.contract.dto.ContractTemplateCreateRequest;
import com.thundercrew.opsapi.contract.dto.ContractTemplateReadResponse;
import com.thundercrew.opsapi.contract.dto.ContractTemplateUpdateRequest;
import com.thundercrew.opsapi.contract.repository.ContractTemplateRepository;
import jakarta.persistence.EntityManager;
import java.time.Clock;
import java.util.EnumSet;
import java.util.Set;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class ContractTemplateCommandService {

    private static final Set<ContractDurationUnit> RENTAL_ALLOWED_UNITS = EnumSet.of(
            ContractDurationUnit.DAY,
            ContractDurationUnit.WEEK,
            ContractDurationUnit.MONTH,
            ContractDurationUnit.QUARTER,
            ContractDurationUnit.HALF_YEAR
    );

    private final ContractTemplateRepository contractTemplateRepository;
    private final EntityManager entityManager;
    private final Clock clock;

    public ContractTemplateCommandService(
            ContractTemplateRepository contractTemplateRepository,
            EntityManager entityManager,
            Clock clock
    ) {
        this.contractTemplateRepository = contractTemplateRepository;
        this.entityManager = entityManager;
        this.clock = clock;
    }

    @Transactional
    public ContractTemplateReadResponse create(ContractTemplateCreateRequest request) {
        assertNameIsNotDuplicated(request.name());

        boolean structured = request.category() != null
                || request.returnType() != null
                || request.durationUnit() != null
                || request.durationValue() != null
                || request.includesInsurance() != null
                || request.defaultInsuranceItemId() != null;

        ContractTemplate template;
        if (structured) {
            ContractCategory category = request.category() == null
                    ? ContractCategory.CUSTOM
                    : request.category();
            boolean includesInsurance = Boolean.TRUE.equals(request.includesInsurance());
            assertClassificationIsConsistent(
                    category,
                    request.returnType(),
                    request.durationUnit(),
                    request.durationValue(),
                    includesInsurance,
                    request.defaultInsuranceItemId()
            );
            template = ContractTemplate.createStructured(
                    request.name(),
                    request.description(),
                    request.enabled(),
                    category,
                    request.returnType(),
                    request.durationUnit(),
                    request.durationValue(),
                    includesInsurance,
                    request.defaultInsuranceItemId()
            );
        } else {
            template = ContractTemplate.createLegacy(
                    request.name(),
                    request.durationMinutes(),
                    request.description(),
                    request.enabled()
            );
        }

        try {
            ContractTemplate saved = contractTemplateRepository.save(template);
            entityManager.flush();
            entityManager.refresh(saved);
            return ContractTemplateReadResponse.from(saved);
        } catch (DataIntegrityViolationException exception) {
            throw new DuplicateActiveResourceException("ContractTemplate", "name");
        }
    }

    @Transactional
    public ContractTemplateReadResponse update(UUID id, ContractTemplateUpdateRequest request) {
        ContractTemplate template = contractTemplateRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("ContractTemplate", id));
        assertTemplateIsMutable(template);
        if (StringUtils.hasText(request.name())
                && contractTemplateRepository.existsByNameAndIdNotAndDeletedAtIsNull(request.name(), id)) {
            throw new DuplicateActiveResourceException("ContractTemplate", "name");
        }

        boolean structuredTouched = request.category() != null
                || request.returnTypeProvided()
                || request.structuredDurationProvided()
                || request.includesInsurance() != null
                || request.defaultInsuranceItemIdProvided();

        try {
            template.updateBasicFields(request.name(), request.description(), request.enabled());

            if (structuredTouched) {
                ContractCategory effectiveCategory = request.category() != null
                        ? request.category()
                        : template.getCategory();
                ContractReturnType effectiveReturnType = request.returnTypeProvided()
                        ? request.returnType()
                        : template.getReturnType();
                ContractDurationUnit effectiveUnit;
                Integer effectiveValue;
                boolean durationStructuredProvided = request.structuredDurationProvided();
                if (durationStructuredProvided) {
                    effectiveUnit = request.durationUnit();
                    effectiveValue = request.durationValue();
                } else {
                    effectiveUnit = template.getDurationUnit();
                    effectiveValue = template.getDurationValue();
                }
                boolean effectiveIncludesInsurance = request.includesInsurance() != null
                        ? request.includesInsurance()
                        : template.isIncludesInsurance();
                UUID effectiveDefaultInsuranceItemId = request.defaultInsuranceItemIdProvided()
                        ? request.defaultInsuranceItemId()
                        : template.getDefaultInsuranceItemId();

                assertClassificationIsConsistent(
                        effectiveCategory,
                        effectiveReturnType,
                        effectiveUnit,
                        effectiveValue,
                        effectiveIncludesInsurance,
                        effectiveDefaultInsuranceItemId
                );
                template.updateClassification(
                        request.category(),
                        request.returnTypeProvided(),
                        request.returnType(),
                        durationStructuredProvided,
                        request.durationUnit(),
                        request.durationValue(),
                        request.includesInsurance(),
                        request.defaultInsuranceItemIdProvided(),
                        request.defaultInsuranceItemId()
                );
            } else if (request.durationMinutesProvided()) {
                template.applyLegacyDurationMinutes(true, request.durationMinutes());
            }

            entityManager.flush();
            return ContractTemplateReadResponse.from(template);
        } catch (DataIntegrityViolationException exception) {
            throw new DuplicateActiveResourceException("ContractTemplate", "name");
        }
    }

    @Transactional
    public void softDelete(UUID id) {
        ContractTemplate template = contractTemplateRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("ContractTemplate", id));
        assertTemplateIsMutable(template);
        template.disableAndMarkDeleted(null, clock.instant());
    }

    private void assertNameIsNotDuplicated(String name) {
        if (contractTemplateRepository.existsByNameAndDeletedAtIsNull(name)) {
            throw new DuplicateActiveResourceException("ContractTemplate", "name");
        }
    }

    private void assertTemplateIsMutable(ContractTemplate template) {
        if (template.isSystemTemplate()) {
            throw new InvalidStateTransitionException("System contract template cannot be modified or deleted.");
        }
    }

    /**
     * Enforce the per-category combination rules:
     * <ul>
     *   <li>SUBSCRIPTION: returnType required, fixed at MONTH × 12.</li>
     *   <li>RENTAL: returnType required, durationUnit ∈ {DAY, WEEK, MONTH, QUARTER, HALF_YEAR}, durationValue required.</li>
     *   <li>CUSTOM: free-form (every classification field is optional).</li>
     *   <li>includesInsurance=true requires a defaultInsuranceItemId so the package
     *       can resolve a real insurance item (Slice B will introduce that resolver).</li>
     * </ul>
     */
    private void assertClassificationIsConsistent(
            ContractCategory category,
            ContractReturnType returnType,
            ContractDurationUnit durationUnit,
            Integer durationValue,
            boolean includesInsurance,
            UUID defaultInsuranceItemId
    ) {
        if (category == ContractCategory.SUBSCRIPTION) {
            if (returnType == null) {
                throw new InvalidStateTransitionException(
                        "SUBSCRIPTION 카테고리는 returnType (TAKEOVER/RETURN) 이 필요합니다.");
            }
            if (durationUnit != ContractDurationUnit.MONTH || durationValue == null || durationValue != 12) {
                throw new InvalidStateTransitionException(
                        "SUBSCRIPTION 카테고리는 durationUnit=MONTH, durationValue=12 만 허용됩니다.");
            }
        } else if (category == ContractCategory.RENTAL) {
            if (returnType == null) {
                throw new InvalidStateTransitionException(
                        "RENTAL 카테고리는 returnType (TAKEOVER/RETURN) 이 필요합니다.");
            }
            if (durationUnit == null || !RENTAL_ALLOWED_UNITS.contains(durationUnit)) {
                throw new InvalidStateTransitionException(
                        "RENTAL 카테고리는 durationUnit 이 DAY/WEEK/MONTH/QUARTER/HALF_YEAR 중 하나여야 합니다.");
            }
            if (durationValue == null || durationValue <= 0) {
                throw new InvalidStateTransitionException(
                        "RENTAL 카테고리는 양의 durationValue 가 필요합니다.");
            }
        }
        if (includesInsurance && defaultInsuranceItemId == null) {
            throw new InvalidStateTransitionException(
                    "includesInsurance=true 인 템플릿은 defaultInsuranceItemId 가 필요합니다.");
        }
    }
}
