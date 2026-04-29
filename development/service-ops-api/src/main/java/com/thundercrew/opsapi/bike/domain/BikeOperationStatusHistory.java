package com.thundercrew.opsapi.bike.domain;

import com.thundercrew.opsapi.common.domain.DisplaySequencedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "bike_operation_status_histories")
public class BikeOperationStatusHistory extends DisplaySequencedEntity {

    @Column(nullable = false)
    private UUID bikeId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private BikeOperationStatus operationStatus;

    @Column(nullable = false)
    private Instant startedAt;

    private Instant endedAt;

    private String reason;

    private String memo;

    private UUID changedBy;

    public static BikeOperationStatusHistory open(
            UUID bikeId,
            BikeOperationStatus operationStatus,
            Instant startedAt,
            String reason,
            String memo,
            UUID changedBy
    ) {
        BikeOperationStatusHistory history = new BikeOperationStatusHistory();
        history.bikeId = bikeId;
        history.operationStatus = operationStatus;
        history.startedAt = startedAt;
        history.reason = reason;
        history.memo = memo;
        history.changedBy = changedBy;
        return history;
    }

    public void closeAt(Instant endedAt) {
        this.endedAt = endedAt;
    }


    public java.util.UUID getBikeId() {
        return bikeId;
    }

    public BikeOperationStatus getOperationStatus() {
        return operationStatus;
    }

    public java.time.Instant getStartedAt() {
        return startedAt;
    }

    public java.time.Instant getEndedAt() {
        return endedAt;
    }

    public String getReason() {
        return reason;
    }

    public String getMemo() {
        return memo;
    }

    public java.util.UUID getChangedBy() {
        return changedBy;
    }

    protected BikeOperationStatusHistory() {
    }
}
