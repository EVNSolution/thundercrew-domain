package com.thundercrew.opsapi.dispatch.service;

import com.thundercrew.opsapi.common.api.InvalidStateTransitionException;
import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import com.thundercrew.opsapi.dispatch.domain.DispatchBatch;
import com.thundercrew.opsapi.dispatch.domain.DispatchBatchStatus;
import com.thundercrew.opsapi.dispatch.domain.DispatchOrder;
import com.thundercrew.opsapi.dispatch.domain.DispatchOrderKind;
import com.thundercrew.opsapi.dispatch.domain.DispatchOrderStatus;
import com.thundercrew.opsapi.dispatch.dto.DispatchBulkApplyRequest;
import com.thundercrew.opsapi.dispatch.dto.DispatchBulkApplyRow;
import com.thundercrew.opsapi.dispatch.dto.DispatchRoundResponse;
import com.thundercrew.opsapi.dispatch.repository.DispatchBatchRepository;
import com.thundercrew.opsapi.dispatch.repository.DispatchOrderRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 유모차 라운드(2단계 배치) 오케스트레이션.
 * 업로드 → 수거(PICKUP) 주문 생성, '배송 시작' → 완료된 수거로부터 배송(DELIVERY) 주문 생성.
 * 활성 단계의 주문만 ASSIGNED 로 존재하도록(배송은 전환 시 생성) 하여 큐/대시보드 쿼리를 단순 유지.
 */
@Service
@Transactional
public class DispatchRoundService {

    private static final List<DispatchBatchStatus> ACTIVE =
            List.of(DispatchBatchStatus.COLLECTING, DispatchBatchStatus.DELIVERING);

    private final DispatchBatchRepository batchRepository;
    private final DispatchOrderRepository orderRepository;
    private final DispatchOrderCommandService commandService;

    public DispatchRoundService(DispatchBatchRepository batchRepository,
                                DispatchOrderRepository orderRepository,
                                DispatchOrderCommandService commandService) {
        this.batchRepository = batchRepository;
        this.orderRepository = orderRepository;
        this.commandService = commandService;
    }

    /** 새 라운드 생성. 동시 활성 라운드는 1개만 허용. 각 행을 PICKUP 주문으로 적재. */
    public DispatchRoundResponse createRound(DispatchBulkApplyRequest request) {
        if (!batchRepository.findByStatusInAndDeletedAtIsNull(ACTIVE).isEmpty()) {
            throw new InvalidStateTransitionException("이미 진행 중인 유모차 라운드가 있습니다.");
        }
        DispatchBatch batch = batchRepository.save(DispatchBatch.create());
        for (DispatchBulkApplyRow row : request.rows()) {
            commandService.appendForBatch(row.bikeId(), row.customerName(), row.customerPhone(),
                    row.address(), row.latitude(), row.longitude(), DispatchOrderKind.PICKUP, batch.getId());
        }
        return progress(batch);
    }

    /** 전체 수거 완료 후 배송 단계로 전환. 완료된 수거 각각에서 배송 주문을 생성. */
    public DispatchRoundResponse startDelivery(UUID batchId) {
        DispatchBatch batch = batchRepository.findByIdAndDeletedAtIsNull(batchId)
                .orElseThrow(() -> new ResourceNotFoundException("DispatchBatch", batchId));
        if (batch.getStatus() != DispatchBatchStatus.COLLECTING) {
            throw new InvalidStateTransitionException("배송 시작은 수거 단계에서만 가능합니다. 현재: " + batch.getStatus());
        }
        List<DispatchOrder> remainingPickups = orderRepository.findByBatchIdAndKindAndStatusAndDeletedAtIsNull(
                batchId, DispatchOrderKind.PICKUP, DispatchOrderStatus.ASSIGNED);
        if (!remainingPickups.isEmpty()) {
            throw new InvalidStateTransitionException("수거가 모두 완료되지 않았습니다. 남은 수거: " + remainingPickups.size());
        }
        List<DispatchOrder> allPickups = orderRepository.findByBatchIdAndDeletedAtIsNull(batchId).stream()
                .filter(o -> o.getKind() == DispatchOrderKind.PICKUP)
                .toList();
        for (DispatchOrder p : allPickups) {
            commandService.appendForBatch(p.getBikeId(), p.getCustomerName(), p.getCustomerPhone(),
                    p.getAddress(), p.getLatitude(), p.getLongitude(), DispatchOrderKind.DELIVERY, batchId);
        }
        batch.startDelivery();
        return progress(batch);
    }

    @Transactional(readOnly = true)
    public Optional<DispatchRoundResponse> activeRound() {
        return batchRepository.findByStatusInAndDeletedAtIsNull(ACTIVE).stream()
                .findFirst()
                .map(this::progress);
    }

    private DispatchRoundResponse progress(DispatchBatch batch) {
        List<DispatchOrder> orders = orderRepository.findByBatchIdAndDeletedAtIsNull(batch.getId());
        int pickupTotal = (int) orders.stream().filter(o -> o.getKind() == DispatchOrderKind.PICKUP).count();
        int pickupDone = (int) orders.stream()
                .filter(o -> o.getKind() == DispatchOrderKind.PICKUP && o.getStatus() == DispatchOrderStatus.COMPLETED)
                .count();
        int deliveryTotal = (int) orders.stream().filter(o -> o.getKind() == DispatchOrderKind.DELIVERY).count();
        int deliveryDone = (int) orders.stream()
                .filter(o -> o.getKind() == DispatchOrderKind.DELIVERY && o.getStatus() == DispatchOrderStatus.COMPLETED)
                .count();
        return DispatchRoundResponse.of(batch, pickupTotal, pickupDone, deliveryTotal, deliveryDone);
    }
}
