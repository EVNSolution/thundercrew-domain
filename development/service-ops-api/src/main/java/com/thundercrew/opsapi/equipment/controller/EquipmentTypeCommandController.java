package com.thundercrew.opsapi.equipment.controller;

import com.thundercrew.opsapi.equipment.dto.EquipmentTypeCreateRequest;
import com.thundercrew.opsapi.equipment.dto.EquipmentTypeReadResponse;
import com.thundercrew.opsapi.equipment.dto.EquipmentTypeUpdateRequest;
import com.thundercrew.opsapi.equipment.service.EquipmentTypeCommandService;
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
@RequestMapping("/api/v1/equipment-types")
public class EquipmentTypeCommandController {

    private final EquipmentTypeCommandService equipmentTypeCommandService;

    public EquipmentTypeCommandController(EquipmentTypeCommandService equipmentTypeCommandService) {
        this.equipmentTypeCommandService = equipmentTypeCommandService;
    }

    @PostMapping
    ResponseEntity<EquipmentTypeReadResponse> create(@Valid @RequestBody EquipmentTypeCreateRequest request) {
        EquipmentTypeReadResponse response = equipmentTypeCommandService.create(request);
        return ResponseEntity.created(URI.create("/api/v1/equipment-types/" + response.id()))
                .body(response);
    }

    @PatchMapping("/{id}")
    EquipmentTypeReadResponse update(@PathVariable UUID id, @Valid @RequestBody EquipmentTypeUpdateRequest request) {
        return equipmentTypeCommandService.update(id, request);
    }

    @DeleteMapping("/{id}")
    ResponseEntity<Void> delete(@PathVariable UUID id) {
        equipmentTypeCommandService.softDelete(id);
        return ResponseEntity.noContent().build();
    }
}
