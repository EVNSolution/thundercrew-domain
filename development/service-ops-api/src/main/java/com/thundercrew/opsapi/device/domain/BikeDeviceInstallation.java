package com.thundercrew.opsapi.device.domain;

import com.thundercrew.opsapi.common.domain.DisplaySequencedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "bike_device_installations")
public class BikeDeviceInstallation extends DisplaySequencedEntity {

    @Column(nullable = false)
    private UUID bikeId;

    @Column(nullable = false)
    private UUID deviceId;

    @Column(nullable = false)
    private Instant installedAt;

    private Instant removedAt;

    private String memo;


    public java.util.UUID getBikeId() {
        return bikeId;
    }

    public java.util.UUID getDeviceId() {
        return deviceId;
    }

    public java.time.Instant getInstalledAt() {
        return installedAt;
    }

    public java.time.Instant getRemovedAt() {
        return removedAt;
    }

    public String getMemo() {
        return memo;
    }

    protected BikeDeviceInstallation() {
    }
}
