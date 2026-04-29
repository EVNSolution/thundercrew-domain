package com.thundercrew.opsapi.contract.service;

import com.thundercrew.opsapi.common.api.DuplicateActiveResourceException;
import com.thundercrew.opsapi.common.api.InvalidStateTransitionException;
import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import com.thundercrew.opsapi.contract.domain.ContractTemplate;
import com.thundercrew.opsapi.contract.dto.ContractTemplateCreateRequest;
import com.thundercrew.opsapi.contract.dto.ContractTemplateReadResponse;
import com.thundercrew.opsapi.contract.dto.ContractTemplateUpdateRequest;
import com.thundercrew.opsapi.contract.repository.ContractTemplateRepository;
import jakarta.persistence.EntityManager;
import java.time.Clock;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class ContractTemplateCommandService {

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
        ContractTemplate template = ContractTemplate.create(
                request.name(),
                request.durationMinutes(),
                request.description(),
                request.enabled()
        );
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
        try {
            template.updateAdminManagedFields(
                    request.name(),
                    request.durationMinutesProvided(),
                    request.durationMinutes(),
                    request.description(),
                    request.enabled()
            );
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
}
