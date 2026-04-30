package com.thundercrew.opsapi.equipment.controller;

import com.thundercrew.opsapi.equipment.dto.BikeEquipmentCreateRequest;
import com.thundercrew.opsapi.equipment.dto.BikeEquipmentReadResponse;
import com.thundercrew.opsapi.equipment.dto.BikeEquipmentRemoveRequest;
import com.thundercrew.opsapi.equipment.dto.BikeEquipmentUpdateRequest;
import com.thundercrew.opsapi.equipment.service.BikeEquipmentCommandService;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/bike-equipments")
public class BikeEquipmentCommandController {

    private final BikeEquipmentCommandService bikeEquipmentCommandService;

    public BikeEquipmentCommandController(BikeEquipmentCommandService bikeEquipmentCommandService) {
        this.bikeEquipmentCommandService = bikeEquipmentCommandService;
    }

    @PostMapping
    ResponseEntity<BikeEquipmentReadResponse> create(@Valid @RequestBody BikeEquipmentCreateRequest request) {
        BikeEquipmentReadResponse response = bikeEquipmentCommandService.create(request);
        return ResponseEntity.created(URI.create("/api/v1/bike-equipments/" + response.id()))
                .body(response);
    }

    @PatchMapping("/{id}")
    BikeEquipmentReadResponse update(@PathVariable UUID id, @Valid @RequestBody BikeEquipmentUpdateRequest request) {
        return bikeEquipmentCommandService.update(id, request);
    }

    @PatchMapping("/{id}/remove")
    BikeEquipmentReadResponse remove(@PathVariable UUID id, @RequestBody(required = false) BikeEquipmentRemoveRequest request) {
        BikeEquipmentRemoveRequest effectiveRequest = request == null ? new BikeEquipmentRemoveRequest(null, null) : request;
        return bikeEquipmentCommandService.remove(id, effectiveRequest);
    }
}
