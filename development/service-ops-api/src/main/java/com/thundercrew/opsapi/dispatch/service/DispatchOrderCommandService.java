package com.thundercrew.opsapi.dispatch.service;

import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import com.thundercrew.opsapi.dispatch.domain.DispatchOrder;
import com.thundercrew.opsapi.dispatch.dto.DispatchOrderCreateRequest;
import com.thundercrew.opsapi.dispatch.dto.DispatchOrderReadResponse;
import com.thundercrew.opsapi.dispatch.repository.DispatchOrderRepository;
import java.time.Clock;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class DispatchOrderCommandService {

    private final DispatchOrderRepository dispatchOrderRepository;
    private final Clock clock;

    public DispatchOrderCommandService(DispatchOrderRepository dispatchOrderRepository, Clock clock) {
        this.dispatchOrderRepository = dispatchOrderRepository;
        this.clock = clock;
    }

    public DispatchOrderReadResponse create(DispatchOrderCreateRequest request) {
        return appendForBike(
                request.bikeId(),
                request.customerName(),
                request.customerPhone(),
                request.address(),
                request.latitude(),
                request.longitude());
    }

    public DispatchOrderReadResponse complete(UUID id) {
        DispatchOrder order = dispatchOrderRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("DispatchOrder", id));
        // 관리 엔티티는 @Transactional 종료 시 dirty-checking 으로 flush 되므로
        // mutate 경로에는 명시적 save() 를 두지 않는다 (Tip update/delete 와 동일).
        order.complete(clock.instant());
        return DispatchOrderReadResponse.from(order);
    }

    public void cancel(UUID id) {
        DispatchOrder order = dispatchOrderRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("DispatchOrder", id));
        order.markDeleted(null, clock.instant());
    }

    public DispatchOrderReadResponse appendForBike(UUID bikeId, String customerName, String customerPhone,
                                                   String address, double latitude, double longitude) {
        long nextSequence = dispatchOrderRepository
                .findTopByBikeIdAndDeletedAtIsNullOrderBySequenceDesc(bikeId)
                .map(order -> order.getSequence() + 1)
                .orElse(1L);
        DispatchOrder order = DispatchOrder.create(
                bikeId, customerName, customerPhone, address, latitude, longitude, nextSequence);
        return DispatchOrderReadResponse.from(dispatchOrderRepository.save(order));
    }
}
