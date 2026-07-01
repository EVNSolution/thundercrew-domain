package com.thundercrew.opsapi.device.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.time.Instant;

@JsonIgnoreProperties(ignoreUnknown = true)
public record BikeDeviceInstallationRemoveRequest(
        Instant removedAt,
        String memo
) {
}
