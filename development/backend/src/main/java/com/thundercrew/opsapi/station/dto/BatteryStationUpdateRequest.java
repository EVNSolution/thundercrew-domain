package com.thundercrew.opsapi.station.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.thundercrew.opsapi.station.domain.BatteryStationStatus;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

@JsonIgnoreProperties(ignoreUnknown = true)
public class BatteryStationUpdateRequest {

    @Size(max = 100)
    @Pattern(regexp = ".*\\S.*", message = "must not be blank when provided")
    private String name;

    @Size(max = 255)
    @Pattern(regexp = ".*\\S.*", message = "must not be blank when provided")
    private String address;

    @DecimalMin("-90.0")
    @DecimalMax("90.0")
    private BigDecimal latitude;

    @DecimalMin("-180.0")
    @DecimalMax("180.0")
    private BigDecimal longitude;

    private BatteryStationStatus status;

    private String memo;

    public String name() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String address() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public BigDecimal latitude() {
        return latitude;
    }

    public void setLatitude(BigDecimal latitude) {
        this.latitude = latitude;
    }

    public BigDecimal longitude() {
        return longitude;
    }

    public void setLongitude(BigDecimal longitude) {
        this.longitude = longitude;
    }

    public BatteryStationStatus status() {
        return status;
    }

    public void setStatus(BatteryStationStatus status) {
        this.status = status;
    }

    public String memo() {
        return memo;
    }

    public void setMemo(String memo) {
        this.memo = memo;
    }
}
