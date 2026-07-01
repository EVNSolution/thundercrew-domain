package com.thundercrew.opsapi.bike.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.thundercrew.opsapi.bike.domain.BikeOperationStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

@JsonIgnoreProperties(ignoreUnknown = true)
public record BikeOperationStatusChangeRequest(
        @NotNull BikeOperationStatus operationStatus,
        @Size(max = 200) String reason,
        String memo
) {
}
