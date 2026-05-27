package com.thundercrew.opsapi.bike.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record BikeNextCustomerRequest(
        @NotBlank @Size(max = 100) String customerName,
        @NotBlank @Size(max = 20)  String customerPhone,
        @NotBlank @Size(max = 500) String address,
        @DecimalMin("-90.0") @DecimalMax("90.0")   double latitude,
        @DecimalMin("-180.0") @DecimalMax("180.0") double longitude
) {}
