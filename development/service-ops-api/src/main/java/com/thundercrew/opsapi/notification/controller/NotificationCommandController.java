package com.thundercrew.opsapi.notification.controller;

import com.thundercrew.opsapi.notification.dto.NotificationReadResponse;
import com.thundercrew.opsapi.notification.service.NotificationCommandService;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/notifications")
public class NotificationCommandController {

    private final NotificationCommandService notificationCommandService;

    public NotificationCommandController(NotificationCommandService notificationCommandService) {
        this.notificationCommandService = notificationCommandService;
    }

    @PostMapping("/{id}/acknowledge")
    ResponseEntity<NotificationReadResponse> acknowledge(@PathVariable UUID id) {
        NotificationReadResponse response = notificationCommandService.acknowledge(id);
        return ResponseEntity.ok(response);
    }
}
