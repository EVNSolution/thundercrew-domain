package com.thundercrew.opsapi.bike.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.thundercrew.opsapi.bike.domain.BikeEngineType;
import com.thundercrew.opsapi.bike.domain.BikeServiceType;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@JsonIgnoreProperties(ignoreUnknown = true)
public record BikeUpdateRequest(
        @Size(max = 50) @Pattern(regexp = ".*\\S.*", message = "must not be blank when provided") String plateNumber,
        @Size(max = 100) @Pattern(regexp = ".*\\S.*", message = "must not be blank when provided") String vin,
        @Size(max = 100) String modelName,
        BikeEngineType engineType,
        /** null 이면 변경 안 함 (다른 필드와 동일한 partial-update 규약). */
        BikeServiceType serviceType,
        String memo
) {
}
