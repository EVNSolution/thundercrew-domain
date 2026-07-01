package com.thundercrew.opsapi.device.controller;

import com.thundercrew.opsapi.device.dto.DeviceCreateRequest;
import com.thundercrew.opsapi.device.dto.DeviceReadResponse;
import com.thundercrew.opsapi.device.dto.DeviceUpdateRequest;
import com.thundercrew.opsapi.device.service.DeviceCommandService;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/devices")
public class DeviceCommandController {

    private final DeviceCommandService deviceCommandService;

    public DeviceCommandController(DeviceCommandService deviceCommandService) {
        this.deviceCommandService = deviceCommandService;
    }

    @PostMapping
    ResponseEntity<DeviceReadResponse> create(@Valid @RequestBody DeviceCreateRequest request) {
        DeviceReadResponse response = deviceCommandService.create(request);
        return ResponseEntity.created(URI.create("/api/v1/devices/" + response.id()))
                .body(response);
    }

    @PatchMapping("/{id}")
    DeviceReadResponse update(@PathVariable UUID id, @Valid @RequestBody DeviceUpdateRequest request) {
        return deviceCommandService.update(id, request);
    }

    @DeleteMapping("/{id}")
    ResponseEntity<Void> delete(@PathVariable UUID id) {
        deviceCommandService.softDelete(id);
        return ResponseEntity.noContent().build();
    }
}
