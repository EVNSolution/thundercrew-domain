package com.thundercrew.opsapi.testmatching.vehicle.controller;

import com.thundercrew.opsapi.testmatching.vehicle.dto.TestVehicleReadResponse;
import com.thundercrew.opsapi.testmatching.vehicle.service.TestVehicleReadService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/test-matching/vehicles")
public class TestVehicleReadController {

    private final TestVehicleReadService service;

    public TestVehicleReadController(TestVehicleReadService service) {
        this.service = service;
    }

    @GetMapping
    List<TestVehicleReadResponse> listAll() {
        return service.listAll();
    }
}
