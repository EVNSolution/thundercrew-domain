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


    public java.util.UUID getRiderId() {
        return riderId;
    }

    public java.util.UUID getBikeId() {
        return bikeId;
    }

    public java.util.UUID getContractTemplateId() {
        return contractTemplateId;
    }

    public java.time.Instant getStartAt() {
        return startAt;
    }

    public java.time.Instant getEndAt() {
        return endAt;
    }

    public java.time.Instant getTerminatedAt() {
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
