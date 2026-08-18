package com.thundercrew.opsapi.dispatch.service;

import com.thundercrew.opsapi.bike.domain.Bike;
import com.thundercrew.opsapi.bike.domain.BikePurpose;
import com.thundercrew.opsapi.bike.repository.BikeRepository;
import com.thundercrew.opsapi.common.api.InvalidStateTransitionException;
import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import com.thundercrew.opsapi.contract.domain.RiderBikeContract;
import com.thundercrew.opsapi.contract.repository.RiderBikeContractRepository;
import com.thundercrew.opsapi.dispatch.domain.DispatchOrder;
import com.thundercrew.opsapi.dispatch.domain.DispatchOrderStatus;
import com.thundercrew.opsapi.dispatch.dto.DispatchOrderReadResponse;
import com.thundercrew.opsapi.dispatch.repository.DispatchOrderRepository;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 배민 단건 콜 오케스트레이션.
 * - systemDispatch: 가장 적게 배정된 DELIVERY 차량을 골라 즉시 ASSIGNED 주문 생성.
 * - offerCall: 차량 미배정(OFFERED) 콜 생성.
 * - acceptCall: OFFERED 콜을 운영자가 지정한 차량에 배정(ASSIGNED).
 */
@Service
@Transactional
public class DeliveryCallService {

    private final DispatchOrderRepository orderRepository;
    private final BikeRepository bikeRepository;
    private final RiderBikeContractRepository contractRepository;
    private final DispatchOrderCommandService commandService;

    public DeliveryCallService(DispatchOrderRepository orderRepository,
                               BikeRepository bikeRepository,
                               RiderBikeContractRepository contractRepository,
                               DispatchOrderCommandService commandService) {
        this.orderRepository = orderRepository;
        this.bikeRepository = bikeRepository;
        this.contractRepository = contractRepository;
        this.commandService = commandService;
    }

    /** 시스템 자동 배차: 가장 적게 배정된 DELIVERY 차량 선택 → ASSIGNED 주문. */
    public DispatchOrderReadResponse systemDispatch(String customerName, String customerPhone,
                                                    String address, double latitude, double longitude) {
        // 후보 = 배송용 차량 ∩ 활성 매칭 보유. 배차 방식 축(CALL/SINGLE)은 용도
        // 단일화(V59)로 사라졌다 — 용도가 배송이고 수행할 사람이 붙어 있으면 후보다.
        List<Bike> allBikes = bikeRepository.findAllByDeletedAtIsNull();
        java.util.Set<UUID> matched = allBikes.isEmpty() ? java.util.Set.of()
                : contractRepository.findActiveByBikeIdIn(allBikes.stream().map(Bike::getId).toList()).stream()
                        .map(RiderBikeContract::getBikeId)
                        .collect(Collectors.toSet());
        List<Bike> deliveryBikes = allBikes.stream()
                .filter(b -> b.getPurpose() == BikePurpose.DELIVERY && matched.contains(b.getId()))
                .toList();
        if (deliveryBikes.isEmpty()) {
            throw new InvalidStateTransitionException("가용 배송 차량이 없습니다.");
        }
        Map<UUID, Long> assignedCount = orderRepository
                .findByStatusAndDeletedAtIsNull(DispatchOrderStatus.ASSIGNED).stream()
                .filter(o -> o.getBikeId() != null)
                .collect(Collectors.groupingBy(DispatchOrder::getBikeId, Collectors.counting()));
        Bike target = deliveryBikes.stream()
                .min(Comparator.comparingLong(b -> assignedCount.getOrDefault(b.getId(), 0L)))
                .orElseThrow(() -> new InvalidStateTransitionException("가용 배송 차량이 없습니다."));
        return commandService.appendForBike(
                target.getId(), customerName, customerPhone, address, latitude, longitude);
    }

    /** 라이더 수락 콜: 차량 미배정 OFFERED 생성. */
    public DispatchOrderReadResponse offerCall(String customerName, String customerPhone,
                                               String address, double latitude, double longitude) {
        DispatchOrder order = orderRepository.save(
                DispatchOrder.createOffered(customerName, customerPhone, address, latitude, longitude));
        return DispatchOrderReadResponse.from(order);
    }

    /** OFFERED 콜을 운영자 지정 차량에 배정. */
    public DispatchOrderReadResponse acceptCall(UUID orderId, UUID bikeId) {
        DispatchOrder order = orderRepository.findByIdAndDeletedAtIsNull(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("DispatchOrder", orderId));
        Bike bike = bikeRepository.findByIdAndDeletedAtIsNull(bikeId)
                .orElseThrow(() -> new ResourceNotFoundException("Bike", bikeId));
        if (bike.getPurpose() != BikePurpose.DELIVERY) {
            throw new InvalidStateTransitionException("배송용 차량이 아닙니다.");
        }
        if (contractRepository.findActiveByBikeId(bikeId).isEmpty()) {
            throw new InvalidStateTransitionException("활성 매칭이 없는 차량입니다.");
        }
        long nextSequence = orderRepository
                .findTopByBikeIdAndDeletedAtIsNullOrderBySequenceDesc(bikeId)
                .map(o -> o.getSequence() + 1)
                .orElse(1L);
        order.assign(bikeId, nextSequence); // dirty-checking flush
        return DispatchOrderReadResponse.from(order);
    }

    @Transactional(readOnly = true)
    public List<DispatchOrderReadResponse> listOffered() {
        return orderRepository
                .findByStatusAndDeletedAtIsNullOrderByCreatedAtAsc(DispatchOrderStatus.OFFERED).stream()
                .map(DispatchOrderReadResponse::from)
                .toList();
    }
}
