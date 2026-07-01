package com.thundercrew.opsapi.insurance.controller;

import com.thundercrew.opsapi.insurance.dto.RiderInsuranceCreateRequest;
import com.thundercrew.opsapi.insurance.dto.RiderInsuranceReadResponse;
import com.thundercrew.opsapi.insurance.dto.RiderInsuranceUpdateRequest;
import com.thundercrew.opsapi.insurance.service.RiderInsuranceCommandService;
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
@RequestMapping("/api/v1/rider-insurances")
public class RiderInsuranceCommandController {

    private final RiderInsuranceCommandService riderInsuranceCommandService;

    public RiderInsuranceCommandController(RiderInsuranceCommandService riderInsuranceCommandService) {
        this.riderInsuranceCommandService = riderInsuranceCommandService;
    }

    @PostMapping
    ResponseEntity<RiderInsuranceReadResponse> create(@Valid @RequestBody RiderInsuranceCreateRequest request) {
        RiderInsuranceReadResponse response = riderInsuranceCommandService.create(request);
        return ResponseEntity.created(URI.create("/api/v1/rider-insurances/" + response.id()))
                .body(response);
    }

    @PatchMapping("/{id}")
    RiderInsuranceReadResponse update(@PathVariable UUID id, @Valid @RequestBody RiderInsuranceUpdateRequest request) {
        return riderInsuranceCommandService.update(id, request);
    }

    @DeleteMapping("/{id}")
    ResponseEntity<Void> delete(@PathVariable UUID id) {
        riderInsuranceCommandService.softDelete(id);
        return ResponseEntity.noContent().build();
    }
}
