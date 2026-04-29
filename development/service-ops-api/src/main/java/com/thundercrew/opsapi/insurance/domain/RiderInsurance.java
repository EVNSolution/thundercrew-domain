package com.thundercrew.opsapi.insurance.domain;

import com.thundercrew.opsapi.common.domain.DisplaySequencedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
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
