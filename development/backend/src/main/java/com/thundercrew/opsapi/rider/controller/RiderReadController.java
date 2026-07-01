package com.thundercrew.opsapi.rider.controller;

import com.thundercrew.opsapi.common.api.PageResponse;
import com.thundercrew.opsapi.rider.dto.RiderReadResponse;
import com.thundercrew.opsapi.rider.service.RiderReadService;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/riders")
public class RiderReadController {

    private final RiderReadService riderReadService;

    public RiderReadController(RiderReadService riderReadService) {
        this.riderReadService = riderReadService;
    }

    @GetMapping
    PageResponse<RiderReadResponse> list(@PageableDefault(size = 20, sort = "idx", direction = Sort.Direction.ASC) Pageable pageable) {
        return riderReadService.list(pageable);
    }

    @GetMapping("/{id}")
    RiderReadResponse get(@PathVariable UUID id) {
        return riderReadService.get(id);
    }
}
