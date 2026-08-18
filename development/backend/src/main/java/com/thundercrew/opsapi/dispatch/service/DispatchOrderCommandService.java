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
import com.thundercrew.opsapi.settings.service.AppSettingService;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
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
    private final AppSettingService appSettingService;

    public DispatchOrderCommandService(DispatchOrderRepository dispatchOrderRepository,
                                       AuditLogCommandService auditLogCommandService,
                                       Clock clock,
                                       BikeRepository bikeRepository,
                                       RiderBikeContractRepository contractRepository,
                                       EntityManager entityManager,
                                       AppSettingService appSettingService) {
        this.dispatchOrderRepository = dispatchOrderRepository;
        this.auditLogCommandService = auditLogCommandService;
        this.clock = clock;
        this.bikeRepository = bikeRepository;
        this.contractRepository = contractRepository;
        this.entityManager = entityManager;
        this.appSettingService = appSettingService;
    }

    /** 클리닝 건별 소요시간 기본값(분) — 설정(§6) 오버레이 포함 현재 유효값. */
    private int defaultServiceMinutes() {
        return appSettingService.dispatchTuning().defaultServiceMinutes();
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
            int minutes = request.serviceMinutes() != null ? request.serviceMinutes() : defaultServiceMinutes();
            Instant endAt = request.scheduledAt().plus(Duration.ofMinutes(minutes));
            assertNoCleaningOverlap(request.bikeId(), request.scheduledAt(), endAt, null);
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

    /**
     * 같은 차량의 클리닝 시간 겹침 검사. check-then-insert 경합을 차량 단위
     * advisory lock (트랜잭션 종료 시 자동 해제) 으로 직렬화한다 — 두 운영자가
     * 같은 차량·같은 시간대를 동시에 넣어도 한쪽은 겹침을 본다.
     */
    private void assertNoCleaningOverlap(UUID bikeId, Instant startAt, Instant endAt, UUID excludeOrderId) {
        entityManager.createNativeQuery("select pg_advisory_xact_lock(hashtext(:key))")
                .setParameter("key", "cleaning-overlap:" + bikeId)
                .getSingleResult();
        boolean overlap = excludeOrderId == null
                ? dispatchOrderRepository.existsCleaningOverlap(bikeId, startAt, endAt, defaultServiceMinutes())
                : dispatchOrderRepository.existsCleaningOverlapExcluding(
                        bikeId, startAt, endAt, defaultServiceMinutes(), excludeOrderId);
        if (overlap) {
            throw new ValidationFailedException("해당 시간대에 이미 배정된 클리닝 일정이 있습니다.");
        }
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
        // 완료돼 있던 사이 같은 슬롯에 새 일정이 들어왔을 수 있다 — 되돌리면
        // 겹침 2건이 성립하므로 재검증 후 거부한다.
        if (order.getStatus() == DispatchOrderStatus.COMPLETED && order.getScheduledAt() != null) {
            int minutes = order.getServiceMinutes() != null ? order.getServiceMinutes() : defaultServiceMinutes();
            assertNoCleaningOverlap(order.getBikeId(), order.getScheduledAt(),
                    order.getScheduledAt().plus(Duration.ofMinutes(minutes)), order.getId());
        }
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
        // 예정 시각 변경 — 시간 배차(클리닝) 주문에만 허용. 재배정과 겹칠 수
        // 있으므로 겹침 검증은 항상 "변경 후" 시각으로 수행한다.
        if (req.scheduledAt() != null && order.getScheduledAt() == null) {
            throw new ValidationFailedException("배송 배차에는 예정 시각을 설정할 수 없습니다.");
        }
        boolean rescheduling = req.scheduledAt() != null && !req.scheduledAt().equals(order.getScheduledAt());
        Instant effectiveScheduledAt = req.scheduledAt() != null ? req.scheduledAt() : order.getScheduledAt();

        // 고객/주소 갱신(항상)
        order.updateDetails(req.customerName(), req.customerPhone(), req.address(),
                req.latitude(), req.longitude());

        if (reassigning) {
            Bike targetBike = bikeRepository.findByIdAndDeletedAtIsNull(req.bikeId())
                    .orElseThrow(() -> new ResourceNotFoundException("Bike", req.bikeId()));
            if (contractRepository.findActiveByBikeId(req.bikeId()).isEmpty()) {
                throw new InvalidStateTransitionException("활성 매칭이 없는 차량입니다.");
            }
            // 주문의 배차 축은 scheduledAt 유무로 갈린다 — 시간 배차(클리닝)는
            // 클린차량으로만, 순번 배차(배송)는 배송용으로만 옮길 수 있다.
            // 어기면 일정표·알림·자동 배차가 반쪽 상태의 행을 만나게 된다.
            if (order.getScheduledAt() != null) {
                if (targetBike.getPurpose() != BikePurpose.CLEANING) {
                    throw new ValidationFailedException("시간 배차(클리닝)는 클린차량으로만 재배정할 수 있습니다.");
                }
                int minutes = order.getServiceMinutes() != null ? order.getServiceMinutes() : defaultServiceMinutes();
                assertNoCleaningOverlap(req.bikeId(), effectiveScheduledAt,
                        effectiveScheduledAt.plus(Duration.ofMinutes(minutes)), order.getId());
            } else if (targetBike.getPurpose() != BikePurpose.DELIVERY) {
                throw new ValidationFailedException("배송 배차는 배송용 차량으로만 재배정할 수 있습니다.");
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

        if (rescheduling) {
            // 재배정 블록이 이미 새 차량 기준으로 effective 시각을 검증했다 —
            // 미재배정이면 현재 차량 기준으로 여기서 검증한다.
            if (!reassigning) {
                int minutes = order.getServiceMinutes() != null ? order.getServiceMinutes() : defaultServiceMinutes();
                assertNoCleaningOverlap(order.getBikeId(), effectiveScheduledAt,
                        effectiveScheduledAt.plus(Duration.ofMinutes(minutes)), order.getId());
            }
            order.scheduleCleaning(effectiveScheduledAt, order.getServiceMinutes());
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

    /**
     * 시뮬 클리닝 배차 체인 리셋 — IMEI 가 "-" 로 시작하는 클린차량의 시간
     * 배차 전부를 ASSIGNED 로 되돌리고 예정 시각을 "지금 + 5분" 부터 9분
     * 간격(시뮬 이동 2~5분 + 작업 30초 + 반영 여유)으로 재배정한다. 관제
     * 화면 로드마다 호출돼 새로고침할 때마다 시나리오가 처음부터 돈다.
     * 실차(IMEI 15자리)는 절대 건드리지 않는다.
     */
    public int resetSimulationCleaningChains() {
        List<Bike> simBikes = bikeRepository.findAllByDeletedAtIsNull().stream()
                .filter(b -> b.getImei() != null && b.getImei().startsWith("-"))
                .filter(b -> b.getPurpose() == BikePurpose.CLEANING)
                .toList();
        int reset = 0;
        for (Bike bike : simBikes) {
            // 미래 일정(운영자가 내일 등록한 건 등)은 건드리지 않는다 —
            // 리셋 대상은 "지금 진행 중이어야 할" 체인, 즉 예정 시각이
            // 2시간 뒤보다 이른 건뿐이다.
            Instant horizon = clock.instant().plus(Duration.ofHours(2));
            List<DispatchOrder> orders = dispatchOrderRepository
                    .findByBikeIdAndDeletedAtIsNullOrderBySequenceAsc(bike.getId()).stream()
                    .filter(o -> o.getScheduledAt() != null && o.getScheduledAt().isBefore(horizon))
                    .sorted(java.util.Comparator.comparing(DispatchOrder::getScheduledAt))
                    .toList();
            Instant base = clock.instant().plus(Duration.ofMinutes(5));
            int i = 0;
            for (DispatchOrder order : orders) {
                order.resetForSimulation(base.plus(Duration.ofMinutes(9L * i)));
                i++;
                reset++;
            }
        }
        return reset;
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
