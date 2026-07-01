package com.thundercrew.opsapi.insurance.controller;

import com.thundercrew.opsapi.common.api.PageResponse;
import com.thundercrew.opsapi.insurance.dto.InsuranceItemReadResponse;
import com.thundercrew.opsapi.insurance.dto.RiderInsuranceReadResponse;
import com.thundercrew.opsapi.insurance.service.InsuranceReadService;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class InsuranceReadController {

    private final InsuranceReadService insuranceReadService;

    public InsuranceReadController(InsuranceReadService insuranceReadService) {
        this.insuranceReadService = insuranceReadService;
    }

    @GetMapping("/api/v1/insurance-items")
    PageResponse<InsuranceItemReadResponse> listItems(@PageableDefault(size = 20, sort = "idx", direction = Sort.Direction.ASC) Pageable pageable) {
        return insuranceReadService.listItems(pageable);
    }

    @GetMapping("/api/v1/insurance-items/{id}")
    InsuranceItemReadResponse getItem(@PathVariable UUID id) {
        return insuranceReadService.getItem(id);
    }

    @GetMapping("/api/v1/rider-insurances")
    PageResponse<RiderInsuranceReadResponse> listRiderInsurances(@PageableDefault(size = 20, sort = "idx", direction = Sort.Direction.ASC) Pageable pageable) {
        return insuranceReadService.listRiderInsurances(pageable);
    }

    @GetMapping("/api/v1/rider-insurances/{id}")
    RiderInsuranceReadResponse getRiderInsurance(@PathVariable UUID id) {
        return insuranceReadService.getRiderInsurance(id);
    }
}
