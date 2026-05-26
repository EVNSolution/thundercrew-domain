package com.thundercrew.opsapi.cleaningschedule.controller;

import com.thundercrew.opsapi.cleaningschedule.dto.CleaningScheduleCreateRequest;
import com.thundercrew.opsapi.cleaningschedule.dto.CleaningScheduleReadResponse;
import com.thundercrew.opsapi.cleaningschedule.service.CleaningScheduleCommandService;
import jakarta.validation.Valid;
import java.net.URI;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/cleaning-schedules")
public class CleaningScheduleCommandController {

    private final CleaningScheduleCommandService commandService;

    public CleaningScheduleCommandController(CleaningScheduleCommandService commandService) {
        this.commandService = commandService;
    }

    @PostMapping
    ResponseEntity<CleaningScheduleReadResponse> create(
            @Valid @RequestBody CleaningScheduleCreateRequest request
    ) {
        CleaningScheduleReadResponse response = commandService.create(request);
        return ResponseEntity.created(URI.create("/api/v1/cleaning-schedules/" + response.id()))
                .body(response);
    }
}
