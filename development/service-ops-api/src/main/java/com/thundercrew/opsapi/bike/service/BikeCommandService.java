package com.thundercrew.opsapi.bike.service;

import com.thundercrew.opsapi.bike.domain.Bike;
import com.thundercrew.opsapi.bike.domain.BikeOperationStatusHistory;
import com.thundercrew.opsapi.bike.dto.BikeCreateRequest;
import com.thundercrew.opsapi.bike.dto.BikeOperationStatusChangeRequest;
import com.thundercrew.opsapi.bike.dto.BikeReadResponse;
import com.thundercrew.opsapi.bike.dto.BikeUpdateRequest;
import com.thundercrew.opsapi.bike.repository.BikeOperationStatusHistoryRepository;
import com.thundercrew.opsapi.bike.repository.BikeRepository;
import com.thundercrew.opsapi.common.api.DuplicateActiveResourceException;
import com.thundercrew.opsapi.common.api.InvalidStateTransitionException;
import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import jakarta.persistence.EntityManager;
import java.time.Clock;
import java.time.Instant;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class BikeCommandService {

    private final BikeRepository bikeRepository;
    private final BikeOperationStatusHistoryRepository historyRepository;
    private final EntityManager entityManager;
    private final Clock clock;

    public BikeCommandService(
            BikeRepository bikeRepository,
            BikeOperationStatusHistoryRepository historyRepository,
            EntityManager entityManager,
            Clock clock
    ) {
        this.bikeRepository = bikeRepository;
        this.historyRepository = historyRepository;
        this.entityManager = entityManager;
        this.clock = clock;
    }

    @Transactional
    public BikeReadResponse create(BikeCreateRequest request) {
        assertPlateNumberIsNotDuplicated(request.plateNumber());
        assertVinIsNotDuplicated(request.vin());
        Bike bike = Bike.create(
                request.plateNumber(),
                request.vin(),
                request.modelName(),
                request.operationStatus(),
                request.memo()
        );
        try {
            Bike saved = bikeRepository.save(bike);
            historyRepository.save(BikeOperationStatusHistory.open(
                    saved.getId(),
                    request.operationStatus(),
                    Instant.now(clock),
                    "INITIAL_STATUS",
                    "Bike created with initial operation status.",
                    null
            ));
            entityManager.flush();
            entityManager.refresh(saved);
            return BikeReadResponse.from(saved);
        } catch (DataIntegrityViolationException exception) {
            throw new DuplicateActiveResourceException("Bike", "plateNumberOrVin");
        }
    }

    @Transactional
    public BikeReadResponse update(UUID id, BikeUpdateRequest request) {
        Bike bike = bikeRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("Bike", id));
        if (StringUtils.hasText(request.plateNumber())
                && bikeRepository.existsByPlateNumberAndIdNotAndDeletedAtIsNull(request.plateNumber(), id)) {
            throw new DuplicateActiveResourceException("Bike", "plateNumber");
        }
        if (StringUtils.hasText(request.vin())
                && bikeRepository.existsByVinAndIdNotAndDeletedAtIsNull(request.vin(), id)) {
            throw new DuplicateActiveResourceException("Bike", "vin");
        }
        try {
            bike.updateBasicProfile(
                    request.plateNumber(),
                    request.vin(),
                    request.modelName(),
                    request.memo()
            );
            entityManager.flush();
            return BikeReadResponse.from(bike);
        } catch (DataIntegrityViolationException exception) {
            throw new DuplicateActiveResourceException("Bike", "plateNumberOrVin");
        }
    }

    @Transactional
    public BikeReadResponse changeOperationStatus(UUID id, BikeOperationStatusChangeRequest request) {
        Bike bike = bikeRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("Bike", id));
        if (bike.getOperationStatus() == request.operationStatus()) {
            return BikeReadResponse.from(bike);
        }
        Instant changedAt = Instant.now(clock);
        historyRepository.findFirstByBikeIdAndEndedAtIsNullAndDeletedAtIsNull(id)
                .ifPresent(history -> {
                    history.closeAt(changedAt);
                    entityManager.flush();
                });
        bike.changeOperationStatus(request.operationStatus());
        historyRepository.save(BikeOperationStatusHistory.open(
                id,
                request.operationStatus(),
                changedAt,
                request.reason(),
                request.memo(),
                null
        ));
        entityManager.flush();
        return BikeReadResponse.from(bike);
    }

    @Transactional
    public void softDelete(UUID id) {
        Bike bike = bikeRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("Bike", id));
        assertNoActiveDependentRecords(id);
        bike.markDeleted(null, clock.instant());
        historyRepository.findFirstByBikeIdAndEndedAtIsNullAndDeletedAtIsNull(id)
                .ifPresent(history -> history.closeAt(clock.instant()));
    }

    private void assertPlateNumberIsNotDuplicated(String plateNumber) {
        if (bikeRepository.existsByPlateNumberAndDeletedAtIsNull(plateNumber)) {
            throw new DuplicateActiveResourceException("Bike", "plateNumber");
        }
    }

    private void assertVinIsNotDuplicated(String vin) {
        if (bikeRepository.existsByVinAndDeletedAtIsNull(vin)) {
            throw new DuplicateActiveResourceException("Bike", "vin");
        }
    }

    private void assertNoActiveDependentRecords(UUID id) {
        if (bikeRepository.existsActiveContractReference(id)) {
            throw new InvalidStateTransitionException(
                    "Bike has an active rider-bike contract and cannot be deleted."
            );
        }
        if (bikeRepository.existsActiveEquipmentReference(id)) {
            throw new InvalidStateTransitionException(
                    "Bike has active equipment and cannot be deleted."
            );
        }
        if (bikeRepository.existsActiveDeviceInstallationReference(id)) {
            throw new InvalidStateTransitionException(
                    "Bike has an active device installation and cannot be deleted."
            );
        }
    }
}
