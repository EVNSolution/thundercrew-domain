package com.thundercrew.opsapi.dispatch.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

@JsonIgnoreProperties(ignoreUnknown = true)
public record DispatchOrderCreateRequest(
        @NotNull UUID bikeId,
        @NotBlank @Size(max = 255) String customerName,
        @NotBlank @Size(max = 255) String customerPhone,
        @NotBlank @Size(max = 2000) String address,
        @DecimalMin("-90.0") @DecimalMax("90.0") double latitude,
        @DecimalMin("-180.0") @DecimalMax("180.0") double longitude,
        @Size(max = 2000) String originAddress,
        @DecimalMin("-90.0") @DecimalMax("90.0") Double originLatitude,
        @DecimalMin("-180.0") @DecimalMax("180.0") Double originLongitude
) {}
