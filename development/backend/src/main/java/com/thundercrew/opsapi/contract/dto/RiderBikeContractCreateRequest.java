package com.thundercrew.opsapi.contract.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.UUID;

@JsonIgnoreProperties(ignoreUnknown = true)
public record RiderBikeContractCreateRequest(
        @NotNull UUID riderId,
        @NotNull UUID bikeId,
        @NotNull UUID contractTemplateId,
        @NotNull Instant startAt,
        String memo
) {
}
