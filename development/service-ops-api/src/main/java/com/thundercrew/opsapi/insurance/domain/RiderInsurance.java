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

    public static RiderInsurance create(
            UUID riderId,
            UUID insuranceItemId,
            String memo,
            Boolean enabled
    ) {
        RiderInsurance riderInsurance = new RiderInsurance();
        riderInsurance.riderId = riderId;
        riderInsurance.insuranceItemId = insuranceItemId;
        riderInsurance.memo = memo;
        riderInsurance.enabled = enabled == null || enabled;
        return riderInsurance;
    }

    public void updateOperatorManagedFields(
            String memo,
            Boolean enabled
    ) {
        if (memo != null) {
            this.memo = memo;
        }
        if (enabled != null) {
            this.enabled = enabled;
        }
    }

    public void disableAndMarkDeleted(UUID actorId, Instant deletedAt) {
        this.enabled = false;
        markDeleted(actorId, deletedAt);
    }

    public java.util.UUID getRiderId() {
        return riderId;
    }

    public java.util.UUID getInsuranceItemId() {
        return insuranceItemId;
    }

    public String getMemo() {
        return memo;
    }

    public boolean isEnabled() {
        return enabled;
    }

    protected RiderInsurance() {
    }
}
