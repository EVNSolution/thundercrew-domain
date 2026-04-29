package com.thundercrew.opsapi.device.domain;

import com.thundercrew.opsapi.common.domain.DisplaySequencedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

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
