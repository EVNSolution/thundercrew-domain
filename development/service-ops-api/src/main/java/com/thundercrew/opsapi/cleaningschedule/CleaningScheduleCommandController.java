package com.thundercrew.opsapi.cleaningschedule;

import com.thundercrew.opsapi.cleaningschedule.dto.CleaningScheduleCreateRequest;
import com.thundercrew.opsapi.cleaningschedule.dto.CleaningScheduleReadResponse;
import com.thundercrew.opsapi.cleaningschedule.service.CleaningScheduleCommandService;
import org.springframework.http.HttpStatus;
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
    public ResponseEntity<CleaningScheduleReadResponse> create(
        @RequestBody CleaningScheduleCreateRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(commandService.create(request));
    }
}
