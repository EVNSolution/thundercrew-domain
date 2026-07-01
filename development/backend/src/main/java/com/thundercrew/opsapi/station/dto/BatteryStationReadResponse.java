package com.thundercrew.opsapi.station.dto;

import com.thundercrew.opsapi.station.domain.BatteryStation;
import com.thundercrew.opsapi.station.domain.BatteryStationStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record BatteryStationReadResponse(
        UUID id,
        Long idx,
        String name,
        String address,
        BigDecimal latitude,
        BigDecimal longitude,
        BatteryStationStatus status,
        int maxBatteryCapacity,
        int currentBatteryCount,
        int availableBatteryCount,
        String availableBatteryLabel,
        int capacityPercentage,
        String memo,
        Instant createdAt,
        Instant updatedAt
) {
    public static BatteryStationReadResponse from(BatteryStation station) {
        return new BatteryStationReadResponse(
                station.getId(),
                station.getIdx(),
                station.getName(),
                station.getAddress(),
                station.getLatitude(),
                station.getLongitude(),
                station.getStatus(),
                station.getMaxBatteryCapacity(),
                station.getCurrentBatteryCount(),
                station.getAvailableBatteryCount(),
                station.getAvailableBatteryCount() + "/" + station.getMaxBatteryCapacity(),
                calculateCapacityPercentage(station),
                station.getMemo(),
                station.getCreatedAt(),
                station.getUpdatedAt()
        );
    }

    private static int calculateCapacityPercentage(BatteryStation station) {
        if (station.getMaxBatteryCapacity() == 0) {
            return 0;
        }
        return Math.round((station.getCurrentBatteryCount() * 100.0f) / station.getMaxBatteryCapacity());
    }
}
