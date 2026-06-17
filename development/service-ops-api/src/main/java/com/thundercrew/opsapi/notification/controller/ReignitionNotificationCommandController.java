package com.thundercrew.opsapi.notification.controller;

import com.thundercrew.opsapi.notification.dto.ReignitionNotificationCreateRequest;
import com.thundercrew.opsapi.notification.dto.ReignitionNotificationReadResponse;
import com.thundercrew.opsapi.notification.service.ReignitionNotificationCommandService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/reignition-notifications")
public class ReignitionNotificationCommandController {

    private final ReignitionNotificationCommandService reignitionNotificationCommandService;

    public ReignitionNotificationCommandController(ReignitionNotificationCommandService reignitionNotificationCommandService) {
        this.reignitionNotificationCommandService = reignitionNotificationCommandService;
    }

    @PostMapping
    ResponseEntity<ReignitionNotificationReadResponse> record(
            @Valid @RequestBody ReignitionNotificationCreateRequest req) {
        ReignitionNotificationReadResponse response = reignitionNotificationCommandService.record(req);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
}
