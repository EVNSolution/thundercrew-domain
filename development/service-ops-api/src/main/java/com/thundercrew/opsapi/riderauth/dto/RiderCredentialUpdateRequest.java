package com.thundercrew.opsapi.riderauth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RiderCredentialUpdateRequest(
        @NotBlank @Size(min = 8, max = 100) String newPassword
) {
}
