package com.thundercrew.opsapi.bike.service;

import com.thundercrew.opsapi.audit.service.AuditLogCommandService;
import com.thundercrew.opsapi.bike.domain.Bike;
import com.thundercrew.opsapi.bike.domain.BikeEngineType;
import com.thundercrew.opsapi.bike.domain.BikePurpose;
import com.thundercrew.opsapi.bike.domain.BikeOperationStatusHistory;
import com.thundercrew.opsapi.bike.domain.BikeServiceType;
import com.thundercrew.opsapi.bike.dto.BikeCreateRequest;
import com.thundercrew.opsapi.bike.dto.BikeOperationStatusChangeRequest;
import com.thundercrew.opsapi.bike.dto.BikeReadResponse;
import com.thundercrew.opsapi.bike.dto.BikeUpdateRequest;
import com.thundercrew.opsapi.bike.repository.BikeOperationStatusHistoryRepository;
import com.thundercrew.opsapi.bike.repository.BikeRepository;
import com.thundercrew.opsapi.contract.domain.RiderBikeContract;
import com.thundercrew.opsapi.contract.repository.RiderBikeContractRepository;
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
    private final RiderBikeContractRepository contractRepository;
    private final EntityManager entityManager;
    private final Clock clock;
    private final AuditLogCommandService auditLogCommandService;

    public BikeCommandService(
            BikeRepository bikeRepository,
            BikeOperationStatusHistoryRepository historyRepository,
            RiderBikeContractRepository contractRepository,
            EntityManager entityManager,
            Clock clock,
            AuditLogCommandService auditLogCommandService
    ) {
        this.bikeRepository = bikeRepository;
        this.historyRepository = historyRepository;
        this.contractRepository = contractRepository;
        this.entityManager = entityManager;
        this.clock = clock;
        this.auditLogCommandService = auditLogCommandService;
    }

    /** 차량의 서비스유형 = 활성계약의 값, 없으면 OTHER. */
    private BikeServiceType serviceTypeOf(UUID bikeId) {
        return contractRepository.findActiveByBikeId(bikeId)
                .map(RiderBikeContract::getServiceType)
                .orElse(BikeServiceType.OTHER);
    }

    @Transactional
    public BikeReadResponse create(BikeCreateRequest request) {
        assertPlateNumberIsNotDuplicated(request.plateNumber());
        String vin = StringUtils.hasText(request.vin()) ? request.vin() : null;
        if (vin != null) {
            assertVinIsNotDuplicated(vin);
        }
        // engineType 미지정 시 ELECTRIC 으로 기본값 — 현재 운영 차종이 모두
        // 전기 이륜차라는 도메인 가정과 일치. ICE 는 명시적으로 골라야 등록.
        BikeEngineType engineType = request.engineType() != null
                ? request.engineType()
                : BikeEngineType.ELECTRIC;
        Bike bike = Bike.create(
                request.plateNumber(),
                vin,
                request.modelName(),
                engineType,
                request.operationStatus(),
                request.memo()
        );
        // 용도 미지정 시 배송용. 현재 운영 차량이 전부 배송용이고, 클린차량은
        // 명시적으로 골라야 등록된다 — engineType 과 같은 방식이다.
        if (request.purpose() != null) { bike.setPurpose(request.purpose()); }
        if (StringUtils.hasText(request.imei())) { bike.setImei(request.imei()); }
        if (StringUtils.hasText(request.terminalId())) { bike.setTerminalId(request.terminalId()); }
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
            auditLogCommandService.log("BIKE", saved.getId(), "__created__", null, saved.getPlateNumber());
            return BikeReadResponse.from(saved, serviceTypeOf(saved.getId()));
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
        BikePurpose previousPurpose = bike.getPurpose();
        try {
            bike.updateBasicProfile(
                    request.plateNumber(),
                    request.vin(),
                    request.modelName(),
                    request.engineType(),
                    request.memo()
            );
            if (request.imei() != null) { bike.setImei(request.imei().isBlank() ? null : request.imei()); }
            if (request.terminalId() != null) { bike.setTerminalId(request.terminalId().isBlank() ? null : request.terminalId()); }
            // 용도 변경은 항목별로 남긴다. 차량이 한쪽 목록에서 사라지는 변경이므로
            // "__updated__" 한 줄로는 무엇이 바뀌었는지 추적할 수 없다.
            if (request.purpose() != null && request.purpose() != previousPurpose) {
                bike.setPurpose(request.purpose());
                auditLogCommandService.log(
                        "BIKE", bike.getId(), "purpose", previousPurpose.name(), request.purpose().name());
            }
            entityManager.flush();
            auditLogCommandService.log("BIKE", bike.getId(), "__updated__", null, bike.getPlateNumber());
            return BikeReadResponse.from(bike, serviceTypeOf(bike.getId()));
        } catch (DataIntegrityViolationException exception) {
            throw new DuplicateActiveResourceException("Bike", "plateNumberOrVin");
        }
    }

    @Transactional
    public BikeReadResponse changeOperationStatus(UUID id, BikeOperationStatusChangeRequest request) {
        Bike bike = bikeRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("Bike", id));
        if (bike.getOperationStatus() == request.operationStatus()) {
            return BikeReadResponse.from(bike, serviceTypeOf(bike.getId()));
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
        return BikeReadResponse.from(bike, serviceTypeOf(bike.getId()));
    }

    @Transactional
    public BikeReadResponse setIgnitionBlocked(UUID id, boolean blocked) {
        Bike bike = bikeRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("Bike", id));
        bike.setIgnitionBlocked(blocked);
        entityManager.flush();
        return BikeReadResponse.from(bike, serviceTypeOf(bike.getId()));
    }

    @Transactional
    public void softDelete(UUID id) {
        Bike bike = bikeRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("Bike", id));
        assertNoActiveDependentRecords(id);
        bike.markDeleted(null, clock.instant());
        historyRepository.findFirstByBikeIdAndEndedAtIsNullAndDeletedAtIsNull(id)
                .ifPresent(history -> history.closeAt(clock.instant()));
        auditLogCommandService.log("BIKE", id, "__deleted__", bike.getPlateNumber(), null);
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
