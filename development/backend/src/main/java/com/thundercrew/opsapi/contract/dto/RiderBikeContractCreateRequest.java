package com.thundercrew.opsapi.contract.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.thundercrew.opsapi.bike.domain.BikeServiceType;
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
        /** 서비스유형. null 이면 계약 팩토리가 OTHER 로 기본값. */
        BikeServiceType serviceType
) {
}
