package com.thundercrew.opsapi.contract.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;

@JsonIgnoreProperties(ignoreUnknown = true)
public record RiderBikeContractTerminateRequest(
        @NotNull Instant terminatedAt,
        String terminatedReason
) {
}
