package com.thundercrew.opsapi.device.service;

import com.thundercrew.opsapi.common.api.PageResponse;
import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import com.thundercrew.opsapi.device.dto.BikeDeviceInstallationReadResponse;
import com.thundercrew.opsapi.device.dto.DeviceReadResponse;
import com.thundercrew.opsapi.device.repository.BikeDeviceInstallationRepository;
import com.thundercrew.opsapi.device.repository.DeviceRepository;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class DeviceReadService {

    private final DeviceRepository deviceRepository;
    private final BikeDeviceInstallationRepository installationRepository;

    public DeviceReadService(DeviceRepository deviceRepository, BikeDeviceInstallationRepository installationRepository) {
        this.deviceRepository = deviceRepository;
        this.installationRepository = installationRepository;
    }

    public PageResponse<DeviceReadResponse> listDevices(Pageable pageable) {
        return PageResponse.of(deviceRepository.findByDeletedAtIsNull(pageable).map(DeviceReadResponse::from));
    }

    public DeviceReadResponse getDevice(UUID id) {
        return deviceRepository.findByIdAndDeletedAtIsNull(id)
                .map(DeviceReadResponse::from)
                .orElseThrow(() -> new ResourceNotFoundException("Device", id));
    }

    public PageResponse<BikeDeviceInstallationReadResponse> listInstallations(Pageable pageable) {
        return PageResponse.of(installationRepository.findByDeletedAtIsNull(pageable).map(BikeDeviceInstallationReadResponse::from));
    }

    public BikeDeviceInstallationReadResponse getInstallation(UUID id) {
        return installationRepository.findByIdAndDeletedAtIsNull(id)
                .map(BikeDeviceInstallationReadResponse::from)
                .orElseThrow(() -> new ResourceNotFoundException("BikeDeviceInstallation", id));
    }
}
