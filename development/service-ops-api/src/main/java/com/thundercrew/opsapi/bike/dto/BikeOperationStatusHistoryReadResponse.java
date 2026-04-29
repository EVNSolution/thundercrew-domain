package com.thundercrew.opsapi.bike.dto;

import com.thundercrew.opsapi.bike.domain.BikeOperationStatus;
import com.thundercrew.opsapi.bike.domain.BikeOperationStatusHistory;
import java.time.Instant;
import java.util.UUID;

public record BikeOperationStatusHistoryReadResponse(
        UUID id,
        Long idx,
        UUID bikeId,
        BikeOperationStatus operationStatus,
        Instant startedAt,
        Instant endedAt,
        String reason,
        String memo,
        UUID changedBy,
        Instant createdAt,
        Instant updatedAt
) {
    public static BikeOperationStatusHistoryReadResponse from(BikeOperationStatusHistory history) {
        return new BikeOperationStatusHistoryReadResponse(
                history.getId(),
                history.getIdx(),
                history.getBikeId(),
                history.getOperationStatus(),
                history.getStartedAt(),
                history.getEndedAt(),
                history.getReason(),
                history.getMemo(),
                history.getChangedBy(),
                history.getCreatedAt(),
                history.getUpdatedAt()
        );
    }
}
