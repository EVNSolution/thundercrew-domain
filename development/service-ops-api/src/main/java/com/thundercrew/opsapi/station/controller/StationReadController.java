package com.thundercrew.opsapi.station.controller;

import com.thundercrew.opsapi.common.api.PageResponse;
import com.thundercrew.opsapi.station.dto.BatteryStationReadResponse;
import com.thundercrew.opsapi.station.dto.StationBatteryCountLogReadResponse;
import com.thundercrew.opsapi.station.service.StationReadService;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class StationReadController {

    private final StationReadService stationReadService;

    public StationReadController(StationReadService stationReadService) {
        this.stationReadService = stationReadService;
    }

    @GetMapping("/api/v1/battery-stations")
    PageResponse<BatteryStationReadResponse> listStations(@PageableDefault(size = 20, sort = "idx", direction = Sort.Direction.ASC) Pageable pageable) {
        return stationReadService.listStations(pageable);
    }

    @GetMapping("/api/v1/battery-stations/{id}")
    BatteryStationReadResponse getStation(@PathVariable UUID id) {
        return stationReadService.getStation(id);
    }

    @GetMapping("/api/v1/station-battery-count-logs")
    PageResponse<StationBatteryCountLogReadResponse> listCountLogs(@PageableDefault(size = 20, sort = "idx", direction = Sort.Direction.ASC) Pageable pageable) {
        return stationReadService.listCountLogs(pageable);
    }

    @GetMapping("/api/v1/station-battery-count-logs/{id}")
    StationBatteryCountLogReadResponse getCountLog(@PathVariable UUID id) {
        return stationReadService.getCountLog(id);
    }
}
