package com.thundercrew.opsapi.dispatch.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;

public record DeliveryCallCreateRequest(
        @NotBlank String customerName,
        @NotBlank String customerPhone,
        @NotBlank String address,
        @DecimalMin("-90.0") @DecimalMax("90.0") double latitude,
        @DecimalMin("-180.0") @DecimalMax("180.0") double longitude
) {
}
