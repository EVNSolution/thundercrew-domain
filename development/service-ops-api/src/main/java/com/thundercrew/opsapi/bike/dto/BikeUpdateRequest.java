package com.thundercrew.opsapi.bike.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@JsonIgnoreProperties(ignoreUnknown = true)
public record BikeUpdateRequest(
        @Size(max = 50) @Pattern(regexp = ".*\\S.*", message = "must not be blank when provided") String plateNumber,
        @Size(max = 100) @Pattern(regexp = ".*\\S.*", message = "must not be blank when provided") String vin,
        @Size(max = 100) String modelName,
        String memo
) {
}
