package com.thundercrew.opsapi.rider.controller;

import com.thundercrew.opsapi.rider.dto.RiderCreateRequest;
import com.thundercrew.opsapi.rider.dto.RiderReadResponse;
import com.thundercrew.opsapi.rider.dto.RiderUpdateRequest;
import com.thundercrew.opsapi.rider.service.RiderCommandService;
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
@RequestMapping("/api/v1/riders")
public class RiderCommandController {

    private final RiderCommandService riderCommandService;

    public RiderCommandController(RiderCommandService riderCommandService) {
        this.riderCommandService = riderCommandService;
    }

    @PostMapping
    ResponseEntity<RiderReadResponse> create(@Valid @RequestBody RiderCreateRequest request) {
        RiderReadResponse response = riderCommandService.create(request);
        return ResponseEntity.created(URI.create("/api/v1/riders/" + response.id()))
                .body(response);
    }

    @PatchMapping("/{id}")
    RiderReadResponse update(@PathVariable UUID id, @Valid @RequestBody RiderUpdateRequest request) {
        return riderCommandService.update(id, request);
    }

    @DeleteMapping("/{id}")
    ResponseEntity<Void> delete(@PathVariable UUID id) {
        riderCommandService.softDelete(id);
        return ResponseEntity.noContent().build();
    }
}
