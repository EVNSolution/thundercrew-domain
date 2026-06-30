package com.thundercrew.opsapi.rider.controller;

import com.thundercrew.opsapi.dispatch.dto.DispatchOrderReadResponse;
import com.thundercrew.opsapi.rider.dto.RiderPasswordChangeRequest;
import com.thundercrew.opsapi.rider.service.RiderSelfDispatchService;
import com.thundercrew.opsapi.riderauth.service.RiderAuthService;
import jakarta.validation.Valid;
import java.io.IOException;
import java.util.UUID;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/rider")
public class RiderSelfCommandController {

    private final RiderAuthService riderAuthService;
    private final RiderSelfDispatchService riderSelfDispatchService;

    public RiderSelfCommandController(
            RiderAuthService riderAuthService,
            RiderSelfDispatchService riderSelfDispatchService
    ) {
        this.riderAuthService = riderAuthService;
        this.riderSelfDispatchService = riderSelfDispatchService;
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

    @PostMapping("/me/offered-calls/{id}/accept")
    DispatchOrderReadResponse acceptCall(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id
    ) {
        return riderSelfDispatchService.acceptOfferedCall(riderId(jwt), id);
    }

    @PostMapping(value = "/me/dispatch-orders/{id}/complete", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    DispatchOrderReadResponse complete(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @RequestPart("photo") MultipartFile photo
    ) throws IOException {
        return riderSelfDispatchService.completeMyDispatch(riderId(jwt), id, photo.getBytes(), photo.getContentType());
    }

    private static UUID riderId(Jwt jwt) {
        return UUID.fromString(jwt.getClaimAsString("riderId"));
    }
}
