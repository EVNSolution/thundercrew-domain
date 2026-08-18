package com.thundercrew.opsapi.contract.controller;

import com.thundercrew.opsapi.common.api.PageResponse;
import com.thundercrew.opsapi.contract.dto.ContractTemplateReadResponse;
import com.thundercrew.opsapi.contract.dto.RiderBikeContractReadResponse;
import com.thundercrew.opsapi.contract.service.ContractReadService;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ContractReadController {

    private final ContractReadService contractReadService;

    public ContractReadController(ContractReadService contractReadService) {
        this.contractReadService = contractReadService;
    }

    @GetMapping("/api/v1/contract-templates")
    PageResponse<ContractTemplateReadResponse> listTemplates(@PageableDefault(size = 20, sort = "idx", direction = Sort.Direction.ASC) Pageable pageable) {
        return contractReadService.listTemplates(pageable);
    }

    @GetMapping("/api/v1/contract-templates/{id}")
    ContractTemplateReadResponse getTemplate(@PathVariable UUID id) {
        return contractReadService.getTemplate(id);
    }

    @GetMapping("/api/v1/rider-bike-contracts")
    PageResponse<RiderBikeContractReadResponse> listRiderBikeContracts(
            @PageableDefault(size = 20, sort = "idx", direction = Sort.Direction.ASC) Pageable pageable,
            @RequestParam(required = false) UUID bikeId) {
        return contractReadService.listRiderBikeContracts(pageable, bikeId);
    }

    @GetMapping("/api/v1/rider-bike-contracts/{id}")
    RiderBikeContractReadResponse getRiderBikeContract(@PathVariable UUID id) {
        return contractReadService.getRiderBikeContract(id);
    }
}
