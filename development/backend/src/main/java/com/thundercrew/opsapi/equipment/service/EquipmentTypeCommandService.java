package com.thundercrew.opsapi.equipment.service;

import com.thundercrew.opsapi.common.api.DuplicateActiveResourceException;
import com.thundercrew.opsapi.common.api.InvalidStateTransitionException;
import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import com.thundercrew.opsapi.equipment.domain.EquipmentType;
import com.thundercrew.opsapi.equipment.dto.EquipmentTypeCreateRequest;
import com.thundercrew.opsapi.equipment.dto.EquipmentTypeReadResponse;
import com.thundercrew.opsapi.equipment.dto.EquipmentTypeUpdateRequest;
import com.thundercrew.opsapi.equipment.repository.BikeEquipmentRepository;
import com.thundercrew.opsapi.equipment.repository.EquipmentTypeRepository;
import jakarta.persistence.EntityManager;
import java.time.Clock;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class EquipmentTypeCommandService {

    private final EquipmentTypeRepository equipmentTypeRepository;
    private final BikeEquipmentRepository bikeEquipmentRepository;
    private final EntityManager entityManager;
    private final Clock clock;

    public EquipmentTypeCommandService(
            EquipmentTypeRepository equipmentTypeRepository,
            BikeEquipmentRepository bikeEquipmentRepository,
            EntityManager entityManager,
            Clock clock
    ) {
        this.equipmentTypeRepository = equipmentTypeRepository;
        this.bikeEquipmentRepository = bikeEquipmentRepository;
        this.entityManager = entityManager;
        this.clock = clock;
    }

    @Transactional
    public EquipmentTypeReadResponse create(EquipmentTypeCreateRequest request) {
        assertNameIsNotDuplicated(request.name());
        EquipmentType type = EquipmentType.create(
                request.name(),
                request.description(),
                request.enabled()
        );
        try {
            EquipmentType saved = equipmentTypeRepository.save(type);
            entityManager.flush();
            entityManager.refresh(saved);
            return EquipmentTypeReadResponse.from(saved);
        } catch (DataIntegrityViolationException exception) {
            throw new DuplicateActiveResourceException("EquipmentType", "name");
        }
    }

    @Transactional
    public EquipmentTypeReadResponse update(UUID id, EquipmentTypeUpdateRequest request) {
        EquipmentType type = equipmentTypeRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("EquipmentType", id));
        if (StringUtils.hasText(request.name())
                && equipmentTypeRepository.existsByNameAndIdNotAndDeletedAtIsNull(request.name(), id)) {
            throw new DuplicateActiveResourceException("EquipmentType", "name");
        }
        try {
            type.updateOperatorManagedFields(
                    request.name(),
                    request.description(),
                    request.enabled()
            );
            entityManager.flush();
            return EquipmentTypeReadResponse.from(type);
        } catch (DataIntegrityViolationException exception) {
            throw new DuplicateActiveResourceException("EquipmentType", "name");
        }
    }

    @Transactional
    public void softDelete(UUID id) {
        EquipmentType type = equipmentTypeRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("EquipmentType", id));
        if (bikeEquipmentRepository.existsByEquipmentTypeIdAndRemovedAtIsNullAndDeletedAtIsNull(id)) {
            throw new InvalidStateTransitionException(
                    "Equipment type cannot be deleted while active bike equipment references it."
            );
        }
        type.disableAndMarkDeleted(null, clock.instant());
    }

    private void assertNameIsNotDuplicated(String name) {
        if (equipmentTypeRepository.existsByNameAndDeletedAtIsNull(name)) {
            throw new DuplicateActiveResourceException("EquipmentType", "name");
        }
    }
}
