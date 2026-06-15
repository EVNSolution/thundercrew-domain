package com.thundercrew.opsapi.maintenance.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.thundercrew.opsapi.maintenance.domain.MaintenanceAppliesTo;
import com.thundercrew.opsapi.maintenance.domain.MaintenanceWheelApplies;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.util.UUID;

/**
 * 카탈로그 편집용 partial update. 모든 필드 optional — null 이면 변경 안 함.
 * 단, `parentItemId` / `cycleKm` / `cycleMonths` / `cycleLabel` 은 명시적
 * null 도 "값 비움" 의미로 그대로 반영. 다른 필드와 구분을 두는 이유는
 * 카탈로그 편집 화면이 항상 전체 cycle 필드를 채워서 보내고, "그룹 해제" /
 * "cycle 값 제거" 같은 케이스를 자연스럽게 표현해야 하기 때문.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record MaintenanceItemUpdateRequest(
        @Size(max = 100) String name,
        MaintenanceAppliesTo appliesTo,
        MaintenanceWheelApplies appliesToWheel,
        UUID parentItemId,
        @PositiveOrZero Integer cycleKm,
        @PositiveOrZero Integer cycleMonths,
        @Size(max = 50) String cycleLabel,
        @PositiveOrZero Integer displayOrder,
        Boolean enabled,
        String memo
) {
}
