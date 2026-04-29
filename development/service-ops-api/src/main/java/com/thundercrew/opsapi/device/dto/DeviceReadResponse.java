package com.thundercrew.opsapi.device.dto;

import com.thundercrew.opsapi.device.domain.Device;
import java.time.Instant;
import java.util.UUID;

public record DeviceReadResponse(
        UUID id,
        Long idx,
        String deviceUid,
        String manufacturer,
        String modelName,
        boolean enabled,
        String memo,
        Instant createdAt,
        Instant updatedAt
) {
    public static DeviceReadResponse from(Device device) {
        return new DeviceReadResponse(
                device.getId(),
                device.getIdx(),
                device.getDeviceUid(),
                device.getManufacturer(),
                device.getModelName(),
                device.isEnabled(),
                device.getMemo(),
                device.getCreatedAt(),
                device.getUpdatedAt()
        );
    }
}
