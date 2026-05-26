package com.thundercrew.opsapi.cleaningschedule.controller;

import com.thundercrew.opsapi.cleaningschedule.dto.CleaningScheduleReadResponse;
import com.thundercrew.opsapi.cleaningschedule.service.CleaningScheduleQueryService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/cleaning-schedules")
public class CleaningScheduleReadController {

    private final CleaningScheduleQueryService queryService;

    public CleaningScheduleReadController(CleaningScheduleQueryService queryService) {
        this.queryService = queryService;
    }

    @GetMapping
    List<CleaningScheduleReadResponse> list(
            @RequestParam(required = false) String bikeId
    ) {
        if (bikeId != null) return queryService.findByBikeId(bikeId);
        return queryService.findAll();
    }
}
