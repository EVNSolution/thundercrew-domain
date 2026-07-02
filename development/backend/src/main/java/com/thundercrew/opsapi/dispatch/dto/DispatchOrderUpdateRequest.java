package com.thundercrew.opsapi.dispatch.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

/**
 * 배차 주문 편집(전체 치환). 프론트가 편집 다이얼로그의 현재값 전체를 채워 보낸다.
 * sequence 는 선택 — null 이면 재배정 시 대상 큐 tail+1, 미재배정 시 현재 순번 유지.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record DispatchOrderUpdateRequest(
        @NotNull UUID bikeId,
        @NotBlank @Size(max = 255) String customerName,
        @NotBlank @Size(max = 255) String customerPhone,
        @NotBlank @Size(max = 2000) String address,
        @DecimalMin("-90.0") @DecimalMax("90.0") double latitude,
        @DecimalMin("-180.0") @DecimalMax("180.0") double longitude,
        Long sequence
) {}
