package com.thundercrew.opsapi.telemetry.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "bike_recent_states")
public class BikeRecentState {

    @Id
    @Column(nullable = false, updatable = false)
    private UUID id = UUID.randomUUID();

    @Column(nullable = false, insertable = false, updatable = false)
    private Long idx;

    @Column(nullable = false)
    private UUID bikeId;

    private UUID deviceId;

    private UUID telemetryLogId;

    @Column(nullable = false)
    private Instant receivedAt;

    @Column(precision = 10, scale = 7)
    private BigDecimal latitude;

    @Column(precision = 10, scale = 7)
    private BigDecimal longitude;

    @Column(precision = 8, scale = 2)
    private BigDecimal speedKph;

    @Column(precision = 5, scale = 2)
    private BigDecimal batteryPercent;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TelemetryIgnitionStatus ignitionStatus;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TelemetrySource telemetrySource;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    public static BikeRecentState from(DeviceTelemetryLog log) {
        BikeRecentState state = new BikeRecentState();
        state.bikeId = log.getBikeId();
        state.deviceId = log.getDeviceId();
        state.telemetryLogId = log.getId();
        state.receivedAt = log.getReceivedAt();
        state.latitude = log.getLatitude();
        state.longitude = log.getLongitude();
        state.speedKph = log.getSpeedKph();
        state.batteryPercent = log.getBatteryPercent();
        state.ignitionStatus = log.getIgnitionStatus();
        state.telemetrySource = log.getTelemetrySource();
        return state;
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public UUID getId() {
        return id;
    }

    public Long getIdx() {
        return idx;
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

    public Instant getReceivedAt() {
        return receivedAt;
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

    public TelemetryIgnitionStatus getIgnitionStatus() {
        return ignitionStatus;
    }

    public TelemetrySource getTelemetrySource() {
        return telemetrySource;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    protected BikeRecentState() {
    }
}
