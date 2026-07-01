package com.thundercrew.opsapi.dashboard.controller;

import com.thundercrew.opsapi.dashboard.dto.DashboardMapStateResponse;
import com.thundercrew.opsapi.dashboard.service.DashboardMapStateService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class DashboardMapController {

    private final DashboardMapStateService dashboardMapStateService;

    public DashboardMapController(DashboardMapStateService dashboardMapStateService) {
        this.dashboardMapStateService = dashboardMapStateService;
    }

    @GetMapping("/api/v1/dashboard/map-state")
    DashboardMapStateResponse getMapState() {
        return dashboardMapStateService.getMapState();
    }
}
