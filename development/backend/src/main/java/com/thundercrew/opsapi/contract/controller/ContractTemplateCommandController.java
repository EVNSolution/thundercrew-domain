package com.thundercrew.opsapi.contract.controller;

import com.thundercrew.opsapi.contract.dto.ContractTemplateCreateRequest;
import com.thundercrew.opsapi.contract.dto.ContractTemplateReadResponse;
import com.thundercrew.opsapi.contract.dto.ContractTemplateUpdateRequest;
import com.thundercrew.opsapi.contract.service.ContractTemplateCommandService;
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
@RequestMapping("/api/v1/contract-templates")
public class ContractTemplateCommandController {

    private final ContractTemplateCommandService contractTemplateCommandService;

    public ContractTemplateCommandController(ContractTemplateCommandService contractTemplateCommandService) {
        this.contractTemplateCommandService = contractTemplateCommandService;
    }

    @PostMapping
    ResponseEntity<ContractTemplateReadResponse> create(@Valid @RequestBody ContractTemplateCreateRequest request) {
        ContractTemplateReadResponse response = contractTemplateCommandService.create(request);
        return ResponseEntity.created(URI.create("/api/v1/contract-templates/" + response.id()))
                .body(response);
    }

    @PatchMapping("/{id}")
    ContractTemplateReadResponse update(@PathVariable UUID id, @Valid @RequestBody ContractTemplateUpdateRequest request) {
        return contractTemplateCommandService.update(id, request);
    }

    @DeleteMapping("/{id}")
    ResponseEntity<Void> delete(@PathVariable UUID id) {
        contractTemplateCommandService.softDelete(id);
        return ResponseEntity.noContent().build();
    }
}
