package com.thundercrew.opsapi.device.domain;

import com.thundercrew.opsapi.common.domain.DisplaySequencedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "devices")
public class Device extends DisplaySequencedEntity {

    @Column(nullable = false, length = 100)
    private String deviceUid;

    @Column(length = 100)
    private String manufacturer;

    @Column(length = 100)
    private String modelName;

    @Column(nullable = false)
    private boolean enabled = true;

    private String memo;

    public static Device create(
            String deviceUid,
            String manufacturer,
            String modelName,
            Boolean enabled,
            String memo
    ) {
        Device device = new Device();
        device.deviceUid = deviceUid;
        device.manufacturer = manufacturer;
        device.modelName = modelName;
        device.enabled = enabled == null || enabled;
        device.memo = memo;
        return device;
    }

    public void updateOperatorManagedFields(
            String deviceUid,
            String manufacturer,
            String modelName,
            Boolean enabled,
            String memo
    ) {
        if (deviceUid != null) {
            this.deviceUid = deviceUid;
        }
        if (manufacturer != null) {
            this.manufacturer = manufacturer;
        }
        if (modelName != null) {
            this.modelName = modelName;
        }
        if (enabled != null) {
            this.enabled = enabled;
        }
        if (memo != null) {
            this.memo = memo;
        }
    }

    public void disableAndMarkDeleted(UUID actorId, Instant deletedAt) {
        this.enabled = false;
        markDeleted(actorId, deletedAt);
    }

    public String getDeviceUid() {
        return deviceUid;
    }

    public String getManufacturer() {
        return manufacturer;
    }

    public String getModelName() {
        return modelName;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public String getMemo() {
        return memo;
    }

    protected Device() {
    }
}
