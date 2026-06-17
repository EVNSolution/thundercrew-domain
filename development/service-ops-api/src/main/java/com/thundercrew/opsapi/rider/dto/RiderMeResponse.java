package com.thundercrew.opsapi.rider.dto;

import java.util.UUID;

public record RiderMeResponse(
        UUID id,
        String name,
        String phoneNumber,
        String teamName,
        String areaName,
        UUID activeBikeId
) {
}
