package com.thundercrew.opsapi.dispatch.service;

import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import com.thundercrew.opsapi.dispatch.domain.DispatchOrder;
import com.thundercrew.opsapi.dispatch.domain.DispatchOrderStatus;
import com.thundercrew.opsapi.dispatch.dto.DispatchOrderReadResponse;
import com.thundercrew.opsapi.dispatch.repository.DispatchOrderRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class DispatchOrderReadService {

    private final DispatchOrderRepository dispatchOrderRepository;

    public DispatchOrderReadService(DispatchOrderRepository dispatchOrderRepository) {
        this.dispatchOrderRepository = dispatchOrderRepository;
    }

    public List<DispatchOrderReadResponse> listByBike(UUID bikeId) {
        return dispatchOrderRepository.findByBikeIdAndDeletedAtIsNullOrderBySequenceAsc(bikeId).stream()
                .map(DispatchOrderReadResponse::from)
                .toList();
    }

    /** 배송 상태 탭: 차량 배정된 활성(ASSIGNED) 배차 전체. 프론트가 차량별로 묶는다. */
    public List<DispatchOrderReadResponse> listActiveAssigned() {
        return dispatchOrderRepository.findByStatusAndDeletedAtIsNull(DispatchOrderStatus.ASSIGNED).stream()
                .map(DispatchOrderReadResponse::from)
                .toList();
    }

    public Optional<DispatchOrderReadResponse> currentByBike(UUID bikeId) {
        return dispatchOrderRepository
                .findByBikeIdAndStatusAndDeletedAtIsNullOrderBySequenceAsc(bikeId, DispatchOrderStatus.ASSIGNED)
                .stream()
                .findFirst()
                .map(DispatchOrderReadResponse::from);
    }

    public List<DispatchOrderReadResponse> listAssignedByBike(UUID bikeId) {
        return dispatchOrderRepository
                .findByBikeIdAndStatusAndDeletedAtIsNullOrderBySequenceAsc(bikeId, DispatchOrderStatus.ASSIGNED)
                .stream()
                .map(DispatchOrderReadResponse::from)
                .toList();
    }

    public List<DispatchOrderReadResponse> listCompletedByBike(UUID bikeId) {
        return dispatchOrderRepository
                .findByBikeIdAndStatusAndDeletedAtIsNullOrderByCompletedAtDesc(bikeId, DispatchOrderStatus.COMPLETED)
                .stream()
                .map(DispatchOrderReadResponse::from)
                .toList();
    }

    public DispatchOrder findOrderForPhoto(UUID id) {
        return dispatchOrderRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("DispatchOrder", id));
    }
}
