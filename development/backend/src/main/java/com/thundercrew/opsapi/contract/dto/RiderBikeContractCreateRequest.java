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
        String memo,
        /** 클리닝 계약 전용 — DIRECT(직영)/PARTNER(협력). 배송 계약이면 null 이어야 한다. */
        String engagementType
) {
}
