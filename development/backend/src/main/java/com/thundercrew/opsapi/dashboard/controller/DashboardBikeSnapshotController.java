package com.thundercrew.opsapi.dashboard.controller;

import com.thundercrew.opsapi.dashboard.dto.DashboardBikeSnapshotResponse;
import com.thundercrew.opsapi.dashboard.service.DashboardBikeSnapshotService;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class DashboardBikeSnapshotController {

    private final DashboardBikeSnapshotService snapshotService;

    public DashboardBikeSnapshotController(DashboardBikeSnapshotService snapshotService) {
        this.snapshotService = snapshotService;
    }

    @GetMapping("/api/v1/dashboard/bikes/{bikeId}/snapshot")
    DashboardBikeSnapshotResponse getSnapshot(@PathVariable UUID bikeId) {
        return snapshotService.getSnapshot(bikeId);
    }
}
