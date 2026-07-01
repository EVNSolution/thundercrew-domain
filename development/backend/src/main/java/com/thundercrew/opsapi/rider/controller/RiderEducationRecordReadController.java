package com.thundercrew.opsapi.rider.controller;

import com.thundercrew.opsapi.common.api.PageResponse;
import com.thundercrew.opsapi.rider.dto.RiderEducationRecordReadResponse;
import com.thundercrew.opsapi.rider.service.RiderEducationRecordReadService;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class RiderEducationRecordReadController {

    private final RiderEducationRecordReadService readService;

    public RiderEducationRecordReadController(RiderEducationRecordReadService readService) {
        this.readService = readService;
    }

    @GetMapping("/rider-education-records")
    PageResponse<RiderEducationRecordReadResponse> list(
            @PageableDefault(size = 20, sort = "completedAt", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        return readService.list(pageable);
    }

    @GetMapping("/rider-education-records/{id}")
    RiderEducationRecordReadResponse get(@PathVariable UUID id) {
        return readService.get(id);
    }

    @GetMapping("/riders/{riderId}/education-records")
    PageResponse<RiderEducationRecordReadResponse> listByRider(
            @PathVariable UUID riderId,
            @PageableDefault(size = 20, sort = "completedAt", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        return readService.listByRider(riderId, pageable);
    }
}
