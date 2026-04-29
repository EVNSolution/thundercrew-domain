package com.thundercrew.opsapi.contract.domain;

import com.thundercrew.opsapi.common.domain.DisplaySequencedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "rider_bike_contracts")
public class RiderBikeContract extends DisplaySequencedEntity {

    @Column(nullable = false)
    private UUID riderId;

    @Column(nullable = false)
    private UUID bikeId;

    @Column(nullable = false)
    private UUID contractTemplateId;

    @Column(nullable = false)
    private Instant startAt;

    private Instant endAt;

    private Instant terminatedAt;

    private String terminatedReason;

    private String memo;

    public static RiderBikeContract create(
            UUID riderId,
            UUID bikeId,
            UUID contractTemplateId,
            Instant startAt,
            Instant endAt,
            String memo
    ) {
        RiderBikeContract contract = new RiderBikeContract();
        contract.riderId = riderId;
        contract.bikeId = bikeId;
        contract.contractTemplateId = contractTemplateId;
        contract.startAt = startAt;
        contract.endAt = endAt;
        contract.memo = memo;
        return contract;
    }

    public UUID getRiderId() {
        return riderId;
    }

    public UUID getBikeId() {
        return bikeId;
    }

    public UUID getContractTemplateId() {
        return contractTemplateId;
    }

    public Instant getStartAt() {
        return startAt;
    }

    public Instant getEndAt() {
        return endAt;
    }

    public Instant getTerminatedAt() {
        return terminatedAt;
    }

    public String getTerminatedReason() {
        return terminatedReason;
    }

    public String getMemo() {
        return memo;
    }

    protected RiderBikeContract() {
    }
}
