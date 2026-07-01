package com.thundercrew.opsapi.notification.controller;

import com.thundercrew.opsapi.notification.dto.NotificationReadResponse;
import com.thundercrew.opsapi.notification.service.NotificationReadService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/notifications")
public class NotificationReadController {

    private final NotificationReadService notificationReadService;

    public NotificationReadController(NotificationReadService notificationReadService) {
        this.notificationReadService = notificationReadService;
    }

    @GetMapping
    List<NotificationReadResponse> listRecent(
            @RequestParam(required = false) Boolean unacknowledgedOnly,
            @RequestParam(required = false) String type
    ) {
        return notificationReadService.listRecent(
                Boolean.TRUE.equals(unacknowledgedOnly),
                type
        );
    }
}
