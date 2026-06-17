package com.thundercrew.opsapi.rider.controller;

import com.thundercrew.opsapi.rider.dto.RiderMeResponse;
import com.thundercrew.opsapi.rider.service.RiderSelfReadService;
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

    public RiderSelfReadController(RiderSelfReadService riderSelfReadService) {
        this.riderSelfReadService = riderSelfReadService;
    }

    @GetMapping("/me")
    RiderMeResponse me(@AuthenticationPrincipal Jwt jwt) {
        UUID riderId = UUID.fromString(jwt.getClaimAsString("riderId"));
        return riderSelfReadService.getMe(riderId);
    }
}
