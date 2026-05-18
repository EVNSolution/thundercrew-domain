package com.thundercrew.opsapi.insurance.domain;

import com.thundercrew.opsapi.common.domain.DisplaySequencedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "rider_insurances")
public class RiderInsurance extends DisplaySequencedEntity {

    @Column(nullable = false)
    private UUID riderId;

    @Column(nullable = false)
    private UUID insuranceItemId;

    private String memo;

    @Column(nullable = false)
    private boolean enabled = true;

    @Column(name = "starts_at")
    private Instant startsAt;

    @Column(name = "ends_at")
    private Instant endsAt;

    @Column(name = "rider_bike_contract_id")
    private UUID riderBikeContractId;

    public static RiderInsurance create(
            UUID riderId,
            UUID insuranceItemId,
            String memo,
            Boolean enabled,
            Instant startsAt,
            Instant endsAt,
            UUID riderBikeContractId
    ) {
        RiderInsurance riderInsurance = new RiderInsurance();
        riderInsurance.riderId = riderId;
        riderInsurance.insuranceItemId = insuranceItemId;
        riderInsurance.memo = memo;
        riderInsurance.enabled = enabled == null || enabled;
        riderInsurance.startsAt = startsAt;
        riderInsurance.endsAt = endsAt;
        riderInsurance.riderBikeContractId = riderBikeContractId;
        return riderInsurance;
    }

    public void updateOperatorManagedFields(
            String memo,
            Boolean enabled,
            boolean periodProvided,
            Instant startsAt,
            Instant endsAt,
            boolean riderBikeContractIdProvided,
            UUID riderBikeContractId
    ) {
        if (memo != null) {
            this.memo = memo;
        }
        if (enabled != null) {
            this.enabled = enabled;
        }
        if (periodProvided) {
            this.startsAt = startsAt;
            this.endsAt = endsAt;
        }
        if (riderBikeContractIdProvided) {
            this.riderBikeContractId = riderBikeContractId;
        }
    }

    public void disableAndMarkDeleted(UUID actorId, Instant deletedAt) {
        this.enabled = false;
        markDeleted(actorId, deletedAt);
    }

    public UUID getRiderId() {
        return riderId;
    }

    public UUID getInsuranceItemId() {
        return insuranceItemId;
    }

    public String getMemo() {
        return memo;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public Instant getStartsAt() {
        return startsAt;
    }

    public Instant getEndsAt() {
        return endsAt;
    }

    public UUID getRiderBikeContractId() {
        return riderBikeContractId;
    }

    protected RiderInsurance() {
    }
}
