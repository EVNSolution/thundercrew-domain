package com.thundercrew.opsapi.dispatch.service;

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

    public Optional<DispatchOrderReadResponse> currentByBike(UUID bikeId) {
        return dispatchOrderRepository
                .findByBikeIdAndStatusAndDeletedAtIsNullOrderBySequenceAsc(bikeId, DispatchOrderStatus.ASSIGNED)
                .stream()
                .findFirst()
                .map(DispatchOrderReadResponse::from);
    }
}
