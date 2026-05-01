package com.thundercrew.opsapi.auth.dto;

import java.time.Instant;

public record AdminLoginResponse(
        String tokenType,
        String accessToken,
        Instant expiresAt,
        String refreshToken,
        Instant refreshExpiresAt,
        AdminIdentityResponse admin
) {
    public static AdminLoginResponse bearer(
            String accessToken,
            Instant expiresAt,
            String refreshToken,
            Instant refreshExpiresAt,
            AdminIdentityResponse admin
    ) {
        return new AdminLoginResponse("Bearer", accessToken, expiresAt, refreshToken, refreshExpiresAt, admin);
    }
}
