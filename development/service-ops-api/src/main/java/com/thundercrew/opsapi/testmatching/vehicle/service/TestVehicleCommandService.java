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

    private final TestVehicleRepository repo;
    private final EntityManager em;
    private final Clock clock;

    public TestVehicleCommandService(TestVehicleRepository repo, EntityManager em, Clock clock) {
        this.repo = repo;
        this.em = em;
        this.clock = clock;
    }

    @Transactional
    public TestVehicleReadResponse create(TestVehicleCreateRequest request) {
        if (repo.existsByPlateNumberAndDeletedAtIsNull(request.plateNumber())) {
            throw new DuplicateActiveResourceException("TestVehicle", "plateNumber");
        }
        String imei = (request.imei() != null && !request.imei().isBlank()) ? request.imei() : null;
        TestVehicle saved = repo.save(
                TestVehicle.create(request.plateNumber(), request.bikeType(), request.engineType(), imei));
        try {
            em.flush();
            em.refresh(saved);
        } catch (DataIntegrityViolationException e) {
            throw new DuplicateActiveResourceException("TestVehicle", "plateNumber");
        }
        return TestVehicleReadResponse.from(saved);
    }

    @Transactional
    public void delete(UUID id) {
        TestVehicle v = repo.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("TestVehicle", id));
        v.markDeleted(null, clock.instant());
    }
}
