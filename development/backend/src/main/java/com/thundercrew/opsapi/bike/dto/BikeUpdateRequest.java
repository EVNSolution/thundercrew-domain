package com.thundercrew.opsapi.bike.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.thundercrew.opsapi.bike.domain.BikeEngineType;
import com.thundercrew.opsapi.bike.domain.BikePurpose;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@JsonIgnoreProperties(ignoreUnknown = true)
public record BikeUpdateRequest(
        @Size(max = 50) @Pattern(regexp = ".*\\S.*", message = "must not be blank when provided") String plateNumber,
        @Size(max = 100) @Pattern(regexp = ".*\\S.*", message = "must not be blank when provided") String vin,
        @Size(max = 100) String modelName,
        BikeEngineType engineType,
        BikePurpose purpose,
        String memo,
        @Size(max = 15) String imei,
        @Size(max = 64) String terminalId
) {
}
