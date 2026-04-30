package com.thundercrew.opsapi.station.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

@JsonIgnoreProperties(ignoreUnknown = true)
public record BatteryStationCountUpdateRequest(
        @NotNull @PositiveOrZero Integer maxBatteryCapacity,
        @NotNull @PositiveOrZero Integer currentBatteryCount,
        @NotNull @PositiveOrZero Integer availableBatteryCount,
        @Size(max = 100) String reason,
        String memo
) {
}
