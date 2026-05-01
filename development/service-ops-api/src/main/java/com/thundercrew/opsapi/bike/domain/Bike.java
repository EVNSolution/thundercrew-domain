package com.thundercrew.opsapi.bike.domain;

import com.thundercrew.opsapi.common.domain.DisplaySequencedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

@Entity
@Table(name = "bikes")
public class Bike extends DisplaySequencedEntity {

    @Column(nullable = false, length = 50)
    private String plateNumber;

    @Column(nullable = false, length = 100)
    private String vin;

    @Column(length = 100)
    private String modelName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private BikeOperationStatus operationStatus;

    private String memo;

    public static Bike create(
            String plateNumber,
            String vin,
            String modelName,
            BikeOperationStatus operationStatus,
            String memo
    ) {
        Bike bike = new Bike();
        bike.plateNumber = plateNumber;
        bike.vin = vin;
        bike.modelName = modelName;
        bike.operationStatus = operationStatus;
        bike.memo = memo;
        return bike;
    }

    public void updateBasicProfile(
            String plateNumber,
            String vin,
            String modelName,
            String memo
    ) {
        if (plateNumber != null) {
            this.plateNumber = plateNumber;
        }
        if (vin != null) {
            this.vin = vin;
        }
        if (modelName != null) {
            this.modelName = modelName;
        }
        if (memo != null) {
            this.memo = memo;
        }
    }

    public void changeOperationStatus(BikeOperationStatus operationStatus) {
        this.operationStatus = operationStatus;
    }


    public String getPlateNumber() {
        return plateNumber;
    }

    public String getVin() {
        return vin;
    }

    public String getModelName() {
        return modelName;
    }

    public BikeOperationStatus getOperationStatus() {
        return operationStatus;
    }

    public String getMemo() {
        return memo;
    }

    protected Bike() {
    }
}
