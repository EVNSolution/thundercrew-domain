package com.thundercrew.opsapi.insurance.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@JsonIgnoreProperties(ignoreUnknown = true)
public record InsuranceItemCreateRequest(
        @NotBlank @Size(max = 100) String name,
        String description,
        Boolean enabled
) {
}
