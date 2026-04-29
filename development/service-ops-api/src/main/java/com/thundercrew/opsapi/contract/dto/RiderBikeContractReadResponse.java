package com.thundercrew.opsapi.contract.dto;

import com.thundercrew.opsapi.contract.domain.RiderBikeContract;
import java.time.Instant;
import java.util.UUID;

public record RiderBikeContractReadResponse(
        UUID id,
        Long idx,
        UUID riderId,
        UUID bikeId,
        UUID contractTemplateId,
        Instant startAt,
        Instant endAt,
        Instant terminatedAt,
        String terminatedReason,
        String memo,
        Instant createdAt,
        Instant updatedAt
) {
    public static RiderBikeContractReadResponse from(RiderBikeContract contract) {
        return new RiderBikeContractReadResponse(
                contract.getId(),
                contract.getIdx(),
                contract.getRiderId(),
                contract.getBikeId(),
                contract.getContractTemplateId(),
                contract.getStartAt(),
                contract.getEndAt(),
                contract.getTerminatedAt(),
                contract.getTerminatedReason(),
                contract.getMemo(),
                contract.getCreatedAt(),
                contract.getUpdatedAt()
        );
    }
}
