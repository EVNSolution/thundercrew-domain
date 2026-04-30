package com.thundercrew.opsapi.insurance.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

@JsonIgnoreProperties(ignoreUnknown = true)
public record RiderInsuranceCreateRequest(
        @NotNull UUID riderId,
        @NotNull UUID insuranceItemId,
        String memo,
        Boolean enabled
) {
}
