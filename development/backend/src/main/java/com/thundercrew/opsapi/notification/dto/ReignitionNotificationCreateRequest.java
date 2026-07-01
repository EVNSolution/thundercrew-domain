package com.thundercrew.opsapi.notification.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.UUID;

public record ReignitionNotificationCreateRequest(
        @NotNull UUID bikeId,
        @NotBlank String plateNumber,
        @NotNull Instant occurredAt,
        String nextCustomerName,
        String nextAddress,
        Double nextLatitude,
        Double nextLongitude
) {}
