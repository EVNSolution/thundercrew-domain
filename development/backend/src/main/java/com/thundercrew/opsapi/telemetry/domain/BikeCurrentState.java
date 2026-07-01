package com.thundercrew.opsapi.telemetry.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "bike_current_states")
public class BikeCurrentState {

    @Id
    @Column(nullable = false)
    private UUID bikeId;

    private UUID deviceId;

    private UUID telemetryLogId;

    @Column(nullable = false)
    private Instant lastReceivedAt;

    @Column(precision = 10, scale = 7)
    private BigDecimal latitude;

    @Column(precision = 10, scale = 7)
    private BigDecimal longitude;

    @Column(precision = 8, scale = 2)
    private BigDecimal speedKph;

    @Column(precision = 5, scale = 2)
    private BigDecimal batteryPercent;

    /** 누적 주행거리 (km). 벤더 페이로드에 없으면 null. */
    private Integer odometerKm;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TelemetryIgnitionStatus ignitionStatus;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TelemetrySource telemetrySource;

    @Column(nullable = false)
    private Instant updatedAt;

    public static BikeCurrentState from(DeviceTelemetryLog log) {
        BikeCurrentState state = new BikeCurrentState();
        state.bikeId = log.getBikeId();
        state.copyFrom(log);
        return state;
    }

    private void copyFrom(DeviceTelemetryLog log) {
        this.deviceId = log.getDeviceId();
        this.telemetryLogId = log.getId();
        this.lastReceivedAt = log.getReceivedAt();
        this.latitude = log.getLatitude();
        this.longitude = log.getLongitude();
        this.speedKph = log.getSpeedKph();
        this.batteryPercent = log.getBatteryPercent();
        this.odometerKm = log.getOdometerKm();
        this.ignitionStatus = log.getIgnitionStatus();
        this.telemetrySource = log.getTelemetrySource();
        this.updatedAt = Instant.now();
    }

    @PrePersist
    @PreUpdate
    void onSave() {
        if (updatedAt == null) {
            updatedAt = Instant.now();
        }
    }

    public UUID getBikeId() {
        return bikeId;
    }

    public UUID getDeviceId() {
        return deviceId;
    }

    public UUID getTelemetryLogId() {
        return telemetryLogId;
    }

    public Instant getLastReceivedAt() {
        return lastReceivedAt;
    }

    public BigDecimal getLatitude() {
        return latitude;
    }

    public BigDecimal getLongitude() {
        return longitude;
    }

    public BigDecimal getSpeedKph() {
        return speedKph;
    }

    public BigDecimal getBatteryPercent() {
        return batteryPercent;
    }

    public Integer getOdometerKm() {
        return odometerKm;
    }

    public TelemetryIgnitionStatus getIgnitionStatus() {
        return ignitionStatus;
    }

    public TelemetrySource getTelemetrySource() {
        return telemetrySource;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    protected BikeCurrentState() {
    }
}
