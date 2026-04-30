package com.thundercrew.opsapi.rider.service;

import com.thundercrew.opsapi.common.api.DuplicateActiveResourceException;
import com.thundercrew.opsapi.common.api.InvalidStateTransitionException;
import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import com.thundercrew.opsapi.rider.domain.Rider;
import com.thundercrew.opsapi.rider.dto.RiderAppAccountLinkRequest;
import com.thundercrew.opsapi.rider.dto.RiderCreateRequest;
import com.thundercrew.opsapi.rider.dto.RiderReadResponse;
import com.thundercrew.opsapi.rider.dto.RiderUpdateRequest;
import com.thundercrew.opsapi.rider.repository.RiderRepository;
import jakarta.persistence.EntityManager;
import org.springframework.dao.DataIntegrityViolationException;
import java.time.Clock;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class RiderCommandService {

    private final RiderRepository riderRepository;
    private final EntityManager entityManager;
    private final Clock clock;

    public RiderCommandService(RiderRepository riderRepository, EntityManager entityManager, Clock clock) {
        this.riderRepository = riderRepository;
        this.entityManager = entityManager;
        this.clock = clock;
    }

    @Transactional
    public RiderReadResponse create(RiderCreateRequest request) {
        assertPhoneIsNotDuplicated(request.phoneNumber());
        Rider rider = Rider.create(
                request.name(),
                request.phoneNumber(),
                request.teamName(),
                request.areaName(),
                request.memo()
        );
        try {
            Rider saved = riderRepository.save(rider);
            entityManager.flush();
            entityManager.refresh(saved);
            return RiderReadResponse.from(saved);
        } catch (DataIntegrityViolationException exception) {
            throw new DuplicateActiveResourceException("Rider", "phoneNumber");
        }
    }

    @Transactional
    public RiderReadResponse update(UUID id, RiderUpdateRequest request) {
        Rider rider = riderRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("Rider", id));
        if (StringUtils.hasText(request.phoneNumber())
                && riderRepository.existsByPhoneNumberAndIdNotAndDeletedAtIsNull(request.phoneNumber(), id)) {
            throw new DuplicateActiveResourceException("Rider", "phoneNumber");
        }
        try {
            rider.updateBasicProfile(
                    request.name(),
                    request.phoneNumber(),
                    request.teamName(),
                    request.areaName(),
                    request.memo()
            );
            entityManager.flush();
            return RiderReadResponse.from(rider);
        } catch (DataIntegrityViolationException exception) {
            throw new DuplicateActiveResourceException("Rider", "phoneNumber");
        }
    }

    @Transactional
    public void softDelete(UUID id) {
        Rider rider = riderRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("Rider", id));
        assertNoActiveDependentRecords(id);
        rider.markDeleted(null, clock.instant());
    }

    @Transactional
    public RiderReadResponse linkAppAccount(UUID id, RiderAppAccountLinkRequest request) {
        Rider rider = riderRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("Rider", id));
        if (rider.isAppAccountLinked() && Objects.equals(rider.getAppAccountId(), request.appAccountId())) {
            return RiderReadResponse.from(rider);
        }
        if (rider.isAppAccountLinked()) {
            throw new InvalidStateTransitionException(
                    "Rider is already linked to another app account. Unlink before linking a new account."
            );
        }
        if (riderRepository.existsByAppAccountIdAndIdNotAndDeletedAtIsNull(request.appAccountId(), id)) {
            throw new DuplicateActiveResourceException("Rider", "appAccountId");
        }
        try {
            rider.linkAppAccount(request.appAccountId(), clock.instant());
            entityManager.flush();
            return RiderReadResponse.from(rider);
        } catch (DataIntegrityViolationException exception) {
            throw new DuplicateActiveResourceException("Rider", "appAccountId");
        }
    }

    @Transactional
    public RiderReadResponse unlinkAppAccount(UUID id) {
        Rider rider = riderRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("Rider", id));
        rider.unlinkAppAccount();
        entityManager.flush();
        return RiderReadResponse.from(rider);
    }

    private void assertPhoneIsNotDuplicated(String phoneNumber) {
        if (riderRepository.existsByPhoneNumberAndDeletedAtIsNull(phoneNumber)) {
            throw new DuplicateActiveResourceException("Rider", "phoneNumber");
        }
    }

    private void assertNoActiveDependentRecords(UUID id) {
        if (riderRepository.existsActiveContractReference(id)) {
            throw new InvalidStateTransitionException(
                    "Rider has an active bike contract and cannot be deleted."
            );
        }
        if (riderRepository.existsActiveInsuranceReference(id)) {
            throw new InvalidStateTransitionException(
                    "Rider has an active insurance assignment and cannot be deleted."
            );
        }
    }
}
