package com.thundercrew.opsapi.riderauth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RiderRegisterRequest(
        @NotBlank String name,
        @NotBlank String phoneNumber,
        @NotBlank @Size(min = 8, max = 100) String password
) {
}
