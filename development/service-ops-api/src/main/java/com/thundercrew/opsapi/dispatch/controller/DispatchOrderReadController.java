package com.thundercrew.opsapi.dispatch.controller;

import com.thundercrew.opsapi.dispatch.dto.DispatchOrderReadResponse;
import com.thundercrew.opsapi.dispatch.service.DeliveryCallService;
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
    private final DeliveryCallService deliveryCallService;

    public DispatchOrderReadController(DispatchOrderReadService dispatchOrderReadService,
                                       DeliveryCallService deliveryCallService) {
        this.dispatchOrderReadService = dispatchOrderReadService;
        this.deliveryCallService = deliveryCallService;
    }

    @GetMapping
    List<DispatchOrderReadResponse> listByBike(@RequestParam UUID bikeId) {
        return dispatchOrderReadService.listByBike(bikeId);
    }

    @GetMapping("/calls/offered")
    List<DispatchOrderReadResponse> offeredCalls() {
        return deliveryCallService.listOffered();
    }
}
