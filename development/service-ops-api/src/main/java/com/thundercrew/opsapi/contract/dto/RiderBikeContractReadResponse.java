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
        UUID autoIssuedRiderInsuranceId,
        String autoInsuranceSkipReason,
        Instant createdAt,
        Instant updatedAt
) {
    public static RiderBikeContractReadResponse from(RiderBikeContract contract) {
        return from(contract, null, null);
    }

    /**
     * Used by {@code create} when the service has just attempted automatic
     * insurance issuance off the matching contract template:
     * <ul>
     *   <li>{@code autoIssuedRiderInsuranceId} carries the new RiderInsurance id when it succeeded.</li>
     *   <li>{@code autoInsuranceSkipReason} carries a short SKIP token when the
     *       service intentionally did not issue (already linked, item disabled,
     *       etc.). Both fields stay {@code null} when the template did not opt
     *       in to automatic issuance.</li>
     * </ul>
     */
    public static RiderBikeContractReadResponse from(
            RiderBikeContract contract,
            UUID autoIssuedRiderInsuranceId,
            String autoInsuranceSkipReason
    ) {
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
                autoIssuedRiderInsuranceId,
                autoInsuranceSkipReason,
                contract.getCreatedAt(),
                contract.getUpdatedAt()
        );
    }
}
