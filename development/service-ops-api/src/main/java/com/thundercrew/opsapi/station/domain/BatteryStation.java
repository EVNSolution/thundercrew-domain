package com.thundercrew.opsapi.station.domain;

import com.thundercrew.opsapi.common.domain.DisplaySequencedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.math.BigDecimal;

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

    protected BatteryStation() {
    }
}
