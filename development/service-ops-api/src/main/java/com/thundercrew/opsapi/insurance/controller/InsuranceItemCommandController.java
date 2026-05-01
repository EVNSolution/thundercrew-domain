package com.thundercrew.opsapi.insurance.controller;

import com.thundercrew.opsapi.insurance.dto.InsuranceItemCreateRequest;
import com.thundercrew.opsapi.insurance.dto.InsuranceItemReadResponse;
import com.thundercrew.opsapi.insurance.dto.InsuranceItemUpdateRequest;
import com.thundercrew.opsapi.insurance.service.InsuranceItemCommandService;
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
@RequestMapping("/api/v1/insurance-items")
public class InsuranceItemCommandController {

    private final InsuranceItemCommandService insuranceItemCommandService;

    public InsuranceItemCommandController(InsuranceItemCommandService insuranceItemCommandService) {
        this.insuranceItemCommandService = insuranceItemCommandService;
    }

    @PostMapping
    ResponseEntity<InsuranceItemReadResponse> create(@Valid @RequestBody InsuranceItemCreateRequest request) {
        InsuranceItemReadResponse response = insuranceItemCommandService.create(request);
        return ResponseEntity.created(URI.create("/api/v1/insurance-items/" + response.id()))
                .body(response);
    }

    @PatchMapping("/{id}")
    InsuranceItemReadResponse update(@PathVariable UUID id, @Valid @RequestBody InsuranceItemUpdateRequest request) {
        return insuranceItemCommandService.update(id, request);
    }

    @DeleteMapping("/{id}")
    ResponseEntity<Void> delete(@PathVariable UUID id) {
        insuranceItemCommandService.softDelete(id);
        return ResponseEntity.noContent().build();
    }
}
