package com.thundercrew.opsapi.testmatching.matching.controller;

import com.thundercrew.opsapi.testmatching.matching.dto.TestMatchingCreateRequest;
import com.thundercrew.opsapi.testmatching.matching.dto.TestMatchingReadResponse;
import com.thundercrew.opsapi.testmatching.matching.service.TestMatchingCommandService;
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
@RequestMapping("/api/v1/test-matching/matchings")
public class TestMatchingCommandController {

    private final TestMatchingCommandService service;

    public TestMatchingCommandController(TestMatchingCommandService service) {
        this.service = service;
    }

    @PostMapping
    ResponseEntity<TestMatchingReadResponse> create(@Valid @RequestBody TestMatchingCreateRequest request) {
        TestMatchingReadResponse response = service.create(request);
        return ResponseEntity.created(URI.create("/api/v1/test-matching/matchings/" + response.id()))
                .body(response);
    }

    @DeleteMapping("/{id}")
    ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
