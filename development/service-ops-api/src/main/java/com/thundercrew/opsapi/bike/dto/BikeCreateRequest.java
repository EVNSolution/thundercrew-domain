package com.thundercrew.opsapi.bike.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.thundercrew.opsapi.bike.domain.BikeEngineType;
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
        /**
         * 동력 종류. null 이면 서비스 측에서 ELECTRIC 으로 기본값 잡음 — 현재
         * 운영 차량이 모두 전기 이륜차라는 도메인 가정과 일치. ICE 차량은
         * 운영자가 명시적으로 ICE 를 골라야 등록된다.
         */
        BikeEngineType engineType,
        @NotNull BikeOperationStatus operationStatus,
        String memo
) {
}
