package com.thundercrew.opsapi.station.dto;

import com.thundercrew.opsapi.station.domain.StationBatteryCountLog;
import java.time.Instant;
import java.util.UUID;

public record StationBatteryCountLogReadResponse(
        UUID id,
        Long idx,
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
        UUID changedBy,
        Instant createdAt,
        Instant updatedAt
) {
    public static StationBatteryCountLogReadResponse from(StationBatteryCountLog log) {
        return new StationBatteryCountLogReadResponse(
                log.getId(),
                log.getIdx(),
                log.getStationId(),
                log.getBeforeMaxBatteryCapacity(),
                log.getAfterMaxBatteryCapacity(),
                log.getBeforeCurrentBatteryCount(),
                log.getAfterCurrentBatteryCount(),
                log.getBeforeAvailableBatteryCount(),
                log.getAfterAvailableBatteryCount(),
                log.getReason(),
                log.getMemo(),
                log.getChangedAt(),
                log.getChangedBy(),
                log.getCreatedAt(),
                log.getUpdatedAt()
        );
    }
}
