package com.thundercrew.opsapi.insurance.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.time.Instant;
import java.util.UUID;

@JsonIgnoreProperties(ignoreUnknown = true)
public class RiderInsuranceUpdateRequest {

    private String memo;

    private Boolean enabled;

    private Instant startsAt;
    private boolean startsAtProvided;

    private Instant endsAt;
    private boolean endsAtProvided;

    private UUID riderBikeContractId;
    private boolean riderBikeContractIdProvided;

    public String memo() {
        return memo;
    }

    public void setMemo(String memo) {
        this.memo = memo;
    }

    public Boolean enabled() {
        return enabled;
    }

    public void setEnabled(Boolean enabled) {
        this.enabled = enabled;
    }

    public Instant startsAt() {
        return startsAt;
    }

    public void setStartsAt(Instant startsAt) {
        this.startsAt = startsAt;
        this.startsAtProvided = true;
    }

    public Instant endsAt() {
        return endsAt;
    }

    public void setEndsAt(Instant endsAt) {
        this.endsAt = endsAt;
        this.endsAtProvided = true;
    }

    public boolean periodProvided() {
        return startsAtProvided || endsAtProvided;
    }

    public UUID riderBikeContractId() {
        return riderBikeContractId;
    }

    public boolean riderBikeContractIdProvided() {
        return riderBikeContractIdProvided;
    }

    public void setRiderBikeContractId(UUID riderBikeContractId) {
        this.riderBikeContractId = riderBikeContractId;
        this.riderBikeContractIdProvided = true;
    }
}
