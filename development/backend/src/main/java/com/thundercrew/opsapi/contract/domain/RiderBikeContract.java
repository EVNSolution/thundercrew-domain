package com.thundercrew.opsapi.contract.domain;

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

    /**
     * 클리닝 계약의 운영 형태 — 직영(DIRECT)/협력(PARTNER). V57.
     * 배송 계약에는 없다(인수/반납이 그 자리). 용도별 강제는 커맨드 서비스가 한다 —
     * 용도가 bikes 테이블에 있어 DB CHECK 로 못 건다.
     */
    @Column(name = "engagement_type", length = 20)
    private String engagementType;

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

    public String getEngagementType() {
        return engagementType;
    }

    public void setEngagementType(String engagementType) {
        this.engagementType = engagementType;
    }

    public String getMemo() {
        return memo;
    }

    public void updateMemo(String memo) {
        if (memo != null) {
            this.memo = memo;
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
