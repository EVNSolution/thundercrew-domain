package com.thundercrew.opsapi.contract.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

@JsonIgnoreProperties(ignoreUnknown = true)
public record ContractTemplateCreateRequest(
        @NotBlank @Size(max = 100) String name,
        @Positive Integer durationMinutes,
        String description,
        Boolean enabled
) {
}
