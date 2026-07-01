package com.thundercrew.opsapi.devicesync.controller;

import com.thundercrew.opsapi.devicesync.dto.DeviceApiSyncResultCreateRequest;
import com.thundercrew.opsapi.devicesync.dto.DeviceApiSyncResultResponse;
import com.thundercrew.opsapi.devicesync.dto.DeviceApiSyncRunCompleteRequest;
import com.thundercrew.opsapi.devicesync.dto.DeviceApiSyncRunCreateRequest;
import com.thundercrew.opsapi.devicesync.dto.DeviceApiSyncRunListResponse;
import com.thundercrew.opsapi.devicesync.dto.DeviceApiSyncRunResponse;
import com.thundercrew.opsapi.devicesync.service.DeviceApiSyncService;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/device-api-sync-runs")
public class DeviceApiSyncController {

    private final DeviceApiSyncService deviceApiSyncService;

    public DeviceApiSyncController(DeviceApiSyncService deviceApiSyncService) {
        this.deviceApiSyncService = deviceApiSyncService;
    }

    @PostMapping
    ResponseEntity<DeviceApiSyncRunResponse> createRun(@Valid @RequestBody DeviceApiSyncRunCreateRequest request) {
        DeviceApiSyncRunResponse response = deviceApiSyncService.createRun(request);
        return ResponseEntity.created(URI.create("/api/v1/device-api-sync-runs/" + response.id()))
                .body(response);
    }

    @PostMapping("/{runId}/results")
    ResponseEntity<DeviceApiSyncResultResponse> recordResult(
            @PathVariable UUID runId,
            @Valid @RequestBody DeviceApiSyncResultCreateRequest request
    ) {
        DeviceApiSyncResultResponse response = deviceApiSyncService.recordResult(runId, request);
        return ResponseEntity.created(URI.create("/api/v1/device-api-sync-runs/" + runId))
                .body(response);
    }

    @PatchMapping("/{runId}/complete")
    DeviceApiSyncRunResponse completeRun(
            @PathVariable UUID runId,
            @Valid @RequestBody DeviceApiSyncRunCompleteRequest request
    ) {
        return deviceApiSyncService.completeRun(runId, request);
    }

    @GetMapping
    DeviceApiSyncRunListResponse listRuns(
            @PageableDefault(size = 20, sort = "startedAt", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        return deviceApiSyncService.listRuns(pageable);
    }

    @GetMapping("/{runId}")
    DeviceApiSyncRunResponse getRun(@PathVariable UUID runId) {
        return deviceApiSyncService.getRun(runId);
    }
}
