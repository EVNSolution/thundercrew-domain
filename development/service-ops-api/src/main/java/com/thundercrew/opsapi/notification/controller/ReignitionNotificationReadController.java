package com.thundercrew.opsapi.notification.controller;

import com.thundercrew.opsapi.notification.dto.ReignitionNotificationReadResponse;
import com.thundercrew.opsapi.notification.service.ReignitionNotificationReadService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/reignition-notifications")
public class ReignitionNotificationReadController {

    private final ReignitionNotificationReadService reignitionNotificationReadService;

    public ReignitionNotificationReadController(ReignitionNotificationReadService reignitionNotificationReadService) {
        this.reignitionNotificationReadService = reignitionNotificationReadService;
    }

    @GetMapping
    List<ReignitionNotificationReadResponse> listRecent() {
        return reignitionNotificationReadService.listRecent();
    }
}
