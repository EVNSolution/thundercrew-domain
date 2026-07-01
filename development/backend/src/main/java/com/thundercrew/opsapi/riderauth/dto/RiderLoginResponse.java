package com.thundercrew.opsapi.riderauth.dto;

import java.time.Instant;

public record RiderLoginResponse(
        String tokenType,
        String accessToken,
        Instant expiresAt,
        String refreshToken,
        Instant refreshExpiresAt,
        RiderIdentityResponse rider
) {
    public static RiderLoginResponse bearer(
            String accessToken,
            Instant expiresAt,
            String refreshToken,
            Instant refreshExpiresAt,
            RiderIdentityResponse rider
    ) {
        return new RiderLoginResponse("Bearer", accessToken, expiresAt, refreshToken, refreshExpiresAt, rider);
    }
}
