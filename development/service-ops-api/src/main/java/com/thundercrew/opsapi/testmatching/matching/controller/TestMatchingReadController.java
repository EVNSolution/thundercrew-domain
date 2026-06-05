package com.thundercrew.opsapi.testmatching.matching.controller;

import com.thundercrew.opsapi.testmatching.matching.dto.TestMatchingReadResponse;
import com.thundercrew.opsapi.testmatching.matching.service.TestMatchingReadService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/test-matching/matchings")
public class TestMatchingReadController {

    private final TestMatchingReadService service;

    public TestMatchingReadController(TestMatchingReadService service) {
        this.service = service;
    }

    @GetMapping
    List<TestMatchingReadResponse> listAll() {
        return service.listAll();
    }
}
