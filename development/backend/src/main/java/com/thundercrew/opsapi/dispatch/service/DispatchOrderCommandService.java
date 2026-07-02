package com.thundercrew.opsapi.dispatch.service;

import com.thundercrew.opsapi.audit.dto.AuditLogCreateRequest;
import com.thundercrew.opsapi.audit.service.AuditLogCommandService;
import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import com.thundercrew.opsapi.dispatch.domain.DispatchBatch;
import com.thundercrew.opsapi.dispatch.domain.DispatchBatchStatus;
import com.thundercrew.opsapi.dispatch.domain.DispatchOrder;
import com.thundercrew.opsapi.dispatch.domain.DispatchOrderKind;
import com.thundercrew.opsapi.dispatch.domain.DispatchOrderStatus;
import com.thundercrew.opsapi.dispatch.dto.DispatchOrderCreateRequest;
import com.thundercrew.opsapi.dispatch.dto.DispatchOrderReadResponse;
import com.thundercrew.opsapi.dispatch.repository.DispatchBatchRepository;
import com.thundercrew.opsapi.dispatch.repository.DispatchOrderRepository;
import java.time.Clock;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class DispatchOrderCommandService {

    private final DispatchOrderRepository dispatchOrderRepository;
    private final DispatchBatchRepository dispatchBatchRepository;
    private final AuditLogCommandService auditLogCommandService;
    private final Clock clock;

    public DispatchOrderCommandService(DispatchOrderRepository dispatchOrderRepository,
                                       DispatchBatchRepository dispatchBatchRepository,
                                       AuditLogCommandService auditLogCommandService,
                                       Clock clock) {
        this.dispatchOrderRepository = dispatchOrderRepository;
        this.dispatchBatchRepository = dispatchBatchRepository;
        this.auditLogCommandService = auditLogCommandService;
        this.clock = clock;
    }

    public DispatchOrderReadResponse create(DispatchOrderCreateRequest request) {
        DispatchOrderReadResponse result = appendForBike(
                request.bikeId(),
                request.customerName(),
                request.customerPhone(),
                request.address(),
                request.latitude(),
                request.longitude(),
                request.originAddress(),
                request.originLatitude(),
                request.originLongitude());
        auditLogCommandService.log("DISPATCH_ORDER", result.id(), "__created__", null, request.customerName());
        return result;
    }

    public DispatchOrderReadResponse complete(UUID id, byte[] photo, String contentType, UUID completedBy) {
        DispatchOrder order = dispatchOrderRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("DispatchOrder", id));
        // 관리 엔티티는 @Transactional 종료 시 dirty-checking 으로 flush 되므로 mutate 경로에 명시적 save() 없음.
        order.complete(clock.instant(), photo, contentType, completedBy);
        // 유모차 라운드: 마지막 배송 완료 시 배치를 DONE 으로 자동 전환.
        if (order.getBatchId() != null && order.getKind() == DispatchOrderKind.DELIVERY
                && dispatchOrderRepository.findByBatchIdAndKindAndStatusAndDeletedAtIsNull(
                        order.getBatchId(), DispatchOrderKind.DELIVERY, DispatchOrderStatus.ASSIGNED).isEmpty()) {
            dispatchBatchRepository.findByIdAndDeletedAtIsNull(order.getBatchId())
                    .filter(b -> b.getStatus() == DispatchBatchStatus.DELIVERING)
                    .ifPresent(b -> b.markDone(null, clock.instant()));
        }
        auditLogCommandService.record(new AuditLogCreateRequest("DISPATCH_ORDER", id, "status", "ASSIGNED", "COMPLETED"));
        return DispatchOrderReadResponse.from(order);
    }

    public void cancel(UUID id) {
        DispatchOrder order = dispatchOrderRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("DispatchOrder", id));
        order.markDeleted(null, clock.instant());
        auditLogCommandService.log("DISPATCH_ORDER", id, "__deleted__", null, null);
    }

    public DispatchOrderReadResponse appendForBike(UUID bikeId, String customerName, String customerPhone,
                                                   String address, double latitude, double longitude) {
        return appendForBike(bikeId, customerName, customerPhone, address, latitude, longitude, null, null, null);
    }

    public DispatchOrderReadResponse appendForBike(UUID bikeId, String customerName, String customerPhone,
                                                   String address, double latitude, double longitude,
                                                   String originAddress, Double originLatitude, Double originLongitude) {
        long nextSequence = nextSequence(bikeId);
        DispatchOrder order = DispatchOrder.create(
                bikeId, customerName, customerPhone, address, latitude, longitude, nextSequence);
        order.setOrigin(originAddress, originLatitude, originLongitude);
        return DispatchOrderReadResponse.from(dispatchOrderRepository.save(order));
    }

    /** 라운드(batch) 소속 주문을 차량 큐에 append. kind 와 batchId 를 부여한다. */
    public DispatchOrder appendForBatch(UUID bikeId, String customerName, String customerPhone, String address,
                                        double latitude, double longitude, DispatchOrderKind kind, UUID batchId) {
        long nextSequence = nextSequence(bikeId);
        DispatchOrder order = DispatchOrder.createForBatch(
                bikeId, customerName, customerPhone, address, latitude, longitude, nextSequence, kind, batchId);
        return dispatchOrderRepository.save(order);
    }

    private long nextSequence(UUID bikeId) {
        return dispatchOrderRepository
                .findTopByBikeIdAndDeletedAtIsNullOrderBySequenceDesc(bikeId)
                .map(order -> order.getSequence() + 1)
                .orElse(1L);
    }
}
