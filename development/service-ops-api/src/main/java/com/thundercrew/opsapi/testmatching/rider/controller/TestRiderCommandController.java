package com.thundercrew.opsapi.testmatching.rider.controller;

import com.thundercrew.opsapi.testmatching.rider.dto.TestRiderCreateRequest;
import com.thundercrew.opsapi.testmatching.rider.dto.TestRiderReadResponse;
import com.thundercrew.opsapi.testmatching.rider.service.TestRiderCommandService;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/test-matching/riders")
public class TestRiderCommandController {

    private final TestRiderCommandService service;

    public TestRiderCommandController(TestRiderCommandService service) {
        this.service = service;
    }

    @PostMapping
    ResponseEntity<TestRiderReadResponse> create(@Valid @RequestBody TestRiderCreateRequest request) {
        TestRiderReadResponse response = service.create(request);
        return ResponseEntity.created(URI.create("/api/v1/test-matching/riders/" + response.id()))
                .body(response);
    }

    @DeleteMapping("/{id}")
    ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
