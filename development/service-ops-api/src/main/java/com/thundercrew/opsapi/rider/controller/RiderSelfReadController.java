package com.thundercrew.opsapi.rider.controller;

import com.thundercrew.opsapi.dispatch.dto.DispatchOrderReadResponse;
import com.thundercrew.opsapi.dispatch.service.DispatchOrderReadService;
import com.thundercrew.opsapi.rider.dto.RiderMeResponse;
import com.thundercrew.opsapi.rider.dto.RiderVehicleResponse;
import com.thundercrew.opsapi.rider.service.RiderSelfReadService;
import com.thundercrew.opsapi.rider.service.RiderVehicleReadService;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/rider")
public class RiderSelfReadController {

    private final RiderSelfReadService riderSelfReadService;
    private final DispatchOrderReadService dispatchOrderReadService;
    private final RiderVehicleReadService riderVehicleReadService;

    public RiderSelfReadController(
            RiderSelfReadService riderSelfReadService,
            DispatchOrderReadService dispatchOrderReadService,
            RiderVehicleReadService riderVehicleReadService
    ) {
        this.riderSelfReadService = riderSelfReadService;
        this.dispatchOrderReadService = dispatchOrderReadService;
        this.riderVehicleReadService = riderVehicleReadService;
    }

    @GetMapping("/me")
    RiderMeResponse me(@AuthenticationPrincipal Jwt jwt) {
        UUID riderId = UUID.fromString(jwt.getClaimAsString("riderId"));
        return riderSelfReadService.getMe(riderId);
    }

    @GetMapping("/me/dispatch-orders")
    List<DispatchOrderReadResponse> myDispatchOrders(@AuthenticationPrincipal Jwt jwt) {
        UUID riderId = UUID.fromString(jwt.getClaimAsString("riderId"));
        UUID bikeId = riderVehicleReadService.activeBikeIdOrNull(riderId);
        if (bikeId == null) {
            return List.of();
        }
        return dispatchOrderReadService.listAssignedByBike(bikeId);
    }

    @GetMapping("/me/vehicle")
    RiderVehicleResponse myVehicle(@AuthenticationPrincipal Jwt jwt) {
        UUID riderId = UUID.fromString(jwt.getClaimAsString("riderId"));
        return riderVehicleReadService.getMyVehicle(riderId);
    }
}
