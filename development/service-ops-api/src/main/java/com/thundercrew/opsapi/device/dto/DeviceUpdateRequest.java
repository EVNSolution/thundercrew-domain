package com.thundercrew.opsapi.device.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@JsonIgnoreProperties(ignoreUnknown = true)
public class DeviceUpdateRequest {

    @Size(max = 100)
    @Pattern(regexp = ".*\\S.*", message = "must not be blank when provided")
    private String deviceUid;

    @Size(max = 100)
    private String manufacturer;

    @Size(max = 100)
    private String modelName;

    private Boolean enabled;

    private String memo;

    public String deviceUid() {
        return deviceUid;
    }

    public void setDeviceUid(String deviceUid) {
        this.deviceUid = deviceUid;
    }

    public String manufacturer() {
        return manufacturer;
    }

    public void setManufacturer(String manufacturer) {
        this.manufacturer = manufacturer;
    }

    public String modelName() {
        return modelName;
    }

    public void setModelName(String modelName) {
        this.modelName = modelName;
    }

    public Boolean enabled() {
        return enabled;
    }

    public void setEnabled(Boolean enabled) {
        this.enabled = enabled;
    }

    public String memo() {
        return memo;
    }

    public void setMemo(String memo) {
        this.memo = memo;
    }
}
