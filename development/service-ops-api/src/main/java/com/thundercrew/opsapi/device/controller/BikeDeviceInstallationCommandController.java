package com.thundercrew.opsapi.device.controller;

import com.thundercrew.opsapi.device.dto.BikeDeviceInstallationCreateRequest;
import com.thundercrew.opsapi.device.dto.BikeDeviceInstallationReadResponse;
import com.thundercrew.opsapi.device.dto.BikeDeviceInstallationRemoveRequest;
import com.thundercrew.opsapi.device.service.BikeDeviceInstallationCommandService;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/bike-device-installations")
public class BikeDeviceInstallationCommandController {

    private final BikeDeviceInstallationCommandService commandService;

    public BikeDeviceInstallationCommandController(BikeDeviceInstallationCommandService commandService) {
        this.commandService = commandService;
    }

    @PostMapping
    ResponseEntity<BikeDeviceInstallationReadResponse> create(@Valid @RequestBody BikeDeviceInstallationCreateRequest request) {
        BikeDeviceInstallationReadResponse response = commandService.create(request);
        return ResponseEntity.created(URI.create("/api/v1/bike-device-installations/" + response.id()))
                .body(response);
    }

    @PatchMapping("/{id}/remove")
    BikeDeviceInstallationReadResponse remove(
            @PathVariable UUID id,
            @Valid @RequestBody(required = false) BikeDeviceInstallationRemoveRequest request
    ) {
        return commandService.remove(id, request == null ? new BikeDeviceInstallationRemoveRequest(null, null) : request);
    }
}
