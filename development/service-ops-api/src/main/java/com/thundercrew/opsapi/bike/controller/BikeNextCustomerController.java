package com.thundercrew.opsapi.bike.controller;

import com.thundercrew.opsapi.bike.dto.BikeNextCustomerRequest;
import com.thundercrew.opsapi.bike.dto.BikeNextCustomerResponse;
import com.thundercrew.opsapi.bike.service.BikeNextCustomerService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/bikes/{bikeId}/next-customer")
public class BikeNextCustomerController {

    private final BikeNextCustomerService bikeNextCustomerService;

    public BikeNextCustomerController(BikeNextCustomerService bikeNextCustomerService) {
        this.bikeNextCustomerService = bikeNextCustomerService;
    }

    @GetMapping
    ResponseEntity<BikeNextCustomerResponse> get(@PathVariable UUID bikeId) {
        return bikeNextCustomerService.get(bikeId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping
    BikeNextCustomerResponse put(@PathVariable UUID bikeId,
                                  @Valid @RequestBody BikeNextCustomerRequest request) {
        return bikeNextCustomerService.upsert(bikeId, request);
    }

    @DeleteMapping
    ResponseEntity<Void> delete(@PathVariable UUID bikeId) {
        bikeNextCustomerService.clear(bikeId);
        return ResponseEntity.noContent().build();
    }
}
