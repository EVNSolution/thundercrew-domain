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

    @Column(length = 100)
    private String vin;

    @Column(length = 100)
    private String modelName;

    /**
     * 동력 종류 — 정비 catalog 매칭과 운영자 필터의 1차 분류 키. 자유
     * 텍스트인 modelName 과 별도로 enum 으로 박아 분기 비용을 줄인다. 기존
     * 행은 V21 마이그레이션에서 ELECTRIC 으로 기본값 잡힘.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "engine_type", nullable = false, length = 20)
    private BikeEngineType engineType;

    @Enumerated(EnumType.STRING)
    @Column(name = "wheel_type", nullable = false, length = 20)
    private BikeWheelType wheelType = BikeWheelType.TWO_WHEEL;

    @Column(length = 15)
    private String imei;

    @Enumerated(EnumType.STRING)
    @Column(name = "service_type", nullable = false, length = 20)
    private BikeServiceType serviceType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private BikeOperationStatus operationStatus;

    /**
     * "시동 방지" 운영자 토글. true 면 vendor 측에 시동 차단 명령을 전달할
     * 의도가 있는 상태. 실제 차량 측 명령 전달은 vendor telemetry adapter
     * 슬라이스에서 처리되고, 여기서는 운영자 intent 의 영속화가 1차 책임.
     */
    @Column(name = "ignition_blocked", nullable = false)
    private boolean ignitionBlocked;

    private String memo;

    public static Bike create(
            String plateNumber,
            String vin,
            String modelName,
            BikeEngineType engineType,
            BikeServiceType serviceType,
            BikeOperationStatus operationStatus,
            String memo
    ) {
        Bike bike = new Bike();
        bike.plateNumber = plateNumber;
        bike.vin = vin;
        bike.modelName = modelName;
        bike.engineType = engineType;
        bike.serviceType = serviceType;
        bike.operationStatus = operationStatus;
        bike.memo = memo;
        return bike;
    }

    public void updateBasicProfile(
            String plateNumber,
            String vin,
            String modelName,
            BikeEngineType engineType,
            BikeServiceType serviceType,
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
        if (engineType != null) {
            this.engineType = engineType;
        }
        if (serviceType != null) {
            this.serviceType = serviceType;
        }
        if (memo != null) {
            this.memo = memo;
        }
    }

    public void changeOperationStatus(BikeOperationStatus operationStatus) {
        this.operationStatus = operationStatus;
    }

    public void setIgnitionBlocked(boolean ignitionBlocked) {
        this.ignitionBlocked = ignitionBlocked;
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

    public BikeEngineType getEngineType() {
        return engineType;
    }

    public BikeServiceType getServiceType() {
        return serviceType;
    }

    public BikeOperationStatus getOperationStatus() {
        return operationStatus;
    }

    public String getMemo() {
        return memo;
    }

    public boolean isIgnitionBlocked() {
        return ignitionBlocked;
    }

    public BikeWheelType getWheelType() {
        return wheelType;
    }

    public void setWheelType(BikeWheelType wheelType) {
        this.wheelType = wheelType;
    }

    public String getImei() {
        return imei;
    }

    public void setImei(String imei) {
        this.imei = imei;
    }

    protected Bike() {
    }
}
