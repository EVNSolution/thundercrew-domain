package com.thundercrew.opsapi.telemetry.controller;

import com.thundercrew.opsapi.common.api.PageResponse;
import com.thundercrew.opsapi.telemetry.dto.BikeCurrentStateReadResponse;
import com.thundercrew.opsapi.telemetry.service.TelemetryCurrentStateService;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class TelemetryCurrentStateController {

    private final TelemetryCurrentStateService telemetryCurrentStateService;

    public TelemetryCurrentStateController(TelemetryCurrentStateService telemetryCurrentStateService) {
        this.telemetryCurrentStateService = telemetryCurrentStateService;
    }

    @GetMapping("/api/v1/telemetry/bike-current-states")
    PageResponse<BikeCurrentStateReadResponse> listCurrentStates(
            @PageableDefault(size = 20, sort = "lastReceivedAt", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        return telemetryCurrentStateService.listCurrentStates(pageable);
    }

    @GetMapping("/api/v1/telemetry/bikes/{bikeId}/current-state")
    BikeCurrentStateReadResponse getCurrentState(@PathVariable UUID bikeId) {
        return telemetryCurrentStateService.getCurrentState(bikeId);
    }
}
