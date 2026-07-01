package com.thundercrew.opsapi.dispatch.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record DeliveryCallAcceptRequest(@NotNull UUID bikeId) {
}
