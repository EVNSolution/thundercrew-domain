package com.thundercrew.opsapi.bike.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotNull;

/**
 * 차량 시동 방지 토글 요청. true 면 차단 ON, false 면 차단 해제.
 * (vendor 측 실제 명령 전달은 별도 슬라이스에서 처리.)
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record BikeIgnitionBlockRequest(
        @NotNull Boolean blocked
) {
}
