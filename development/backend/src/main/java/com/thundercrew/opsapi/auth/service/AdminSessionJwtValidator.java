package com.thundercrew.opsapi.auth.service;

import com.thundercrew.opsapi.auth.repository.AdminAuthSessionRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.UUID;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class AdminSessionJwtValidator implements OAuth2TokenValidator<Jwt> {

    private static final OAuth2Error INVALID_SESSION = new OAuth2Error(
            "invalid_token",
            "Admin authentication session is missing, expired, or revoked.",
            null
    );

    private final AdminAuthSessionRepository adminAuthSessionRepository;
    private final Clock clock;

    public AdminSessionJwtValidator(AdminAuthSessionRepository adminAuthSessionRepository, Clock clock) {
        this.adminAuthSessionRepository = adminAuthSessionRepository;
        this.clock = clock;
    }

    @Override
    public OAuth2TokenValidatorResult validate(Jwt token) {
        String accessTokenJti = token.getId();
        String authSessionId = token.getClaimAsString("authSessionId");
        String adminUserId = token.getClaimAsString("adminUserId");
        if (!StringUtils.hasText(accessTokenJti)
                || !StringUtils.hasText(authSessionId)
                || !StringUtils.hasText(adminUserId)) {
            return OAuth2TokenValidatorResult.failure(INVALID_SESSION);
        }

        try {
            boolean active = adminAuthSessionRepository.existsActiveAccessToken(
                    UUID.fromString(authSessionId),
                    accessTokenJti,
                    UUID.fromString(adminUserId),
                    Instant.now(clock)
            );
            return active
                    ? OAuth2TokenValidatorResult.success()
                    : OAuth2TokenValidatorResult.failure(INVALID_SESSION);
        } catch (IllegalArgumentException exception) {
            return OAuth2TokenValidatorResult.failure(INVALID_SESSION);
        }
    }
}
