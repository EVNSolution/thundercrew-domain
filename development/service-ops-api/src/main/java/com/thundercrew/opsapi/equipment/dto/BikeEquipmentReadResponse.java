package com.thundercrew.opsapi.equipment.dto;

import com.thundercrew.opsapi.equipment.domain.BikeEquipment;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record BikeEquipmentReadResponse(
        UUID id,
        Long idx,
        UUID bikeId,
        UUID equipmentTypeId,
        String equipmentLabel,
        String modelName,
        String serialNumber,
        Instant installedAt,
        Instant removedAt,
        LocalDate managementDueDate,
        String managementNote,
        String memo,
        Instant createdAt,
        Instant updatedAt
) {
    public static BikeEquipmentReadResponse from(BikeEquipment equipment) {
        return new BikeEquipmentReadResponse(
                equipment.getId(),
                equipment.getIdx(),
                equipment.getBikeId(),
                equipment.getEquipmentTypeId(),
                equipment.getEquipmentLabel(),
                equipment.getModelName(),
                equipment.getSerialNumber(),
                equipment.getInstalledAt(),
                equipment.getRemovedAt(),
                equipment.getManagementDueDate(),
                equipment.getManagementNote(),
                equipment.getMemo(),
                equipment.getCreatedAt(),
                equipment.getUpdatedAt()
        );
    }
}
