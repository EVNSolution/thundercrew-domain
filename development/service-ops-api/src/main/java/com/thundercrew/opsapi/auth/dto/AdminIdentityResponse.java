package com.thundercrew.opsapi.auth.dto;

import java.util.UUID;

import com.thundercrew.opsapi.auth.repository.AdminUserAccount;

public record AdminIdentityResponse(
        UUID id,
        String loginId,
        String email,
        String displayName,
        String role
) {
    public static AdminIdentityResponse from(AdminUserAccount account) {
        return new AdminIdentityResponse(
                account.id(),
                account.loginId(),
                account.email(),
                account.displayName(),
                "ADMIN"
        );
    }
}
