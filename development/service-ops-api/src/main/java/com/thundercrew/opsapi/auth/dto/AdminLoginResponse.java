package com.thundercrew.opsapi.auth.dto;

import java.time.Instant;

public record AdminLoginResponse(
        String tokenType,
        String accessToken,
        Instant expiresAt,
        AdminIdentityResponse admin
) {
    public static AdminLoginResponse bearer(String accessToken, Instant expiresAt, AdminIdentityResponse admin) {
        return new AdminLoginResponse("Bearer", accessToken, expiresAt, admin);
    }
}
