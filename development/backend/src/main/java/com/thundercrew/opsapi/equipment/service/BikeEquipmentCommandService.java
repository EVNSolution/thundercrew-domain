package com.thundercrew.opsapi.equipment.service;

import com.thundercrew.opsapi.bike.repository.BikeRepository;
import com.thundercrew.opsapi.common.api.DuplicateActiveResourceException;
import com.thundercrew.opsapi.common.api.InvalidStateTransitionException;
import com.thundercrew.opsapi.common.api.ReferenceDeletedException;
import com.thundercrew.opsapi.common.api.ReferenceNotFoundException;
import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import com.thundercrew.opsapi.equipment.domain.BikeEquipment;
import com.thundercrew.opsapi.equipment.domain.EquipmentType;
import com.thundercrew.opsapi.equipment.dto.BikeEquipmentCreateRequest;
import com.thundercrew.opsapi.equipment.dto.BikeEquipmentReadResponse;
import com.thundercrew.opsapi.equipment.dto.BikeEquipmentRemoveRequest;
import com.thundercrew.opsapi.equipment.dto.BikeEquipmentUpdateRequest;
import com.thundercrew.opsapi.equipment.repository.BikeEquipmentRepository;
import com.thundercrew.opsapi.equipment.repository.EquipmentTypeRepository;
import jakarta.persistence.EntityManager;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class BikeEquipmentCommandService {

    private final BikeEquipmentRepository bikeEquipmentRepository;
    private final BikeRepository bikeRepository;
    private final EquipmentTypeRepository equipmentTypeRepository;
    private final EntityManager entityManager;
    private final Clock clock;

    public BikeEquipmentCommandService(
            BikeEquipmentRepository bikeEquipmentRepository,
            BikeRepository bikeRepository,
            EquipmentTypeRepository equipmentTypeRepository,
            EntityManager entityManager,
            Clock clock
    ) {
        this.bikeEquipmentRepository = bikeEquipmentRepository;
        this.bikeRepository = bikeRepository;
        this.equipmentTypeRepository = equipmentTypeRepository;
        this.entityManager = entityManager;
        this.clock = clock;
    }

    @Transactional
    public BikeEquipmentReadResponse create(BikeEquipmentCreateRequest request) {
        assertActiveBikeReference(request.bikeId());
        findEnabledEquipmentTypeReference(request.equipmentTypeId());
        assertSerialNumberIsNotDuplicated(request.serialNumber());

        BikeEquipment equipment = BikeEquipment.create(
                request.bikeId(),
                request.equipmentTypeId(),
                request.equipmentLabel(),
                request.modelName(),
                request.serialNumber(),
                request.installedAt(),
                request.managementDueDate(),
                request.managementNote(),
                request.memo()
        );
        try {
            BikeEquipment saved = bikeEquipmentRepository.save(equipment);
            entityManager.flush();
            entityManager.refresh(saved);
            return BikeEquipmentReadResponse.from(saved, LocalDate.now(clock));
        } catch (DataIntegrityViolationException exception) {
            throw new DuplicateActiveResourceException("BikeEquipment", "serialNumber");
        }
    }

    @Transactional
    public BikeEquipmentReadResponse update(UUID id, BikeEquipmentUpdateRequest request) {
        BikeEquipment equipment = bikeEquipmentRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("BikeEquipment", id));
        if (equipment.getRemovedAt() != null) {
            throw new InvalidStateTransitionException("Bike equipment is already removed.");
        }
        if (StringUtils.hasText(request.serialNumber())
                && bikeEquipmentRepository.existsBySerialNumberAndIdNotAndRemovedAtIsNullAndDeletedAtIsNull(request.serialNumber(), id)) {
            throw new DuplicateActiveResourceException("BikeEquipment", "serialNumber");
        }
        try {
            equipment.updateOperatorManagedFields(
                    request.equipmentLabel(),
                    request.modelName(),
                    request.serialNumber(),
                    request.managementDueDate(),
                    request.managementNote(),
                    request.memo()
            );
            entityManager.flush();
            return BikeEquipmentReadResponse.from(equipment, LocalDate.now(clock));
        } catch (DataIntegrityViolationException exception) {
            throw new DuplicateActiveResourceException("BikeEquipment", "serialNumber");
        }
    }

    @Transactional
    public BikeEquipmentReadResponse remove(UUID id, BikeEquipmentRemoveRequest request) {
        BikeEquipment equipment = bikeEquipmentRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("BikeEquipment", id));
        if (equipment.getRemovedAt() != null) {
            throw new InvalidStateTransitionException("Bike equipment is already removed.");
        }
        Instant removedAt = request.removedAt() == null ? Instant.now(clock) : request.removedAt();
        assertRemovalTimeIsValid(equipment, removedAt);
        equipment.remove(removedAt, request.memo());
        entityManager.flush();
        return BikeEquipmentReadResponse.from(equipment, LocalDate.now(clock));
    }

    private void assertActiveBikeReference(UUID bikeId) {
        if (bikeRepository.findByIdAndDeletedAtIsNull(bikeId).isPresent()) {
            return;
        }
        if (bikeRepository.existsById(bikeId)) {
            throw new ReferenceDeletedException("Bike", bikeId);
        }
        throw new ReferenceNotFoundException("Bike", bikeId);
    }

    private EquipmentType findEnabledEquipmentTypeReference(UUID equipmentTypeId) {
        EquipmentType type = equipmentTypeRepository.findById(equipmentTypeId)
                .orElseThrow(() -> new ReferenceNotFoundException("EquipmentType", equipmentTypeId));
        if (type.isDeleted()) {
            throw new ReferenceDeletedException("EquipmentType", equipmentTypeId);
        }
        if (!type.isEnabled()) {
            throw new InvalidStateTransitionException("Equipment type is disabled and cannot be attached.");
        }
        return type;
    }

    private void assertSerialNumberIsNotDuplicated(String serialNumber) {
        if (StringUtils.hasText(serialNumber)
                && bikeEquipmentRepository.existsBySerialNumberAndRemovedAtIsNullAndDeletedAtIsNull(serialNumber)) {
            throw new DuplicateActiveResourceException("BikeEquipment", "serialNumber");
        }
    }

    private void assertRemovalTimeIsValid(BikeEquipment equipment, Instant removedAt) {
        if (removedAt.isBefore(equipment.getInstalledAt())) {
            throw new InvalidStateTransitionException("Bike equipment removal time cannot be before installed time.");
        }
    }
}
