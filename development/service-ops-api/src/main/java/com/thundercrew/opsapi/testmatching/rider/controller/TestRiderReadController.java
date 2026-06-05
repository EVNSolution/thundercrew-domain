package com.thundercrew.opsapi.testmatching.rider.controller;

import com.thundercrew.opsapi.testmatching.rider.dto.TestRiderReadResponse;
import com.thundercrew.opsapi.testmatching.rider.service.TestRiderReadService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/test-matching/riders")
public class TestRiderReadController {

    private final TestRiderReadService service;

    public TestRiderReadController(TestRiderReadService service) {
        this.service = service;
    }

    @GetMapping
    List<TestRiderReadResponse> listAll() {
        return service.listAll();
    }
}
