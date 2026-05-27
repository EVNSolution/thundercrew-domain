package com.thundercrew.opsapi.bike.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record BikeNextCustomerRequest(
        @NotBlank @Size(max = 100) String customerName,
        @NotBlank @Size(max = 20)  String customerPhone,
        @NotBlank @Size(max = 500) String address,
        double latitude,
        double longitude
) {}
