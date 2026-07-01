package com.thundercrew.opsapi.integrity.controller;

import com.thundercrew.opsapi.integrity.dto.IntegrityScanResponse;
import com.thundercrew.opsapi.integrity.service.IntegrityScanService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/integrity")
public class IntegrityScanController {

    private final IntegrityScanService integrityScanService;

    public IntegrityScanController(IntegrityScanService integrityScanService) {
        this.integrityScanService = integrityScanService;
    }

    @GetMapping("/reference-checks")
    IntegrityScanResponse referenceChecks() {
        return integrityScanService.scanReferences();
    }
}
