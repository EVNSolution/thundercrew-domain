package com.thundercrew.opsapi.testmatching.matching.service;

import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import com.thundercrew.opsapi.testmatching.matching.domain.TestMatching;
import com.thundercrew.opsapi.testmatching.matching.dto.TestMatchingCreateRequest;
import com.thundercrew.opsapi.testmatching.matching.dto.TestMatchingReadResponse;
import com.thundercrew.opsapi.testmatching.matching.repository.TestMatchingRepository;
import com.thundercrew.opsapi.testmatching.rider.repository.TestRiderRepository;
import com.thundercrew.opsapi.testmatching.vehicle.repository.TestVehicleRepository;
import jakarta.persistence.EntityManager;
import java.time.Clock;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TestMatchingCommandService {

    private final TestMatchingRepository matchingRepository;
    private final TestVehicleRepository vehicleRepository;
    private final TestRiderRepository riderRepository;
    private final TestMatchingReadService readService;
    private final EntityManager entityManager;
    private final Clock clock;

    public TestMatchingCommandService(
            TestMatchingRepository matchingRepository,
            TestVehicleRepository vehicleRepository,
            TestRiderRepository riderRepository,
            TestMatchingReadService readService,
            EntityManager entityManager,
            Clock clock) {
        this.matchingRepository = matchingRepository;
        this.vehicleRepository = vehicleRepository;
        this.riderRepository = riderRepository;
        this.readService = readService;
        this.entityManager = entityManager;
        this.clock = clock;
    }

    @Transactional
    public TestMatchingReadResponse create(TestMatchingCreateRequest request) {
        // Verify vehicle and rider exist (soft-delete aware)
        if (vehicleRepository.findByIdAndDeletedAtIsNull(request.testVehicleId()).isEmpty()) {
            throw new ResourceNotFoundException("TestVehicle", request.testVehicleId());
        }
        if (riderRepository.findByIdAndDeletedAtIsNull(request.testRiderId()).isEmpty()) {
            throw new ResourceNotFoundException("TestRider", request.testRiderId());
        }
        TestMatching saved = matchingRepository.save(TestMatching.create(
                request.testVehicleId(), request.serviceType(), request.testRiderId(),
                request.contractType(), request.handoverType(),
                request.startDate(), request.endDate()));
        entityManager.flush();
        entityManager.refresh(saved);
        return readService.toResponse(saved);
    }

    @Transactional
    public void delete(UUID id) {
        TestMatching matching = matchingRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("TestMatching", id));
        matching.markDeleted(null, clock.instant());
    }
}
