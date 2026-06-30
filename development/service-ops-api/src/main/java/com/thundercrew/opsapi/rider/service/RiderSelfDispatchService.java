package com.thundercrew.opsapi.rider.service;

import com.thundercrew.opsapi.common.api.InvalidStateTransitionException;
import com.thundercrew.opsapi.dispatch.domain.DispatchOrder;
import com.thundercrew.opsapi.dispatch.dto.DispatchOrderReadResponse;
import com.thundercrew.opsapi.dispatch.service.DeliveryCallService;
import com.thundercrew.opsapi.dispatch.service.DispatchOrderCommandService;
import com.thundercrew.opsapi.dispatch.service.DispatchOrderReadService;
import java.util.UUID;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class RiderSelfDispatchService {

    private final RiderVehicleReadService riderVehicleReadService;
    private final DeliveryCallService deliveryCallService;
    private final DispatchOrderReadService dispatchOrderReadService;
    private final DispatchOrderCommandService dispatchOrderCommandService;

    public RiderSelfDispatchService(
            RiderVehicleReadService riderVehicleReadService,
            DeliveryCallService deliveryCallService,
            DispatchOrderReadService dispatchOrderReadService,
            DispatchOrderCommandService dispatchOrderCommandService
    ) {
        this.riderVehicleReadService = riderVehicleReadService;
        this.deliveryCallService = deliveryCallService;
        this.dispatchOrderReadService = dispatchOrderReadService;
        this.dispatchOrderCommandService = dispatchOrderCommandService;
    }

    public DispatchOrderReadResponse acceptOfferedCall(UUID riderId, UUID orderId) {
        UUID bikeId = riderVehicleReadService.activeBikeIdOrNull(riderId);
        if (bikeId == null) {
            throw new InvalidStateTransitionException("활성 차량이 없습니다.");
        }
        return deliveryCallService.acceptCall(orderId, bikeId);
    }

    public DispatchOrderReadResponse completeMyDispatch(UUID riderId, UUID orderId, byte[] photo, String contentType) {
        UUID bikeId = riderVehicleReadService.activeBikeIdOrNull(riderId);
        if (bikeId == null) {
            throw new InvalidStateTransitionException("활성 차량이 없습니다.");
        }
        DispatchOrder order = dispatchOrderReadService.findOrderForPhoto(orderId);
        if (!bikeId.equals(order.getBikeId())) {
            throw new AccessDeniedException("본인 배차가 아닙니다.");
        }
        return dispatchOrderCommandService.complete(orderId, photo, contentType, riderId);
    }
}
