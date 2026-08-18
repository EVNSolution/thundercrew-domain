package com.thundercrew.opsapi.rider.service;

import com.thundercrew.opsapi.audit.service.AuditLogCommandService;
import com.thundercrew.opsapi.common.api.DuplicateActiveResourceException;
import com.thundercrew.opsapi.common.api.InvalidStateTransitionException;
import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import com.thundercrew.opsapi.common.util.PhoneNumbers;
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
    private final AuditLogCommandService auditLogCommandService;

    public RiderCommandService(RiderRepository riderRepository, EntityManager entityManager, Clock clock, AuditLogCommandService auditLogCommandService) {
        this.riderRepository = riderRepository;
        this.entityManager = entityManager;
        this.clock = clock;
        this.auditLogCommandService = auditLogCommandService;
    }

    @Transactional
    public RiderReadResponse create(RiderCreateRequest request) {
        String phoneNumber = PhoneNumbers.format(request.phoneNumber());
        assertPhoneIsNotDuplicated(phoneNumber);
        Rider rider = Rider.create(
                request.name(),
                phoneNumber,
                request.teamName(),
                request.areaName(),
                request.memo()
        );
        try {
            Rider saved = riderRepository.save(rider);
            entityManager.flush();
            entityManager.refresh(saved);
            auditLogCommandService.log("RIDER", saved.getId(), "__created__", null, saved.getName());
            return RiderReadResponse.from(saved);
        } catch (DataIntegrityViolationException exception) {
            throw new DuplicateActiveResourceException("Rider", "phoneNumber");
        }
    }

    @Transactional
    public RiderReadResponse update(UUID id, RiderUpdateRequest request) {
        Rider rider = riderRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("Rider", id));
        String phoneNumber = PhoneNumbers.format(request.phoneNumber());
        if (StringUtils.hasText(phoneNumber)
                && riderRepository.existsByPhoneNumberAndIdNotAndDeletedAtIsNull(phoneNumber, id)) {
            throw new DuplicateActiveResourceException("Rider", "phoneNumber");
        }
        try {
            rider.updateBasicProfile(
                    request.name(),
                    phoneNumber,
                    request.teamName(),
                    request.areaName(),
                    request.memo(),
                    request.primaryInsurance(),
                    request.addonInsurance()
            );
            // 직무 변경은 항목별로 남긴다. 용도 변경과 같은 이유다 — 사람이 한쪽
            // 목록에서 사라지는 변경이라 "__updated__" 로는 추적할 수 없다.
            if (request.role() != null && request.role() != rider.getRole()) {
                auditLogCommandService.log(
                        "RIDER", rider.getId(), "role", rider.getRole().name(), request.role().name());
                rider.setRole(request.role());
            }
            // 숙련도는 null 을 "판단하지 않음" 으로 쓰므로, null 로 되돌리는 것도
            // 의미 있는 변경이다. 다만 이 API 에서 부분 갱신과 구분할 수 없어
            // 값이 온 경우만 반영한다. 비우려면 별도 동작이 필요하다.
            if (request.skillLevel() != null && request.skillLevel() != rider.getSkillLevel()) {
                rider.setSkillLevel(request.skillLevel());
            }
            entityManager.flush();
            auditLogCommandService.log("RIDER", rider.getId(), "__updated__", null, rider.getName());
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
        auditLogCommandService.log("RIDER", id, "__deleted__", rider.getName(), null);
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
