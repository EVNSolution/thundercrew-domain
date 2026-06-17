package com.thundercrew.opsapi.auth.service;

import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.util.StringUtils;

/**
 * 공유 JwtDecoder 가 admin/rider 토큰을 모두 받도록, role 클레임으로 검증을 분기한다.
 * ADMIN: adminUserId/loginId 존재 + 활성 admin 세션(AdminSessionJwtValidator).
 * RIDER: riderId 존재(무상태). 그 외 role 은 거부.
 */
public class RoleAwareJwtValidator implements OAuth2TokenValidator<Jwt> {

    private static final OAuth2Error INVALID_TOKEN = new OAuth2Error(
            "invalid_token",
            "Token role or required claims are missing or invalid.",
            null
    );

    private final OAuth2TokenValidator<Jwt> adminSessionValidator;

    public RoleAwareJwtValidator(OAuth2TokenValidator<Jwt> adminSessionValidator) {
        this.adminSessionValidator = adminSessionValidator;
    }

    @Override
    public OAuth2TokenValidatorResult validate(Jwt token) {
        String role = token.getClaimAsString("role");
        if ("ADMIN".equals(role)) {
            if (!StringUtils.hasText(token.getClaimAsString("adminUserId"))
                    || !StringUtils.hasText(token.getClaimAsString("loginId"))) {
                return OAuth2TokenValidatorResult.failure(INVALID_TOKEN);
            }
            return adminSessionValidator.validate(token);
        }
        if ("RIDER".equals(role)) {
            if (!StringUtils.hasText(token.getClaimAsString("riderId"))) {
                return OAuth2TokenValidatorResult.failure(INVALID_TOKEN);
            }
            return OAuth2TokenValidatorResult.success();
        }
        return OAuth2TokenValidatorResult.failure(INVALID_TOKEN);
    }
}
