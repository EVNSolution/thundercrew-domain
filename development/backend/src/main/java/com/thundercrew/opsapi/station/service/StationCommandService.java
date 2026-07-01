package com.thundercrew.opsapi.station.service;

import com.thundercrew.opsapi.common.api.DuplicateActiveResourceException;
import com.thundercrew.opsapi.common.api.InvalidStateTransitionException;
import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import com.thundercrew.opsapi.station.domain.BatteryStation;
import com.thundercrew.opsapi.station.domain.StationBatteryCountLog;
import com.thundercrew.opsapi.station.dto.BatteryStationCountUpdateRequest;
import com.thundercrew.opsapi.station.dto.BatteryStationCreateRequest;
import com.thundercrew.opsapi.station.dto.BatteryStationReadResponse;
import com.thundercrew.opsapi.station.dto.BatteryStationUpdateRequest;
import com.thundercrew.opsapi.station.repository.BatteryStationRepository;
import com.thundercrew.opsapi.station.repository.StationBatteryCountLogRepository;
import jakarta.persistence.EntityManager;
import java.time.Clock;
import java.time.Instant;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class StationCommandService {

    private final BatteryStationRepository batteryStationRepository;
    private final StationBatteryCountLogRepository countLogRepository;
    private final EntityManager entityManager;
    private final Clock clock;

    public StationCommandService(
            BatteryStationRepository batteryStationRepository,
            StationBatteryCountLogRepository countLogRepository,
            EntityManager entityManager,
            Clock clock
    ) {
        this.batteryStationRepository = batteryStationRepository;
        this.countLogRepository = countLogRepository;
        this.entityManager = entityManager;
        this.clock = clock;
    }

    @Transactional
    public BatteryStationReadResponse create(BatteryStationCreateRequest request) {
        assertAddressIsNotDuplicated(request.address());
        assertCountInvariant(request.maxBatteryCapacity(), request.currentBatteryCount(), request.availableBatteryCount());
        BatteryStation station = BatteryStation.create(
                request.name(),
                request.address(),
                request.latitude(),
                request.longitude(),
                request.status(),
                request.maxBatteryCapacity(),
                request.currentBatteryCount(),
                request.availableBatteryCount(),
                request.memo()
        );
        try {
            BatteryStation saved = batteryStationRepository.save(station);
            entityManager.flush();
            entityManager.refresh(saved);
            return BatteryStationReadResponse.from(saved);
        } catch (DataIntegrityViolationException exception) {
            throw new DuplicateActiveResourceException("BatteryStation", "address");
        }
    }

    @Transactional
    public BatteryStationReadResponse update(UUID id, BatteryStationUpdateRequest request) {
        BatteryStation station = findActiveStation(id);
        if (StringUtils.hasText(request.address())
                && batteryStationRepository.existsByAddressAndIdNotAndDeletedAtIsNull(request.address(), id)) {
            throw new DuplicateActiveResourceException("BatteryStation", "address");
        }
        try {
            station.updateOperatorManagedFields(
                    request.name(),
                    request.address(),
                    request.latitude(),
                    request.longitude(),
                    request.status(),
                    request.memo()
            );
            entityManager.flush();
            return BatteryStationReadResponse.from(station);
        } catch (DataIntegrityViolationException exception) {
            throw new DuplicateActiveResourceException("BatteryStation", "address");
        }
    }

    @Transactional
    public BatteryStationReadResponse updateBatteryCounts(UUID id, BatteryStationCountUpdateRequest request) {
        BatteryStation station = findActiveStation(id);
        assertCountInvariant(request.maxBatteryCapacity(), request.currentBatteryCount(), request.availableBatteryCount());
        Instant changedAt = Instant.now(clock);
        StationBatteryCountLog log = StationBatteryCountLog.create(
                station.getId(),
                station.getMaxBatteryCapacity(),
                request.maxBatteryCapacity(),
                station.getCurrentBatteryCount(),
                request.currentBatteryCount(),
                station.getAvailableBatteryCount(),
                request.availableBatteryCount(),
                request.reason(),
                request.memo(),
                changedAt,
                null
        );
        station.updateBatteryCounts(
                request.maxBatteryCapacity(),
                request.currentBatteryCount(),
                request.availableBatteryCount()
        );
        countLogRepository.save(log);
        entityManager.flush();
        return BatteryStationReadResponse.from(station);
    }

    @Transactional
    public void softDelete(UUID id) {
        BatteryStation station = findActiveStation(id);
        station.markInactiveAndDeleted(null, clock.instant());
    }

    private BatteryStation findActiveStation(UUID id) {
        return batteryStationRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("BatteryStation", id));
    }

    private void assertAddressIsNotDuplicated(String address) {
        if (batteryStationRepository.existsByAddressAndDeletedAtIsNull(address)) {
            throw new DuplicateActiveResourceException("BatteryStation", "address");
        }
    }

    private void assertCountInvariant(
            int maxBatteryCapacity,
            int currentBatteryCount,
            int availableBatteryCount
    ) {
        if (currentBatteryCount > maxBatteryCapacity || availableBatteryCount > currentBatteryCount) {
            throw new InvalidStateTransitionException(
                    "Battery station counts must satisfy maxBatteryCapacity >= currentBatteryCount >= availableBatteryCount."
            );
        }
    }
}
