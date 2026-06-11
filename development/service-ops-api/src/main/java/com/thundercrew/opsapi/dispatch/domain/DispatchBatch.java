package com.thundercrew.opsapi.dispatch.domain;

import com.thundercrew.opsapi.common.domain.DisplaySequencedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "dispatch_batch")
public class DispatchBatch extends DisplaySequencedEntity {

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DispatchBatchStatus status;

    public static DispatchBatch create() {
        DispatchBatch batch = new DispatchBatch();
        batch.status = DispatchBatchStatus.COLLECTING;
        return batch;
    }

    /** 전체 수거 완료 후 운영자 '배송 시작'. COLLECTING 에서만 허용. */
    public void startDelivery() {
        if (status != DispatchBatchStatus.COLLECTING) {
            throw new IllegalStateException("배송 시작은 수거 단계에서만 가능합니다. 현재: " + status);
        }
        this.status = DispatchBatchStatus.DELIVERING;
    }

    /** 전체 배송 완료. DELIVERING 에서만 허용. */
    public void markDone(UUID actorId, Instant when) {
        if (status != DispatchBatchStatus.DELIVERING) {
            throw new IllegalStateException("완료는 배송 단계에서만 가능합니다. 현재: " + status);
        }
        this.status = DispatchBatchStatus.DONE;
    }

    public DispatchBatchStatus getStatus() {
        return status;
    }

    protected DispatchBatch() {
    }
}
