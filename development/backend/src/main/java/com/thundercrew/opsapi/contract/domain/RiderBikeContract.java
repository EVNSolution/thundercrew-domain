package com.thundercrew.opsapi.contract.domain;

import com.thundercrew.opsapi.bike.domain.BikeServiceType;
import com.thundercrew.opsapi.common.domain.DisplaySequencedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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

    @Enumerated(EnumType.STRING)
    @Column(name = "service_type", nullable = false, length = 20)
    private BikeServiceType serviceType;

    public static RiderBikeContract create(
            UUID riderId,
            UUID bikeId,
            UUID contractTemplateId,
            Instant startAt,
            Instant endAt,
            String memo,
            BikeServiceType serviceType
    ) {
        RiderBikeContract contract = new RiderBikeContract();
        contract.riderId = riderId;
        contract.bikeId = bikeId;
        contract.contractTemplateId = contractTemplateId;
        contract.startAt = startAt;
        contract.endAt = endAt;
        contract.memo = memo;
        contract.serviceType = serviceType != null ? serviceType : BikeServiceType.OTHER;
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

    public BikeServiceType getServiceType() {
        return serviceType;
    }

    public void updateMemo(String memo) {
        if (memo != null) {
            this.memo = memo;
        }
    }

    public void updateServiceType(BikeServiceType serviceType) {
        if (serviceType != null) {
            this.serviceType = serviceType;
        }
    }

    public void terminate(Instant terminatedAt, String terminatedReason) {
        this.terminatedAt = terminatedAt;
        this.terminatedReason = terminatedReason;
    }

    public void updateDates(UUID contractTemplateId, Instant startAt, Instant endAt) {
        if (contractTemplateId != null) {
            this.contractTemplateId = contractTemplateId;
        }
        if (startAt != null) {
            this.startAt = startAt;
        }
        this.endAt = endAt;
    }

    protected RiderBikeContract() {
    }
}
