package com.thundercrew.opsapi.device.controller;

import com.thundercrew.opsapi.common.api.PageResponse;
import com.thundercrew.opsapi.device.dto.BikeDeviceInstallationReadResponse;
import com.thundercrew.opsapi.device.dto.DeviceReadResponse;
import com.thundercrew.opsapi.device.service.DeviceReadService;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class DeviceReadController {

    private final DeviceReadService deviceReadService;

    public DeviceReadController(DeviceReadService deviceReadService) {
        this.deviceReadService = deviceReadService;
    }

    @GetMapping("/api/v1/devices")
    PageResponse<DeviceReadResponse> listDevices(@PageableDefault(size = 20, sort = "idx", direction = Sort.Direction.ASC) Pageable pageable) {
        return deviceReadService.listDevices(pageable);
    }

    @GetMapping("/api/v1/devices/{id}")
    DeviceReadResponse getDevice(@PathVariable UUID id) {
        return deviceReadService.getDevice(id);
    }

    @GetMapping("/api/v1/bike-device-installations")
    PageResponse<BikeDeviceInstallationReadResponse> listInstallations(@PageableDefault(size = 20, sort = "idx", direction = Sort.Direction.ASC) Pageable pageable) {
        return deviceReadService.listInstallations(pageable);
    }

    @GetMapping("/api/v1/bike-device-installations/{id}")
    BikeDeviceInstallationReadResponse getInstallation(@PathVariable UUID id) {
        return deviceReadService.getInstallation(id);
    }
}
