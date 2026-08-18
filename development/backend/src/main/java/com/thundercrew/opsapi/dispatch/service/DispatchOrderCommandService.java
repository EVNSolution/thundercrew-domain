package com.thundercrew.opsapi.dispatch.service;

import jakarta.persistence.EntityManager;
import com.thundercrew.opsapi.audit.dto.AuditLogCreateRequest;
import com.thundercrew.opsapi.audit.service.AuditLogCommandService;
import com.thundercrew.opsapi.bike.domain.Bike;
import com.thundercrew.opsapi.bike.domain.BikePurpose;
import com.thundercrew.opsapi.bike.repository.BikeRepository;
import com.thundercrew.opsapi.common.api.InvalidStateTransitionException;
import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import com.thundercrew.opsapi.common.api.ValidationFailedException;
import com.thundercrew.opsapi.contract.repository.RiderBikeContractRepository;
import com.thundercrew.opsapi.dispatch.domain.DispatchOrder;
import com.thundercrew.opsapi.dispatch.domain.DispatchOrderStatus;
import com.thundercrew.opsapi.dispatch.dto.DispatchOrderCreateRequest;
import com.thundercrew.opsapi.dispatch.dto.DispatchOrderReadResponse;
import com.thundercrew.opsapi.dispatch.dto.DispatchOrderUpdateRequest;
import com.thundercrew.opsapi.dispatch.repository.DispatchOrderRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class DispatchOrderCommandService {

    private final DispatchOrderRepository dispatchOrderRepository;
    private final AuditLogCommandService auditLogCommandService;
    private final Clock clock;
    private final BikeRepository bikeRepository;
    private final RiderBikeContractRepository contractRepository;
    private final EntityManager entityManager;
    /** 클리닝 건별 소요시간 기본값(분) — 설정 화면(4단계) 전까지 properties 로 조정. */
    private final int defaultServiceMinutes;

    public DispatchOrderCommandService(DispatchOrderRepository dispatchOrderRepository,
                                       AuditLogCommandService auditLogCommandService,
                                       Clock clock,
                                       BikeRepository bikeRepository,
                                       RiderBikeContractRepository contractRepository,
                                       EntityManager entityManager,
                                       @Value("${thundercrew.dispatch.default-service-minutes:60}") int defaultServiceMinutes) {
        this.dispatchOrderRepository = dispatchOrderRepository;
        this.auditLogCommandService = auditLogCommandService;
        this.clock = clock;
        this.bikeRepository = bikeRepository;
        this.contractRepository = contractRepository;
        this.entityManager = entityManager;
        this.defaultServiceMinutes = defaultServiceMinutes;
    }

    public DispatchOrderReadResponse create(DispatchOrderCreateRequest request) {
        Bike bike = bikeRepository.findByIdAndDeletedAtIsNull(request.bikeId())
                .orElseThrow(() -> new ResourceNotFoundException("Bike", request.bikeId()));
        if (contractRepository.findActiveByBikeId(request.bikeId()).isEmpty()) {
            throw new ValidationFailedException("활성 매칭이 없는 차량입니다.");
        }
        // 용도가 배차 방식을 가른다 — 클리닝은 시간 배차(예정 시각 필수 + 같은
        // 차량의 시간 겹침 거부), 배송은 순번 배차(예정 시각 없음).
        boolean cleaning = bike.getPurpose() == BikePurpose.CLEANING;
        if (cleaning) {
            if (request.scheduledAt() == null) {
                throw new ValidationFailedException("클리닝 배차에는 서비스 예정 시각이 필요합니다.");
            }
            int minutes = request.serviceMinutes() != null ? request.serviceMinutes() : defaultServiceMinutes;
            Instant endAt = request.scheduledAt().plus(Duration.ofMinutes(minutes));
            if (dispatchOrderRepository.existsCleaningOverlap(
                    request.bikeId(), request.scheduledAt(), endAt, defaultServiceMinutes)) {
                throw new ValidationFailedException("해당 시간대에 이미 배정된 클리닝 일정이 있습니다.");
            }
        } else if (request.scheduledAt() != null) {
            throw new ValidationFailedException("배송 배차에는 예정 시각을 지정할 수 없습니다. 배송은 순번으로 배차됩니다.");
        }

        DispatchOrderReadResponse result = appendForBike(
                request.bikeId(),
                request.customerName(),
                request.customerPhone(),
                request.address(),
                request.latitude(),
                request.longitude(),
                request.originAddress(),
                request.originLatitude(),
                request.originLongitude(),
                cleaning ? request.scheduledAt() : null,
                cleaning ? request.serviceMinutes() : null);
        auditLogCommandService.log("DISPATCH_ORDER", result.id(), "__created__", null, request.customerName());
        return result;
    }

    /** 운영자 수동 완료 (사진 없음) — 모니터의 완료 버튼·추정 불가 차량용. */
    public DispatchOrderReadResponse completeManual(UUID id, UUID completedBy) {
        DispatchOrder order = dispatchOrderRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("DispatchOrder", id));
        order.completeManual(clock.instant(), completedBy);
        auditLogCommandService.record(new AuditLogCreateRequest("DISPATCH_ORDER", id, "status", "ASSIGNED", "COMPLETED"));
        return DispatchOrderReadResponse.from(order);
    }

    /** 완료 되돌리기 — 자동 추정 오판·실수 정정. 도착 추적 상태까지 초기화. */
    public DispatchOrderReadResponse revertCompletion(UUID id) {
        DispatchOrder order = dispatchOrderRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("DispatchOrder", id));
        String source = order.getCompletedSource() != null ? order.getCompletedSource().name() : null;
        order.revertCompletion();
        auditLogCommandService.record(new AuditLogCreateRequest("DISPATCH_ORDER", id, "status", "COMPLETED", "ASSIGNED"));
        if (source != null) {
            auditLogCommandService.log("DISPATCH_ORDER", id, "completed_source_reverted", source, null);
        }
        return DispatchOrderReadResponse.from(order);
    }

    /**
     * 배차 주문 편집(전체 치환). ASSIGNED 만 가능(완료건 409). 성공 시 감사 1건.
     */
    public DispatchOrderReadResponse update(UUID id, DispatchOrderUpdateRequest req) {
        DispatchOrder order = dispatchOrderRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("DispatchOrder", id));
        if (order.getStatus() != DispatchOrderStatus.ASSIGNED) {
            throw new InvalidStateTransitionException("배정된 배차만 수정할 수 있습니다. 현재: " + order.getStatus());
        }

        boolean reassigning = !req.bikeId().equals(order.getBikeId());
        boolean resequencing = req.sequence() != null && req.sequence() != order.getSequence();

        // 고객/주소 갱신(항상)
        order.updateDetails(req.customerName(), req.customerPhone(), req.address(),
                req.latitude(), req.longitude());

        if (reassigning) {
            bikeRepository.findByIdAndDeletedAtIsNull(req.bikeId())
                    .orElseThrow(() -> new ResourceNotFoundException("Bike", req.bikeId()));
            // 배차 방식 축(콜/단일/순차)은 용도 단일화로 사라졌다 — 재배정 조건은
            // "활성 매칭이 있는 차량" 하나로 충분하다. 매칭 없는 차량에 배차가 가면
            // 수행할 사람이 없다.
            if (contractRepository.findActiveByBikeId(req.bikeId()).isEmpty()) {
                throw new InvalidStateTransitionException("활성 매칭이 없는 차량입니다.");
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
        return appendForBike(bikeId, customerName, customerPhone, address, latitude, longitude,
                originAddress, originLatitude, originLongitude, null, null);
    }

    public DispatchOrderReadResponse appendForBike(UUID bikeId, String customerName, String customerPhone,
                                                   String address, double latitude, double longitude,
                                                   String originAddress, Double originLatitude, Double originLongitude,
                                                   Instant scheduledAt, Integer serviceMinutes) {
        long nextSequence = nextSequence(bikeId);
        DispatchOrder order = DispatchOrder.create(
                bikeId, customerName, customerPhone, address, latitude, longitude, nextSequence);
        order.setOrigin(originAddress, originLatitude, originLongitude);
        if (scheduledAt != null) {
            order.scheduleCleaning(scheduledAt, serviceMinutes);
        }
        // idx 는 DB bigserial 이라 save() 직후에는 엔티티에 값이 없다. 응답에 idx 를
        // 실어야 하므로 flush 후 refresh 로 읽어온다 (BikeCommandService 와 같은 방식).
        DispatchOrder saved = dispatchOrderRepository.save(order);
        entityManager.flush();
        entityManager.refresh(saved);
        return DispatchOrderReadResponse.from(saved);
    }

    private long nextSequence(UUID bikeId) {
        return dispatchOrderRepository
                .findTopByBikeIdAndDeletedAtIsNullOrderBySequenceDesc(bikeId)
                .map(order -> order.getSequence() + 1)
                .orElse(1L);
    }
}
