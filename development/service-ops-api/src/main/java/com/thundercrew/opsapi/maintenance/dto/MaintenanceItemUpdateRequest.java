package com.thundercrew.opsapi.maintenance.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.thundercrew.opsapi.maintenance.domain.MaintenanceCategory;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.util.Set;

/**
 * 카탈로그 편집용 partial update. 모든 필드 optional — null 이면 변경 안 함.
 * categories 는 null 또는 빈 셋이면 기존 값을 유지 (updateCatalog 의 null-guard 참조).
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record MaintenanceItemUpdateRequest(
        @Size(max = 100) String name,
        Set<MaintenanceCategory> categories,
        @PositiveOrZero Integer cycleKm,
        @PositiveOrZero Integer cycleMonths,
        String memo
) {
}
