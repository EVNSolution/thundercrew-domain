package com.thundercrew.opsapi.telemetry.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.JsonNode;
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
        Integer accStatus,
        @NotNull TelemetrySource telemetrySource,
        JsonNode rawPayload
) {
}
