package com.thundercrew.opsapi.equipment.controller;

import com.thundercrew.opsapi.common.api.PageResponse;
import com.thundercrew.opsapi.equipment.dto.BikeEquipmentReadResponse;
import com.thundercrew.opsapi.equipment.dto.EquipmentTypeReadResponse;
import com.thundercrew.opsapi.equipment.service.EquipmentReadService;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class EquipmentReadController {

    private final EquipmentReadService equipmentReadService;

    public EquipmentReadController(EquipmentReadService equipmentReadService) {
        this.equipmentReadService = equipmentReadService;
    }

    @GetMapping("/api/v1/equipment-types")
    PageResponse<EquipmentTypeReadResponse> listTypes(@PageableDefault(size = 20, sort = "idx", direction = Sort.Direction.ASC) Pageable pageable) {
        return equipmentReadService.listTypes(pageable);
    }

    @GetMapping("/api/v1/equipment-types/{id}")
    EquipmentTypeReadResponse getType(@PathVariable UUID id) {
        return equipmentReadService.getType(id);
    }

    @GetMapping("/api/v1/bike-equipments")
    PageResponse<BikeEquipmentReadResponse> listBikeEquipments(
            @PageableDefault(size = 20, sort = "idx", direction = Sort.Direction.ASC) Pageable pageable,
            @RequestParam(required = false) UUID bikeId) {
        return equipmentReadService.listBikeEquipments(pageable, bikeId);
    }

    @GetMapping("/api/v1/bike-equipments/{id}")
    BikeEquipmentReadResponse getBikeEquipment(@PathVariable UUID id) {
        return equipmentReadService.getBikeEquipment(id);
    }
}
