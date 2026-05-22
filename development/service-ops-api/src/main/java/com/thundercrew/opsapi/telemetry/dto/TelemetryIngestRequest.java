package com.thundercrew.opsapi.telemetry.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.thundercrew.opsapi.telemetry.domain.TelemetryIgnitionStatus;
import com.thundercrew.opsapi.telemetry.domain.TelemetrySource;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;

@JsonIgnoreProperties(ignoreUnknown = true)
public record TelemetryIngestRequest(
        @NotBlank @Size(max = 100) String deviceUid,
        @Size(max = 200) String vendorEventId,
        @NotNull Instant receivedAt,
        Instant deviceReportedAt,
        @DecimalMin("-90.0") @DecimalMax("90.0") BigDecimal latitude,
        @DecimalMin("-180.0") @DecimalMax("180.0") BigDecimal longitude,
        @PositiveOrZero BigDecimal speedKph,
        @DecimalMin("0.0") @DecimalMax("100.0") BigDecimal batteryPercent,
        /**
         * 누적 주행거리 (km). 벤더 페이로드가 줄 때만 채움; 누락된 이벤트는
         * 그대로 받아들이고 odometer 없이 적재한다.
         */
        @PositiveOrZero Integer odometerKm,
        @NotNull TelemetryIgnitionStatus ignitionStatus,
        @NotNull TelemetrySource telemetrySource,
        JsonNode rawPayload
) {
}
