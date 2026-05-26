package com.thundercrew.opsapi.cleaningschedule;

import com.thundercrew.opsapi.cleaningschedule.dto.CleaningScheduleReadResponse;
import com.thundercrew.opsapi.cleaningschedule.service.CleaningScheduleQueryService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import java.util.List;

@RestController
@RequestMapping("/api/v1/cleaning-schedules")
public class CleaningScheduleReadController {

    private final CleaningScheduleQueryService queryService;

    public CleaningScheduleReadController(CleaningScheduleQueryService queryService) {
        this.queryService = queryService;
    }

    @GetMapping
    public List<CleaningScheduleReadResponse> list(
        @RequestParam(required = false) String bikeId
    ) {
        if (bikeId != null) return queryService.findByBikeId(bikeId);
        return queryService.findAll();
    }
}
