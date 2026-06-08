package com.thundercrew.opsapi.testmatching.vehicle.service;

import com.thundercrew.opsapi.common.api.DuplicateActiveResourceException;
import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import com.thundercrew.opsapi.testmatching.vehicle.domain.TestVehicle;
import com.thundercrew.opsapi.testmatching.vehicle.dto.TestVehicleCreateRequest;
import com.thundercrew.opsapi.testmatching.vehicle.dto.TestVehicleReadResponse;
import com.thundercrew.opsapi.testmatching.vehicle.repository.TestVehicleRepository;
import jakarta.persistence.EntityManager;
import java.time.Clock;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TestVehicleCommandService {

    private final TestVehicleRepository repository;
    private final EntityManager entityManager;
    private final Clock clock;

    public TestVehicleCommandService(TestVehicleRepository repository, EntityManager entityManager, Clock clock) {
        this.repository = repository;
        this.entityManager = entityManager;
        this.clock = clock;
    }

    @Transactional
    public TestVehicleReadResponse create(TestVehicleCreateRequest request) {
        if (repository.existsByPlateNumberAndDeletedAtIsNull(request.plateNumber())) {
            throw new DuplicateActiveResourceException("TestVehicle", "plateNumber");
        }
        String imei = (request.imei() != null && !request.imei().isBlank()) ? request.imei() : null;
        TestVehicle saved = repository.save(
                TestVehicle.create(request.plateNumber(), request.bikeType(), request.engineType(), imei));
        try {
            entityManager.flush();
            entityManager.refresh(saved);
        } catch (DataIntegrityViolationException e) {
            throw new DuplicateActiveResourceException("TestVehicle", "plateNumber");
        }
        return TestVehicleReadResponse.from(saved);
    }

    @Transactional
    public void delete(UUID id) {
        TestVehicle vehicle = repository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("TestVehicle", id));
        vehicle.markDeleted(null, clock.instant());
    }
}
