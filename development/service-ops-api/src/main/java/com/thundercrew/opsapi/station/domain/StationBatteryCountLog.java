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

    public static StationBatteryCountLog create(
            UUID stationId,
            int beforeMaxBatteryCapacity,
            int afterMaxBatteryCapacity,
            int beforeCurrentBatteryCount,
            int afterCurrentBatteryCount,
            int beforeAvailableBatteryCount,
            int afterAvailableBatteryCount,
            String reason,
            String memo,
            Instant changedAt,
            UUID changedBy
    ) {
        StationBatteryCountLog log = new StationBatteryCountLog();
        log.stationId = stationId;
        log.beforeMaxBatteryCapacity = beforeMaxBatteryCapacity;
        log.afterMaxBatteryCapacity = afterMaxBatteryCapacity;
        log.beforeCurrentBatteryCount = beforeCurrentBatteryCount;
        log.afterCurrentBatteryCount = afterCurrentBatteryCount;
        log.beforeAvailableBatteryCount = beforeAvailableBatteryCount;
        log.afterAvailableBatteryCount = afterAvailableBatteryCount;
        log.reason = reason;
        log.memo = memo;
        log.changedAt = changedAt;
        log.changedBy = changedBy;
        return log;
    }

    public java.util.UUID getStationId() {
        return stationId;
    }

    public int getBeforeMaxBatteryCapacity() {
        return beforeMaxBatteryCapacity;
    }

    public int getAfterMaxBatteryCapacity() {
        return afterMaxBatteryCapacity;
    }

    public int getBeforeCurrentBatteryCount() {
        return beforeCurrentBatteryCount;
    }

    public int getAfterCurrentBatteryCount() {
        return afterCurrentBatteryCount;
    }

    public int getBeforeAvailableBatteryCount() {
        return beforeAvailableBatteryCount;
    }

    public int getAfterAvailableBatteryCount() {
        return afterAvailableBatteryCount;
    }

    public String getReason() {
        return reason;
    }

    public String getMemo() {
        return memo;
    }

    public java.time.Instant getChangedAt() {
        return changedAt;
    }

    public java.util.UUID getChangedBy() {
        return changedBy;
    }

    protected StationBatteryCountLog() {
    }
}
