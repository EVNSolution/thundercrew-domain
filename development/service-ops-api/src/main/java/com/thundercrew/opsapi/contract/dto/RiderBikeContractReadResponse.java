package com.thundercrew.opsapi.contract.dto;

import com.thundercrew.opsapi.bike.domain.BikeServiceType;
import com.thundercrew.opsapi.contract.domain.ContractCategory;
import com.thundercrew.opsapi.contract.domain.ContractReturnType;
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
        String plateNumber,
        String riderName,
        String riderPhoneNumber,
        ContractCategory category,
        ContractReturnType returnType,
        BikeServiceType serviceType,
        Instant createdAt,
        Instant updatedAt
) {
    public static RiderBikeContractReadResponse from(RiderBikeContract contract) {
        return from(contract, null, null);
    }

    /**
     * Used by {@code create} when the service has just attempted automatic
     * insurance issuance off the matching contract template.
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
                null,
                null,
                null,
                null,
                null,
                null,
                contract.getCreatedAt(),
                contract.getUpdatedAt()
        );
    }

    /** Used by the list endpoint to include denormalized bike/rider/template fields. */
    public static RiderBikeContractReadResponse from(
            RiderBikeContract contract,
            String plateNumber,
            String riderName,
            String riderPhoneNumber,
            ContractCategory category,
            ContractReturnType returnType,
            BikeServiceType serviceType
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
                null,
                null,
                plateNumber,
                riderName,
                riderPhoneNumber,
                category,
                returnType,
                serviceType,
                contract.getCreatedAt(),
                contract.getUpdatedAt()
        );
    }
}
