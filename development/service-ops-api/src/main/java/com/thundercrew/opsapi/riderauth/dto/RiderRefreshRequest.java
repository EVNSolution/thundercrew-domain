package com.thundercrew.opsapi.riderauth.dto;

import jakarta.validation.constraints.NotBlank;

public record RiderRefreshRequest(
        @NotBlank String refreshToken
) {
}
