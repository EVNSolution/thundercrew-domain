package com.thundercrew.opsapi.dispatch.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;

/**
 * One already-geocoded dispatch row submitted by the frontend to the JSON apply endpoint.
 *
 * <p>The frontend takes a NEW preview row, geocodes its address into {@code latitude}/{@code
 * longitude}, and posts the resulting rows here. Coordinates are required because the backend does
 * not geocode.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record DispatchBulkApplyRow(
        @NotNull UUID bikeId,
        @NotBlank @Size(max = 255) String customerName,
        @NotBlank @Size(max = 255) String customerPhone,
        @NotBlank @Size(max = 2000) String address,
        @DecimalMin("-90.0") @DecimalMax("90.0") double latitude,
        @DecimalMin("-180.0") @DecimalMax("180.0") double longitude,
        Long sequence,
        String originAddress,
        Double originLatitude,
        Double originLongitude,
        /** 클리닝(시간 배차) 업로드 전용 — 서비스 예정 시각. 배송 업로드는 null. */
        Instant scheduledAt,
        Integer serviceMinutes
) {}
