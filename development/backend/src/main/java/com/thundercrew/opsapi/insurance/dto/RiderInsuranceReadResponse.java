package com.thundercrew.opsapi.insurance.dto;

import com.thundercrew.opsapi.insurance.domain.RiderInsurance;
import java.time.Instant;
import java.util.UUID;

public record RiderInsuranceReadResponse(
        UUID id,
        Long idx,
        UUID riderId,
        UUID insuranceItemId,
        String memo,
        boolean enabled,
        Instant startsAt,
        Instant endsAt,
        UUID riderBikeContractId,
        Instant createdAt,
        Instant updatedAt
) {
    public static RiderInsuranceReadResponse from(RiderInsurance riderInsurance) {
        return new RiderInsuranceReadResponse(
                riderInsurance.getId(),
                riderInsurance.getIdx(),
                riderInsurance.getRiderId(),
                riderInsurance.getInsuranceItemId(),
                riderInsurance.getMemo(),
                riderInsurance.isEnabled(),
                riderInsurance.getStartsAt(),
                riderInsurance.getEndsAt(),
                riderInsurance.getRiderBikeContractId(),
                riderInsurance.getCreatedAt(),
                riderInsurance.getUpdatedAt()
        );
    }
}
