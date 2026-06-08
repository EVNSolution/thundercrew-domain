package com.thundercrew.opsapi.testmatching.rider.service;

import com.thundercrew.opsapi.common.api.DuplicateActiveResourceException;
import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import com.thundercrew.opsapi.testmatching.rider.domain.TestRider;
import com.thundercrew.opsapi.testmatching.rider.dto.TestRiderCreateRequest;
import com.thundercrew.opsapi.testmatching.rider.dto.TestRiderReadResponse;
import com.thundercrew.opsapi.testmatching.rider.repository.TestRiderRepository;
import jakarta.persistence.EntityManager;
import java.time.Clock;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TestRiderCommandService {

    private final TestRiderRepository repository;
    private final EntityManager entityManager;
    private final Clock clock;

    public TestRiderCommandService(TestRiderRepository repository, EntityManager entityManager, Clock clock) {
        this.repository = repository;
        this.entityManager = entityManager;
        this.clock = clock;
    }

    @Transactional
    public TestRiderReadResponse create(TestRiderCreateRequest request) {
        if (repository.existsByPhoneNumberAndDeletedAtIsNull(request.phoneNumber())) {
            throw new DuplicateActiveResourceException("TestRider", "phoneNumber");
        }
        String teamName = (request.teamName() != null && !request.teamName().isBlank())
                ? request.teamName() : null;
        TestRider saved = repository.save(
                TestRider.create(request.name(), request.phoneNumber(),
                        Boolean.TRUE.equals(request.trainingCompleted()), teamName));
        try {
            entityManager.flush();
            entityManager.refresh(saved);
        } catch (DataIntegrityViolationException e) {
            throw new DuplicateActiveResourceException("TestRider", "phoneNumber");
        }
        return TestRiderReadResponse.from(saved);
    }

    @Transactional
    public void delete(UUID id) {
        TestRider rider = repository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("TestRider", id));
        rider.markDeleted(null, clock.instant());
    }
}
