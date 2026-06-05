package com.thundercrew.opsapi.testmatching.vehicle.controller;

import com.thundercrew.opsapi.testmatching.vehicle.dto.TestVehicleCreateRequest;
import com.thundercrew.opsapi.testmatching.vehicle.dto.TestVehicleReadResponse;
import com.thundercrew.opsapi.testmatching.vehicle.service.TestVehicleCommandService;
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
@RequestMapping("/api/v1/test-matching/vehicles")
public class TestVehicleCommandController {

    private final TestVehicleCommandService service;

    public TestVehicleCommandController(TestVehicleCommandService service) {
        this.service = service;
    }

    @PostMapping
    ResponseEntity<TestVehicleReadResponse> create(@Valid @RequestBody TestVehicleCreateRequest request) {
        TestVehicleReadResponse response = service.create(request);
        return ResponseEntity.created(URI.create("/api/v1/test-matching/vehicles/" + response.id()))
                .body(response);
    }

    @DeleteMapping("/{id}")
    ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
