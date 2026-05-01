package com.thundercrew.opsapi.device.service;

import com.thundercrew.opsapi.common.api.DuplicateActiveResourceException;
import com.thundercrew.opsapi.common.api.InvalidStateTransitionException;
import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import com.thundercrew.opsapi.device.domain.Device;
import com.thundercrew.opsapi.device.dto.DeviceCreateRequest;
import com.thundercrew.opsapi.device.dto.DeviceReadResponse;
import com.thundercrew.opsapi.device.dto.DeviceUpdateRequest;
import com.thundercrew.opsapi.device.repository.BikeDeviceInstallationRepository;
import com.thundercrew.opsapi.device.repository.DeviceRepository;
import jakarta.persistence.EntityManager;
import java.time.Clock;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class DeviceCommandService {

    private final DeviceRepository deviceRepository;
    private final BikeDeviceInstallationRepository installationRepository;
    private final EntityManager entityManager;
    private final Clock clock;

    public DeviceCommandService(
            DeviceRepository deviceRepository,
            BikeDeviceInstallationRepository installationRepository,
            EntityManager entityManager,
            Clock clock
    ) {
        this.deviceRepository = deviceRepository;
        this.installationRepository = installationRepository;
        this.entityManager = entityManager;
        this.clock = clock;
    }

    @Transactional
    public DeviceReadResponse create(DeviceCreateRequest request) {
        assertDeviceUidIsNotDuplicated(request.deviceUid());
        Device device = Device.create(
                request.deviceUid(),
                request.manufacturer(),
                request.modelName(),
                request.enabled(),
                request.memo()
        );
        try {
            Device saved = deviceRepository.save(device);
            entityManager.flush();
            entityManager.refresh(saved);
            return DeviceReadResponse.from(saved);
        } catch (DataIntegrityViolationException exception) {
            throw new DuplicateActiveResourceException("Device", "deviceUid");
        }
    }

    @Transactional
    public DeviceReadResponse update(UUID id, DeviceUpdateRequest request) {
        Device device = deviceRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("Device", id));
        if (StringUtils.hasText(request.deviceUid())
                && deviceRepository.existsByDeviceUidAndIdNotAndDeletedAtIsNull(request.deviceUid(), id)) {
            throw new DuplicateActiveResourceException("Device", "deviceUid");
        }
        try {
            device.updateOperatorManagedFields(
                    request.deviceUid(),
                    request.manufacturer(),
                    request.modelName(),
                    request.enabled(),
                    request.memo()
            );
            entityManager.flush();
            return DeviceReadResponse.from(device);
        } catch (DataIntegrityViolationException exception) {
            throw new DuplicateActiveResourceException("Device", "deviceUid");
        }
    }

    @Transactional
    public void softDelete(UUID id) {
        Device device = deviceRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("Device", id));
        if (installationRepository.existsByDeviceIdAndRemovedAtIsNullAndDeletedAtIsNull(id)) {
            throw new InvalidStateTransitionException("Device cannot be deleted while it has an active bike installation.");
        }
        device.disableAndMarkDeleted(null, clock.instant());
    }

    private void assertDeviceUidIsNotDuplicated(String deviceUid) {
        if (deviceRepository.existsByDeviceUidAndDeletedAtIsNull(deviceUid)) {
            throw new DuplicateActiveResourceException("Device", "deviceUid");
        }
    }
}
