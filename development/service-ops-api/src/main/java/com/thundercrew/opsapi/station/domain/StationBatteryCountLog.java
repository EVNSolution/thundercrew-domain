package com.thundercrew.opsapi.station.domain;

import com.thundercrew.opsapi.common.domain.DisplaySequencedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "station_battery_count_logs")
public class StationBatteryCountLog extends DisplaySequencedEntity {

    @Column(nullable = false)
    private UUID stationId;

    @Column(nullable = false)
    private int beforeMaxBatteryCapacity;

    @Column(nullable = false)
    private int afterMaxBatteryCapacity;

    @Column(nullable = false)
    private int beforeCurrentBatteryCount;

    @Column(nullable = false)
    private int afterCurrentBatteryCount;

    @Column(nullable = false)
    private int beforeAvailableBatteryCount;

    @Column(nullable = false)
    private int afterAvailableBatteryCount;

    @Column(length = 100)
    private String reason;

    private String memo;

    @Column(nullable = false)
    private Instant changedAt;

    private UUID changedBy;

    protected StationBatteryCountLog() {
    }
}
