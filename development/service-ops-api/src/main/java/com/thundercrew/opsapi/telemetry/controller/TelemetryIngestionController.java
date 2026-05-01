package com.thundercrew.opsapi.telemetry.controller;

import com.thundercrew.opsapi.telemetry.dto.TelemetryIngestRequest;
import com.thundercrew.opsapi.telemetry.dto.TelemetryIngestResponse;
import com.thundercrew.opsapi.telemetry.service.TelemetryIngestionService;
import jakarta.validation.Valid;
import java.net.URI;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/telemetry/device-events")
public class TelemetryIngestionController {

    private final TelemetryIngestionService telemetryIngestionService;

    public TelemetryIngestionController(TelemetryIngestionService telemetryIngestionService) {
        this.telemetryIngestionService = telemetryIngestionService;
    }

    @PostMapping
    ResponseEntity<TelemetryIngestResponse> ingest(@Valid @RequestBody TelemetryIngestRequest request) {
        TelemetryIngestResponse response = telemetryIngestionService.ingest(request);
        return ResponseEntity.created(URI.create("/api/v1/telemetry/device-events/" + response.telemetryLogId()))
                .body(response);
    }
}
