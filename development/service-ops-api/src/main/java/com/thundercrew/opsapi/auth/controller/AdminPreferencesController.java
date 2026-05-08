package com.thundercrew.opsapi.auth.controller;

import com.thundercrew.opsapi.auth.dto.AdminPreferencesResponse;
import com.thundercrew.opsapi.auth.dto.AdminPreferencesUpdateRequest;
import com.thundercrew.opsapi.auth.service.AdminPreferencesService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin-users/me/preferences")
public class AdminPreferencesController {

    private final AdminPreferencesService preferencesService;

    public AdminPreferencesController(AdminPreferencesService preferencesService) {
        this.preferencesService = preferencesService;
    }

    @GetMapping
    AdminPreferencesResponse get(@AuthenticationPrincipal Jwt jwt) {
        return preferencesService.getMine(currentAdminId(jwt));
    }

    @PatchMapping
    AdminPreferencesResponse update(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody AdminPreferencesUpdateRequest request
    ) {
        return preferencesService.updateMine(currentAdminId(jwt), request.ncpMapEnabled());
    }

    private static UUID currentAdminId(Jwt jwt) {
        // The admin auth flow stores the admin uuid as the JWT subject claim.
        return UUID.fromString(jwt.getSubject());
    }
}
