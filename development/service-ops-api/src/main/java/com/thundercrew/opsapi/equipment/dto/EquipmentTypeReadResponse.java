package com.thundercrew.opsapi.equipment.dto;

import com.thundercrew.opsapi.equipment.domain.EquipmentType;
import java.time.Instant;
import java.util.UUID;

public record EquipmentTypeReadResponse(
        UUID id,
        Long idx,
        String name,
        String description,
        boolean enabled,
        Instant createdAt,
        Instant updatedAt
) {
    public static EquipmentTypeReadResponse from(EquipmentType type) {
        return new EquipmentTypeReadResponse(
                type.getId(),
                type.getIdx(),
                type.getName(),
                type.getDescription(),
                type.isEnabled(),
                type.getCreatedAt(),
                type.getUpdatedAt()
        );
    }
}
