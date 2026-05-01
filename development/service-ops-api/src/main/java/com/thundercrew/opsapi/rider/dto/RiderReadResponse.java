package com.thundercrew.opsapi.rider.dto;

import com.thundercrew.opsapi.rider.domain.Rider;
import java.time.Instant;
import java.util.UUID;

public record RiderReadResponse(
        UUID id,
        Long idx,
        String name,
        String phoneNumber,
        String teamName,
        String areaName,
        boolean appAccountLinked,
        UUID appAccountId,
        Instant appLinkedAt,
        String appLinkStatus,
        String memo,
        Instant createdAt,
        Instant updatedAt
) {
    public static RiderReadResponse from(Rider rider) {
        return new RiderReadResponse(
                rider.getId(),
                rider.getIdx(),
                rider.getName(),
                rider.getPhoneNumber(),
                rider.getTeamName(),
                rider.getAreaName(),
                rider.isAppAccountLinked(),
                rider.getAppAccountId(),
                rider.getAppLinkedAt(),
                rider.isAppAccountLinked() ? "LINKED" : "NOT_LINKED",
                rider.getMemo(),
                rider.getCreatedAt(),
                rider.getUpdatedAt()
        );
    }
}
