package com.thundercrew.opsapi.equipment.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.time.Instant;

@JsonIgnoreProperties(ignoreUnknown = true)
public record BikeEquipmentRemoveRequest(
        Instant removedAt,
        String memo
) {
}
