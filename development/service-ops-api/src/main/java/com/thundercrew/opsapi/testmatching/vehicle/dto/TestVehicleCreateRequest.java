package com.thundercrew.opsapi.testmatching.vehicle.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.thundercrew.opsapi.testmatching.vehicle.domain.TestBikeType;
import com.thundercrew.opsapi.testmatching.vehicle.domain.TestEngineType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@JsonIgnoreProperties(ignoreUnknown = true)
public record TestVehicleCreateRequest(
        @NotBlank @Size(max = 50) String plateNumber,
        @NotNull TestBikeType bikeType,
        @NotNull TestEngineType engineType,
        @Size(min = 15, max = 15) @Pattern(regexp = "\\d{15}", message = "IMEI는 15자리 숫자여야 합니다") String imei
) {}
