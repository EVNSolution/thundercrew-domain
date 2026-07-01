package com.thundercrew.opsapi.dispatch.dto;

import com.thundercrew.opsapi.dispatch.domain.DispatchBatch;
import com.thundercrew.opsapi.dispatch.domain.DispatchBatchStatus;
import java.util.UUID;

/** 현재 유모차 라운드 + 진척. 활성 라운드 없으면 컨트롤러가 204 로 응답. */
public record DispatchRoundResponse(
        UUID batchId,
        DispatchBatchStatus status,
        int pickupTotal,
        int pickupDone,
        int deliveryTotal,
        int deliveryDone
) {
    public static DispatchRoundResponse of(DispatchBatch batch, int pickupTotal, int pickupDone,
                                           int deliveryTotal, int deliveryDone) {
        return new DispatchRoundResponse(
                batch.getId(), batch.getStatus(), pickupTotal, pickupDone, deliveryTotal, deliveryDone);
    }
}
