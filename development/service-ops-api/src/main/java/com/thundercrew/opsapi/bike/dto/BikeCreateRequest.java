package com.thundercrew.opsapi.bike.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.thundercrew.opsapi.bike.domain.BikeOperationStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

@JsonIgnoreProperties(ignoreUnknown = true)
public record BikeCreateRequest(
        @NotBlank @Size(max = 50) String plateNumber,
        /** Optional at register time — operator updates later via the bike edit flow. */
        @Size(max = 100) String vin,
        @Size(max = 100) String modelName,
        @NotNull BikeOperationStatus operationStatus,
        String memo
) {
}
