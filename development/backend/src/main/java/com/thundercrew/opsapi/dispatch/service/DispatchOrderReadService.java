package com.thundercrew.opsapi.dispatch.service;

import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import com.thundercrew.opsapi.dispatch.domain.DispatchOrder;
import com.thundercrew.opsapi.dispatch.domain.DispatchOrderStatus;
import com.thundercrew.opsapi.dispatch.dto.DispatchOrderReadResponse;
import com.thundercrew.opsapi.dispatch.repository.DispatchOrderRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class DispatchOrderReadService {

    private final DispatchOrderRepository dispatchOrderRepository;
    private final Clock clock;

    public DispatchOrderReadService(DispatchOrderRepository dispatchOrderRepository, Clock clock) {
        this.dispatchOrderRepository = dispatchOrderRepository;
        this.clock = clock;
    }

    /**
     * 클리닝 일정표 — 예정 시각이 [from, to) 인 시간 배차 전건(상태 무관).
     * 날짜 경계는 호출측(프론트)이 KST 기준으로 계산해 Instant 로 보낸다.
     */
    public List<DispatchOrderReadResponse> listSchedule(java.time.Instant from, java.time.Instant to) {
        return dispatchOrderRepository
                .findByScheduledAtGreaterThanEqualAndScheduledAtLessThanAndDeletedAtIsNullOrderByScheduledAtAsc(from, to)
                .stream()
                .map(DispatchOrderReadResponse::from)
                .toList();
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

    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");

    /** 모니터용: 활성(ASSIGNED) 전체 + 당일(KST 0시 이후) 완료(COMPLETED). 프론트가 차량별로 묶어 진행률 계산. */
    public List<DispatchOrderReadResponse> listActiveWithTodayCompleted() {
        Instant todayStart = LocalDate.ofInstant(clock.instant(), SEOUL).atStartOfDay(SEOUL).toInstant();
        List<DispatchOrderReadResponse> result = new java.util.ArrayList<>(
                dispatchOrderRepository.findByStatusAndDeletedAtIsNull(DispatchOrderStatus.ASSIGNED).stream()
                        .map(DispatchOrderReadResponse::from)
                        .toList());
        dispatchOrderRepository
                .findByStatusAndCompletedAtAfterAndDeletedAtIsNull(DispatchOrderStatus.COMPLETED, todayStart).stream()
                .map(DispatchOrderReadResponse::from)
                .forEach(result::add);
        return result;
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
