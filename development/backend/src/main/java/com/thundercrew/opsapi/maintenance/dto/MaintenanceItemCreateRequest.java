package com.thundercrew.opsapi.maintenance.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.thundercrew.opsapi.maintenance.domain.MaintenanceCategory;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.util.Set;

@JsonIgnoreProperties(ignoreUnknown = true)
public record MaintenanceItemCreateRequest(
        @NotBlank @Size(max = 100) String name,
        @NotEmpty Set<MaintenanceCategory> categories,
        @PositiveOrZero Integer cycleKm,
        @PositiveOrZero Integer cycleMonths,
        String memo,
        @Min(0) @Max(100) Integer alertThresholdPercent
) {
}
