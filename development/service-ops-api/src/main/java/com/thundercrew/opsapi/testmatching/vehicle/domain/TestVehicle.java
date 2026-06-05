package com.thundercrew.opsapi.testmatching.vehicle.domain;

import com.thundercrew.opsapi.common.domain.DisplaySequencedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

@Entity
@Table(name = "test_vehicles")
public class TestVehicle extends DisplaySequencedEntity {

    @Column(nullable = false, length = 50)
    private String plateNumber;

    @Enumerated(EnumType.STRING)
    @Column(name = "bike_type", nullable = false, length = 20)
    private TestBikeType bikeType;

    @Enumerated(EnumType.STRING)
    @Column(name = "engine_type", nullable = false, length = 20)
    private TestEngineType engineType;

    @Column(length = 15)
    private String imei;

    public static TestVehicle create(
            String plateNumber, TestBikeType bikeType, TestEngineType engineType, String imei) {
        TestVehicle vehicle = new TestVehicle();
        vehicle.plateNumber = plateNumber;
        vehicle.bikeType = bikeType;
        vehicle.engineType = engineType;
        vehicle.imei = imei;
        return vehicle;
    }

    public String getPlateNumber() { return plateNumber; }
    public TestBikeType getBikeType() { return bikeType; }
    public TestEngineType getEngineType() { return engineType; }
    public String getImei() { return imei; }

    protected TestVehicle() {}
}
