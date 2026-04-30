package com.thundercrew.opsapi.station.domain;

import com.thundercrew.opsapi.common.domain.DisplaySequencedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "battery_stations")
public class BatteryStation extends DisplaySequencedEntity {

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, length = 255)
    private String address;

    @Column(nullable = false, precision = 10, scale = 7)
    private BigDecimal latitude;

    @Column(nullable = false, precision = 10, scale = 7)
    private BigDecimal longitude;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private BatteryStationStatus status;

    @Column(nullable = false)
    private int maxBatteryCapacity;

    @Column(nullable = false)
    private int currentBatteryCount;

    @Column(nullable = false)
    private int availableBatteryCount;

    private String memo;

    public static BatteryStation create(
            String name,
            String address,
            BigDecimal latitude,
            BigDecimal longitude,
            BatteryStationStatus status,
            int maxBatteryCapacity,
            int currentBatteryCount,
            int availableBatteryCount,
            String memo
    ) {
        BatteryStation station = new BatteryStation();
        station.name = name;
        station.address = address;
        station.latitude = latitude;
        station.longitude = longitude;
        station.status = status;
        station.maxBatteryCapacity = maxBatteryCapacity;
        station.currentBatteryCount = currentBatteryCount;
        station.availableBatteryCount = availableBatteryCount;
        station.memo = memo;
        return station;
    }

    public void updateOperatorManagedFields(
            String name,
            String address,
            BigDecimal latitude,
            BigDecimal longitude,
            BatteryStationStatus status,
            String memo
    ) {
        if (name != null) {
            this.name = name;
        }
        if (address != null) {
            this.address = address;
        }
        if (latitude != null) {
            this.latitude = latitude;
        }
        if (longitude != null) {
            this.longitude = longitude;
        }
        if (status != null) {
            this.status = status;
        }
        if (memo != null) {
            this.memo = memo;
        }
    }

    public void updateBatteryCounts(
            int maxBatteryCapacity,
            int currentBatteryCount,
            int availableBatteryCount
    ) {
        this.maxBatteryCapacity = maxBatteryCapacity;
        this.currentBatteryCount = currentBatteryCount;
        this.availableBatteryCount = availableBatteryCount;
    }

    public void markInactiveAndDeleted(UUID actorId, Instant deletedAt) {
        this.status = BatteryStationStatus.INACTIVE;
        markDeleted(actorId, deletedAt);
    }

    public String getName() {
        return name;
    }

    public String getAddress() {
        return address;
    }

    public java.math.BigDecimal getLatitude() {
        return latitude;
    }

    public java.math.BigDecimal getLongitude() {
        return longitude;
    }

    public BatteryStationStatus getStatus() {
        return status;
    }

    public int getMaxBatteryCapacity() {
        return maxBatteryCapacity;
    }

    public int getCurrentBatteryCount() {
        return currentBatteryCount;
    }

    public int getAvailableBatteryCount() {
        return availableBatteryCount;
    }

    public String getMemo() {
        return memo;
    }

    protected BatteryStation() {
    }
}
