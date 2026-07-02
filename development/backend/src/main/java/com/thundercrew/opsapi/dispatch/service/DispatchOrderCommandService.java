package com.thundercrew.opsapi.dispatch.service;

import com.thundercrew.opsapi.audit.dto.AuditLogCreateRequest;
import com.thundercrew.opsapi.audit.service.AuditLogCommandService;
import com.thundercrew.opsapi.bike.domain.BikeServiceType;
import com.thundercrew.opsapi.bike.repository.BikeRepository;
import com.thundercrew.opsapi.common.api.InvalidStateTransitionException;
import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import com.thundercrew.opsapi.contract.domain.RiderBikeContract;
import com.thundercrew.opsapi.contract.repository.RiderBikeContractRepository;
import com.thundercrew.opsapi.dispatch.domain.DispatchBatch;
import com.thundercrew.opsapi.dispatch.domain.DispatchBatchStatus;
import com.thundercrew.opsapi.dispatch.domain.DispatchOrder;
import com.thundercrew.opsapi.dispatch.domain.DispatchOrderKind;
import com.thundercrew.opsapi.dispatch.domain.DispatchOrderStatus;
import com.thundercrew.opsapi.dispatch.dto.DispatchOrderCreateRequest;
import com.thundercrew.opsapi.dispatch.dto.DispatchOrderReadResponse;
import com.thundercrew.opsapi.dispatch.dto.DispatchOrderUpdateRequest;
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
    private final BikeRepository bikeRepository;
    private final RiderBikeContractRepository contractRepository;

    public DispatchOrderCommandService(DispatchOrderRepository dispatchOrderRepository,
                                       DispatchBatchRepository dispatchBatchRepository,
                                       AuditLogCommandService auditLogCommandService,
                                       Clock clock,
                                       BikeRepository bikeRepository,
                                       RiderBikeContractRepository contractRepository) {
        this.dispatchOrderRepository = dispatchOrderRepository;
        this.dispatchBatchRepository = dispatchBatchRepository;
        this.auditLogCommandService = auditLogCommandService;
        this.clock = clock;
        this.bikeRepository = bikeRepository;
        this.contractRepository = contractRepository;
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

    /** 차량의 서비스유형 = 활성계약의 값, 없으면 OTHER. (DeliveryCallService/BulkService 와 동일 규칙) */
    private BikeServiceType serviceTypeOf(UUID bikeId) {
        return contractRepository.findActiveByBikeId(bikeId)
                .map(RiderBikeContract::getServiceType)
                .orElse(BikeServiceType.OTHER);
    }

    private static final java.util.Set<BikeServiceType> REASSIGNABLE_TYPES =
            java.util.EnumSet.of(BikeServiceType.CALL, BikeServiceType.SINGLE, BikeServiceType.SEQUENTIAL);

    /**
     * 배차 주문 편집(전체 치환). ASSIGNED 만 가능(완료건 409). batch(왕복) 주문은 고객/주소만 허용,
     * 재배정·순번변경 거부. 성공 시 감사 1건.
     */
    public DispatchOrderReadResponse update(UUID id, DispatchOrderUpdateRequest req) {
        DispatchOrder order = dispatchOrderRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("DispatchOrder", id));
        if (order.getStatus() != DispatchOrderStatus.ASSIGNED) {
            throw new InvalidStateTransitionException("배정된 배차만 수정할 수 있습니다. 현재: " + order.getStatus());
        }

        boolean isBatch = order.getBatchId() != null;
        boolean reassigning = !req.bikeId().equals(order.getBikeId());
        boolean resequencing = req.sequence() != null && req.sequence() != order.getSequence();

        if (isBatch && (reassigning || resequencing)) {
            throw new InvalidStateTransitionException("왕복(배치) 배차는 차량/순번을 변경할 수 없습니다.");
        }

        // 고객/주소 갱신(항상)
        order.updateDetails(req.customerName(), req.customerPhone(), req.address(),
                req.latitude(), req.longitude());

        if (reassigning) {
            bikeRepository.findByIdAndDeletedAtIsNull(req.bikeId())
                    .orElseThrow(() -> new ResourceNotFoundException("Bike", req.bikeId()));
            if (!REASSIGNABLE_TYPES.contains(serviceTypeOf(req.bikeId()))) {
                throw new InvalidStateTransitionException("콜/단일/순차 배차 차량이 아닙니다.");
            }
            long seq = req.sequence() != null ? req.sequence()
                    : dispatchOrderRepository
                        .findTopByBikeIdAndDeletedAtIsNullOrderBySequenceDesc(req.bikeId())
                        .map(o -> o.getSequence() + 1)
                        .orElse(1L);
            order.reassign(req.bikeId(), seq);
        } else if (resequencing) {
            order.changeSequence(req.sequence());
        }

        auditLogCommandService.log("DISPATCH_ORDER", id, "__updated__", null, req.customerName());
        return DispatchOrderReadResponse.from(order);
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
