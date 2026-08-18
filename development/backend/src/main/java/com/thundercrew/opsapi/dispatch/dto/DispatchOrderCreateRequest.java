package com.thundercrew.opsapi.dispatch.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;

@JsonIgnoreProperties(ignoreUnknown = true)
public record DispatchOrderCreateRequest(
        @NotNull UUID bikeId,
        @NotBlank @Size(max = 255) String customerName,
        @NotBlank @Size(max = 255) String customerPhone,
        @NotBlank @Size(max = 2000) String address,
        @DecimalMin("-90.0") @DecimalMax("90.0") double latitude,
        @DecimalMin("-180.0") @DecimalMax("180.0") double longitude,
        @Size(max = 2000) String originAddress,
        @DecimalMin("-90.0") @DecimalMax("90.0") Double originLatitude,
        @DecimalMin("-180.0") @DecimalMax("180.0") Double originLongitude,
        /** 클리닝(시간 배차) 전용 — 서비스 예정 시각. 클린차량이면 필수, 배송용이면 null. */
        Instant scheduledAt,
        /** 건별 소요시간(분). null 이면 설정 기본값. */
        @Min(5) @Max(1440) Integer serviceMinutes
) {}
