package com.thundercrew.opsapi.tip.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@JsonIgnoreProperties(ignoreUnknown = true)
public record TipCreateRequest(
        @NotBlank @Size(max = 255) String address,
        @NotBlank @Size(max = 2000) String content,
        @DecimalMin("-90.0") @DecimalMax("90.0") double latitude,
        @DecimalMin("-180.0") @DecimalMax("180.0") double longitude
) {}
