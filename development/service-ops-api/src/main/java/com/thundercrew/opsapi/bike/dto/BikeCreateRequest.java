package com.thundercrew.opsapi.bike.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.thundercrew.opsapi.bike.domain.BikeEngineType;
import com.thundercrew.opsapi.bike.domain.BikeOperationStatus;
import com.thundercrew.opsapi.bike.domain.BikeServiceType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

@JsonIgnoreProperties(ignoreUnknown = true)
public record BikeCreateRequest(
        @NotBlank @Size(max = 50) String plateNumber,
        @Size(max = 100) String vin,
        @Size(max = 100) String modelName,
        BikeEngineType engineType,
        /**
         * 서비스 유형. null 이면 서비스 측에서 DELIVERY 로 기본값 잡음.
         * 클리닝·기타 차량은 운영자가 명시적으로 선택해야 등록된다.
         */
        BikeServiceType serviceType,
        @NotNull BikeOperationStatus operationStatus,
        String memo
) {
}
