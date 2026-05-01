package com.thundercrew.opsapi.auth.dto;

import jakarta.validation.constraints.NotBlank;

public record AdminRefreshRequest(
        @NotBlank String refreshToken
) {
}
