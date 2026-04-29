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

    protected BikeEquipment() {
    }
}
