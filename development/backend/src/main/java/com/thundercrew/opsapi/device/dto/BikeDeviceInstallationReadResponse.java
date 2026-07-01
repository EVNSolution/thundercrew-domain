package com.thundercrew.opsapi.device.dto;

import com.thundercrew.opsapi.device.domain.BikeDeviceInstallation;
import java.time.Instant;
import java.util.UUID;

public record BikeDeviceInstallationReadResponse(
        UUID id,
        Long idx,
        UUID bikeId,
        UUID deviceId,
        Instant installedAt,
        Instant removedAt,
        String memo,
        Instant createdAt,
        Instant updatedAt
) {
    public static BikeDeviceInstallationReadResponse from(BikeDeviceInstallation installation) {
        return new BikeDeviceInstallationReadResponse(
                installation.getId(),
                installation.getIdx(),
                installation.getBikeId(),
                installation.getDeviceId(),
                installation.getInstalledAt(),
                installation.getRemovedAt(),
                installation.getMemo(),
                installation.getCreatedAt(),
                installation.getUpdatedAt()
        );
    }
}
