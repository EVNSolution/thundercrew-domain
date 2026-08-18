package com.thundercrew.opsapi.bike.controller;

import com.thundercrew.opsapi.bike.dto.BikeOperationStatusHistoryReadResponse;
import com.thundercrew.opsapi.bike.dto.BikeReadResponse;
import com.thundercrew.opsapi.bike.service.BikeReadService;
import com.thundercrew.opsapi.common.api.PageResponse;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class BikeReadController {

    private final BikeReadService bikeReadService;

    public BikeReadController(BikeReadService bikeReadService) {
        this.bikeReadService = bikeReadService;
    }

    @GetMapping("/api/v1/bikes")
    PageResponse<BikeReadResponse> listBikes(@PageableDefault(size = 20, sort = "idx", direction = Sort.Direction.ASC) Pageable pageable) {
        return bikeReadService.listBikes(pageable);
    }

    @GetMapping("/api/v1/bikes/{id}")
    BikeReadResponse getBike(@PathVariable UUID id) {
        return bikeReadService.getBike(id);
    }

    @GetMapping("/api/v1/bike-operation-status-histories")
    PageResponse<BikeOperationStatusHistoryReadResponse> listStatusHistories(
            @PageableDefault(size = 20, sort = "idx", direction = Sort.Direction.ASC) Pageable pageable,
            @org.springframework.web.bind.annotation.RequestParam(required = false) UUID bikeId) {
        return bikeReadService.listStatusHistories(pageable, bikeId);
    }

    @GetMapping("/api/v1/bike-operation-status-histories/{id}")
    BikeOperationStatusHistoryReadResponse getStatusHistory(@PathVariable UUID id) {
        return bikeReadService.getStatusHistory(id);
    }
}
