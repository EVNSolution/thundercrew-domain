package com.thundercrew.opsapi.auth.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotNull;

@JsonIgnoreProperties(ignoreUnknown = true)
public record AdminPreferencesUpdateRequest(
        @NotNull Boolean ncpMapEnabled
) {
}
