package com.thundercrew.opsapi.equipment.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@JsonIgnoreProperties(ignoreUnknown = true)
public record BikeEquipmentCreateRequest(
        @NotNull UUID bikeId,
        @NotNull UUID equipmentTypeId,
        @Size(max = 100) String equipmentLabel,
        @Size(max = 100) String modelName,
        @Size(max = 100) String serialNumber,
        @NotNull Instant installedAt,
        @NotNull LocalDate managementDueDate,
        String managementNote,
        String memo
) {
}
