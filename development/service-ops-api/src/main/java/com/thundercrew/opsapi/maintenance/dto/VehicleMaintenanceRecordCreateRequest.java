package com.thundercrew.opsapi.maintenance.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import java.time.Instant;
import java.util.UUID;

@JsonIgnoreProperties(ignoreUnknown = true)
public record VehicleMaintenanceRecordCreateRequest(
        @NotNull UUID itemId,
        /** 미지정 시 서비스가 현재 시각으로 채움. */
        Instant servicedAt,
        @PositiveOrZero Integer servicedAtOdometerKm,
        String memo
) {
}
