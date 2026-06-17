package com.thundercrew.opsapi.riderauth.dto;

import com.thundercrew.opsapi.rider.domain.Rider;
import java.util.UUID;

public record RiderIdentityResponse(
        UUID id,
        String name,
        String phoneNumber
) {
    public static RiderIdentityResponse from(Rider rider) {
        return new RiderIdentityResponse(rider.getId(), rider.getName(), rider.getPhoneNumber());
    }
}
