package com.thundercrew.opsapi.rider.controller;

import com.thundercrew.opsapi.rider.dto.RiderPasswordChangeRequest;
import com.thundercrew.opsapi.riderauth.service.RiderAuthService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/rider")
public class RiderSelfCommandController {

    private final RiderAuthService riderAuthService;

    public RiderSelfCommandController(RiderAuthService riderAuthService) {
        this.riderAuthService = riderAuthService;
    }

    @PostMapping("/me/password")
    ResponseEntity<Void> changePassword(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody RiderPasswordChangeRequest request
    ) {
        UUID riderId = UUID.fromString(jwt.getClaimAsString("riderId"));
        riderAuthService.changePassword(riderId, request.currentPassword(), request.newPassword());
        return ResponseEntity.noContent().build();
    }
}
