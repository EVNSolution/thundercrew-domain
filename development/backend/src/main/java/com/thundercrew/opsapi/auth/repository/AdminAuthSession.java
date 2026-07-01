package com.thundercrew.opsapi.auth.repository;

import java.time.Instant;
import java.util.UUID;

public record AdminAuthSession(
        UUID id,
        UUID adminUserId,
        String accessTokenJti,
        Instant accessTokenExpiresAt,
        String refreshTokenHash,
        Instant refreshTokenExpiresAt,
        Instant issuedAt,
        Instant lastUsedAt,
        Instant revokedAt,
        String revokedReason,
        UUID replacedBySessionId
) {
}
