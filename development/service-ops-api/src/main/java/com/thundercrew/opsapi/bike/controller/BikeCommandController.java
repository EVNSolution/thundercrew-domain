package com.thundercrew.opsapi.bike.controller;

import com.thundercrew.opsapi.bike.dto.BikeCreateRequest;
import com.thundercrew.opsapi.bike.dto.BikeIgnitionBlockRequest;
import com.thundercrew.opsapi.bike.dto.BikeOperationStatusChangeRequest;
import com.thundercrew.opsapi.bike.dto.BikeReadResponse;
import com.thundercrew.opsapi.bike.dto.BikeUpdateRequest;
import com.thundercrew.opsapi.bike.service.BikeCommandService;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/bikes")
public class BikeCommandController {

    private final BikeCommandService bikeCommandService;

    public BikeCommandController(BikeCommandService bikeCommandService) {
        this.bikeCommandService = bikeCommandService;
    }

    @PostMapping
    ResponseEntity<BikeReadResponse> create(@Valid @RequestBody BikeCreateRequest request) {
        BikeReadResponse response = bikeCommandService.create(request);
        return ResponseEntity.created(URI.create("/api/v1/bikes/" + response.id()))
                .body(response);
    }

    @PatchMapping("/{id}")
    BikeReadResponse update(@PathVariable UUID id, @Valid @RequestBody BikeUpdateRequest request) {
        return bikeCommandService.update(id, request);
    }

    @PatchMapping("/{id}/operation-status")
    BikeReadResponse changeOperationStatus(
            @PathVariable UUID id,
            @Valid @RequestBody BikeOperationStatusChangeRequest request
    ) {
        return bikeCommandService.changeOperationStatus(id, request);
    }

    @PatchMapping("/{id}/ignition-block")
    BikeReadResponse setIgnitionBlocked(
            @PathVariable UUID id,
            @Valid @RequestBody BikeIgnitionBlockRequest request
    ) {
        return bikeCommandService.setIgnitionBlocked(id, request.blocked());
    }

    @DeleteMapping("/{id}")
    ResponseEntity<Void> delete(@PathVariable UUID id) {
        bikeCommandService.softDelete(id);
        return ResponseEntity.noContent().build();
    }
}
