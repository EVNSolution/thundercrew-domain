package com.thundercrew.opsapi.riderauth.dto;

import jakarta.validation.constraints.NotBlank;

public record RiderLoginRequest(
        @NotBlank String phoneNumber,
        @NotBlank String name
) {
}
