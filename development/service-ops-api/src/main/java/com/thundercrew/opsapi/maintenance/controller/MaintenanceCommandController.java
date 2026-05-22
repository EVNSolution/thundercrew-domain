package com.thundercrew.opsapi.maintenance.controller;

import com.thundercrew.opsapi.maintenance.dto.MaintenanceItemCreateRequest;
import com.thundercrew.opsapi.maintenance.dto.MaintenanceItemReadResponse;
import com.thundercrew.opsapi.maintenance.dto.MaintenanceItemUpdateRequest;
import com.thundercrew.opsapi.maintenance.dto.VehicleMaintenanceRecordCreateRequest;
import com.thundercrew.opsapi.maintenance.dto.VehicleMaintenanceRecordReadResponse;
import com.thundercrew.opsapi.maintenance.service.MaintenanceCommandService;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class MaintenanceCommandController {

    private final MaintenanceCommandService maintenanceCommandService;

    public MaintenanceCommandController(MaintenanceCommandService maintenanceCommandService) {
        this.maintenanceCommandService = maintenanceCommandService;
    }

    @PostMapping("/api/v1/maintenance-items")
    ResponseEntity<MaintenanceItemReadResponse> createItem(
            @Valid @RequestBody MaintenanceItemCreateRequest request
    ) {
        MaintenanceItemReadResponse response = maintenanceCommandService.createItem(request);
        return ResponseEntity.created(URI.create("/api/v1/maintenance-items/" + response.id()))
                .body(response);
    }

    @PatchMapping("/api/v1/maintenance-items/{id}")
    MaintenanceItemReadResponse updateItem(
            @PathVariable UUID id,
            @Valid @RequestBody MaintenanceItemUpdateRequest request
    ) {
        return maintenanceCommandService.updateItem(id, request);
    }

    @DeleteMapping("/api/v1/maintenance-items/{id}")
    ResponseEntity<Void> deleteItem(@PathVariable UUID id) {
        maintenanceCommandService.softDeleteItem(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/v1/bikes/{bikeId}/maintenance-records")
    ResponseEntity<VehicleMaintenanceRecordReadResponse> createRecord(
            @PathVariable UUID bikeId,
            @Valid @RequestBody VehicleMaintenanceRecordCreateRequest request
    ) {
        VehicleMaintenanceRecordReadResponse response = maintenanceCommandService.createRecord(bikeId, request);
        return ResponseEntity.created(URI.create(
                "/api/v1/bikes/" + bikeId + "/maintenance-records/" + response.id()
        )).body(response);
    }

    @DeleteMapping("/api/v1/maintenance-records/{id}")
    ResponseEntity<Void> deleteRecord(@PathVariable UUID id) {
        maintenanceCommandService.softDeleteRecord(id);
        return ResponseEntity.noContent().build();
    }
}
