package com.thundercrew.opsapi.station.controller;

import com.thundercrew.opsapi.station.dto.BatteryStationCountUpdateRequest;
import com.thundercrew.opsapi.station.dto.BatteryStationCreateRequest;
import com.thundercrew.opsapi.station.dto.BatteryStationReadResponse;
import com.thundercrew.opsapi.station.dto.BatteryStationUpdateRequest;
import com.thundercrew.opsapi.station.service.StationCommandService;
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
@RequestMapping("/api/v1/battery-stations")
public class StationCommandController {

    private final StationCommandService stationCommandService;

    public StationCommandController(StationCommandService stationCommandService) {
        this.stationCommandService = stationCommandService;
    }

    @PostMapping
    ResponseEntity<BatteryStationReadResponse> create(@Valid @RequestBody BatteryStationCreateRequest request) {
        BatteryStationReadResponse response = stationCommandService.create(request);
        return ResponseEntity.created(URI.create("/api/v1/battery-stations/" + response.id()))
                .body(response);
    }

    @PatchMapping("/{id}")
    BatteryStationReadResponse update(@PathVariable UUID id, @Valid @RequestBody BatteryStationUpdateRequest request) {
        return stationCommandService.update(id, request);
    }

    @PatchMapping("/{id}/battery-counts")
    BatteryStationReadResponse updateBatteryCounts(
            @PathVariable UUID id,
            @Valid @RequestBody BatteryStationCountUpdateRequest request
    ) {
        return stationCommandService.updateBatteryCounts(id, request);
    }

    @DeleteMapping("/{id}")
    ResponseEntity<Void> delete(@PathVariable UUID id) {
        stationCommandService.softDelete(id);
        return ResponseEntity.noContent().build();
    }
}
