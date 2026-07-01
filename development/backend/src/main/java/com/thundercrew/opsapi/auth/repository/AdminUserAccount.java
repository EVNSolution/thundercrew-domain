package com.thundercrew.opsapi.auth.repository;

import java.util.UUID;

public record AdminUserAccount(
        UUID id,
        String loginId,
        String email,
        String passwordHash,
        String displayName
) {
}
