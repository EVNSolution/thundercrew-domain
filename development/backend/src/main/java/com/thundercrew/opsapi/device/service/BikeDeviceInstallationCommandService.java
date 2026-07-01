package com.thundercrew.opsapi.device.service;

import com.thundercrew.opsapi.bike.repository.BikeRepository;
import com.thundercrew.opsapi.common.api.InvalidStateTransitionException;
import com.thundercrew.opsapi.common.api.ReferenceDeletedException;
import com.thundercrew.opsapi.common.api.ReferenceNotFoundException;
import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import com.thundercrew.opsapi.device.domain.BikeDeviceInstallation;
import com.thundercrew.opsapi.device.domain.Device;
import com.thundercrew.opsapi.device.dto.BikeDeviceInstallationCreateRequest;
import com.thundercrew.opsapi.device.dto.BikeDeviceInstallationReadResponse;
import com.thundercrew.opsapi.device.dto.BikeDeviceInstallationRemoveRequest;
import com.thundercrew.opsapi.device.repository.BikeDeviceInstallationRepository;
import com.thundercrew.opsapi.device.repository.DeviceRepository;
import jakarta.persistence.EntityManager;
import java.time.Clock;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BikeDeviceInstallationCommandService {

    private final BikeDeviceInstallationRepository installationRepository;
    private final BikeRepository bikeRepository;
    private final DeviceRepository deviceRepository;
    private final EntityManager entityManager;
    private final Clock clock;

    public BikeDeviceInstallationCommandService(
            BikeDeviceInstallationRepository installationRepository,
            BikeRepository bikeRepository,
            DeviceRepository deviceRepository,
            EntityManager entityManager,
            Clock clock
    ) {
        this.installationRepository = installationRepository;
        this.bikeRepository = bikeRepository;
        this.deviceRepository = deviceRepository;
        this.entityManager = entityManager;
        this.clock = clock;
    }

    @Transactional
    public BikeDeviceInstallationReadResponse create(BikeDeviceInstallationCreateRequest request) {
        assertActiveBikeReference(request.bikeId());
        Device device = findEnabledDeviceReference(request.deviceId());
        lockInstallationReferences(request.bikeId(), request.deviceId());
        closeConflictingActiveInstallations(request.bikeId(), device.getId(), request.installedAt());

        BikeDeviceInstallation installation = BikeDeviceInstallation.create(
                request.bikeId(),
                request.deviceId(),
                request.installedAt(),
                request.memo()
        );
        BikeDeviceInstallation saved = installationRepository.save(installation);
        entityManager.flush();
        entityManager.refresh(saved);
        return BikeDeviceInstallationReadResponse.from(saved);
    }

    @Transactional
    public BikeDeviceInstallationReadResponse remove(UUID id, BikeDeviceInstallationRemoveRequest request) {
        BikeDeviceInstallation installation = installationRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("BikeDeviceInstallation", id));
        if (installation.getRemovedAt() != null) {
            throw new InvalidStateTransitionException("Bike-device installation is already removed.");
        }
        Instant removedAt = request.removedAt() == null ? Instant.now(clock) : request.removedAt();
        assertRemovalTimeIsValid(installation, removedAt);
        installation.remove(removedAt, request.memo());
        entityManager.flush();
        return BikeDeviceInstallationReadResponse.from(installation);
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

    private Device findEnabledDeviceReference(UUID deviceId) {
        Device device = deviceRepository.findById(deviceId)
                .orElseThrow(() -> new ReferenceNotFoundException("Device", deviceId));
        if (device.isDeleted()) {
            throw new ReferenceDeletedException("Device", deviceId);
        }
        if (!device.isEnabled()) {
            throw new InvalidStateTransitionException("Device is disabled and cannot be installed.");
        }
        return device;
    }

    private void closeConflictingActiveInstallations(UUID bikeId, UUID deviceId, Instant replacementInstalledAt) {
        Map<UUID, BikeDeviceInstallation> installationsById = new LinkedHashMap<>();
        installationRepository.findByBikeIdAndRemovedAtIsNullAndDeletedAtIsNull(bikeId)
                .ifPresent(installation -> installationsById.put(installation.getId(), installation));
        installationRepository.findByDeviceIdAndRemovedAtIsNullAndDeletedAtIsNull(deviceId)
                .ifPresent(installation -> installationsById.put(installation.getId(), installation));

        installationsById.values().forEach(installation -> {
            assertRemovalTimeIsValid(installation, replacementInstalledAt);
            installation.remove(replacementInstalledAt, installation.getMemo());
        });
        if (!installationsById.isEmpty()) {
            entityManager.flush();
        }
    }

    private void assertRemovalTimeIsValid(BikeDeviceInstallation installation, Instant removedAt) {
        if (removedAt.isBefore(installation.getInstalledAt())) {
            throw new InvalidStateTransitionException("Bike-device installation removal time cannot be before installed time.");
        }
    }

    private void lockInstallationReferences(UUID bikeId, UUID deviceId) {
        List.of(
                        "bike-device-installation:bike:" + bikeId,
                        "bike-device-installation:device:" + deviceId
                )
                .stream()
                .sorted()
                .forEach(this::lockByKey);
    }

    private void lockByKey(String lockKey) {
        entityManager.createNativeQuery("select pg_advisory_xact_lock(hashtextextended(?1, 0))")
                .setParameter(1, lockKey)
                .getSingleResult();
    }
}
