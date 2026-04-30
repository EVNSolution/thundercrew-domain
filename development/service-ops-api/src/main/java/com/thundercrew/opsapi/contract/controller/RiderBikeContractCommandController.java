package com.thundercrew.opsapi.contract.controller;

import com.thundercrew.opsapi.contract.dto.RiderBikeContractCreateRequest;
import com.thundercrew.opsapi.contract.dto.RiderBikeContractReadResponse;
import com.thundercrew.opsapi.contract.dto.RiderBikeContractTerminateRequest;
import com.thundercrew.opsapi.contract.dto.RiderBikeContractUpdateRequest;
import com.thundercrew.opsapi.contract.service.RiderBikeContractCommandService;
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
@RequestMapping("/api/v1/rider-bike-contracts")
public class RiderBikeContractCommandController {

    private final RiderBikeContractCommandService riderBikeContractCommandService;

    public RiderBikeContractCommandController(RiderBikeContractCommandService riderBikeContractCommandService) {
        this.riderBikeContractCommandService = riderBikeContractCommandService;
    }

    @PostMapping
    ResponseEntity<RiderBikeContractReadResponse> create(@Valid @RequestBody RiderBikeContractCreateRequest request) {
        RiderBikeContractReadResponse response = riderBikeContractCommandService.create(request);
        return ResponseEntity.created(URI.create("/api/v1/rider-bike-contracts/" + response.id()))
                .body(response);
    }

    @PatchMapping("/{id}")
    RiderBikeContractReadResponse update(@PathVariable UUID id, @RequestBody(required = false) RiderBikeContractUpdateRequest request) {
        RiderBikeContractUpdateRequest effectiveRequest = request == null
                ? new RiderBikeContractUpdateRequest(null)
                : request;
        return riderBikeContractCommandService.update(id, effectiveRequest);
    }

    @PatchMapping("/{id}/terminate")
    RiderBikeContractReadResponse terminate(
            @PathVariable UUID id,
            @Valid @RequestBody RiderBikeContractTerminateRequest request
    ) {
        return riderBikeContractCommandService.terminate(id, request);
    }
}
