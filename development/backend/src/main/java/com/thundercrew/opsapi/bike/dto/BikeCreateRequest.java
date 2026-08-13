package com.thundercrew.opsapi.bike.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.thundercrew.opsapi.bike.domain.BikeEngineType;
import com.thundercrew.opsapi.bike.domain.BikeOperationStatus;
import com.thundercrew.opsapi.bike.domain.BikePurpose;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

@JsonIgnoreProperties(ignoreUnknown = true)
public record BikeCreateRequest(
        @NotBlank @Size(max = 50) String plateNumber,
        @Size(max = 100) String vin,
        @Size(max = 100) String modelName,
        BikeEngineType engineType,
        BikePurpose purpose,
        @NotNull BikeOperationStatus operationStatus,
        String memo,
        @Size(max = 15) String imei,
        @Size(max = 64) String terminalId
) {
}
