package com.thundercrew.opsapi.dispatch.controller;

import com.thundercrew.opsapi.dispatch.dto.DispatchOrderReadResponse;
import com.thundercrew.opsapi.dispatch.service.DispatchOrderReadService;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/dispatch-orders")
public class DispatchOrderReadController {

    private final DispatchOrderReadService dispatchOrderReadService;

    public DispatchOrderReadController(DispatchOrderReadService dispatchOrderReadService) {
        this.dispatchOrderReadService = dispatchOrderReadService;
    }

    @GetMapping
    List<DispatchOrderReadResponse> listByBike(@RequestParam UUID bikeId) {
        return dispatchOrderReadService.listByBike(bikeId);
    }
}
