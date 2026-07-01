package com.thundercrew.opsapi.equipment.domain;

import com.thundercrew.opsapi.common.domain.DisplaySequencedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "bike_equipments")
public class BikeEquipment extends DisplaySequencedEntity {

    @Column(nullable = false)
    private UUID bikeId;

    @Column(nullable = false)
    private UUID equipmentTypeId;

    @Column(length = 100)
    private String equipmentLabel;

    @Column(length = 100)
    private String modelName;

    @Column(length = 100)
    private String serialNumber;

    @Column(nullable = false)
    private Instant installedAt;

    private Instant removedAt;

    @Column(nullable = false)
    private LocalDate managementDueDate;

    private String managementNote;

    private String memo;


    public static BikeEquipment create(
            UUID bikeId,
            UUID equipmentTypeId,
            String equipmentLabel,
            String modelName,
            String serialNumber,
            Instant installedAt,
            LocalDate managementDueDate,
            String managementNote,
            String memo
    ) {
        BikeEquipment equipment = new BikeEquipment();
        equipment.bikeId = bikeId;
        equipment.equipmentTypeId = equipmentTypeId;
        equipment.equipmentLabel = equipmentLabel;
        equipment.modelName = modelName;
        equipment.serialNumber = serialNumber;
        equipment.installedAt = installedAt;
        equipment.managementDueDate = managementDueDate;
        equipment.managementNote = managementNote;
        equipment.memo = memo;
        return equipment;
    }

    public void updateOperatorManagedFields(
            String equipmentLabel,
            String modelName,
            String serialNumber,
            LocalDate managementDueDate,
            String managementNote,
            String memo
    ) {
        if (equipmentLabel != null) {
            this.equipmentLabel = equipmentLabel;
        }
        if (modelName != null) {
            this.modelName = modelName;
        }
        if (serialNumber != null) {
            this.serialNumber = serialNumber;
        }
        if (managementDueDate != null) {
            this.managementDueDate = managementDueDate;
        }
        if (managementNote != null) {
            this.managementNote = managementNote;
        }
        if (memo != null) {
            this.memo = memo;
        }
    }

    public void remove(Instant removedAt, String memo) {
        this.removedAt = removedAt;
        if (memo != null) {
            this.memo = memo;
        }
    }

    public java.util.UUID getBikeId() {
        return bikeId;
    }

    public java.util.UUID getEquipmentTypeId() {
        return equipmentTypeId;
    }

    public String getEquipmentLabel() {
        return equipmentLabel;
    }

    public String getModelName() {
        return modelName;
    }

    public String getSerialNumber() {
        return serialNumber;
    }

    public java.time.Instant getInstalledAt() {
        return installedAt;
    }

    public java.time.Instant getRemovedAt() {
        return removedAt;
    }

    public java.time.LocalDate getManagementDueDate() {
        return managementDueDate;
    }

    public String getManagementNote() {
        return managementNote;
    }

    public String getMemo() {
        return memo;
    }

    protected BikeEquipment() {
    }
}
