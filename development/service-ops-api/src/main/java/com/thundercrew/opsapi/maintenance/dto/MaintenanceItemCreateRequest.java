package com.thundercrew.opsapi.maintenance.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.thundercrew.opsapi.maintenance.domain.MaintenanceAppliesTo;
import com.thundercrew.opsapi.maintenance.domain.MaintenanceWheelApplies;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.util.UUID;

@JsonIgnoreProperties(ignoreUnknown = true)
public record MaintenanceItemCreateRequest(
        @NotBlank @Size(max = 100) String name,
        @NotNull MaintenanceAppliesTo appliesTo,
        @NotNull MaintenanceWheelApplies appliesToWheel,
        UUID parentItemId,
        @PositiveOrZero Integer cycleKm,
        @PositiveOrZero Integer cycleMonths,
        @Size(max = 50) String cycleLabel,
        @PositiveOrZero Integer displayOrder,
        String memo
) {
}
