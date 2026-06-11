package com.thundercrew.opsapi.tip.dto;

import com.thundercrew.opsapi.tip.domain.Tip;
import java.time.Instant;
import java.util.UUID;

public record TipReadResponse(
        UUID id,
        Long idx,
        String address,
        String content,
        double latitude,
        double longitude,
        Instant createdAt,
        Instant updatedAt
) {
    public static TipReadResponse from(Tip tip) {
        return new TipReadResponse(
                tip.getId(),
                tip.getIdx(),
                tip.getAddress(),
                tip.getContent(),
                tip.getLatitude(),
                tip.getLongitude(),
                tip.getCreatedAt(),
                tip.getUpdatedAt()
        );
    }
}
