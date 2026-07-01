package com.thundercrew.opsapi.device.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.UUID;

@JsonIgnoreProperties(ignoreUnknown = true)
public record BikeDeviceInstallationCreateRequest(
        @NotNull UUID bikeId,
        @NotNull UUID deviceId,
        @NotNull Instant installedAt,
        String memo
) {
}
