package com.thundercrew.opsapi.dispatch.service;

import com.thundercrew.opsapi.audit.dto.AuditLogCreateRequest;
import com.thundercrew.opsapi.audit.service.AuditLogCommandService;
import com.thundercrew.opsapi.dispatch.domain.DispatchOrder;
import com.thundercrew.opsapi.dispatch.domain.DispatchOrderStatus;
import com.thundercrew.opsapi.dispatch.repository.DispatchOrderRepository;
import com.thundercrew.opsapi.notification.repository.NotificationRepository;
import com.thundercrew.opsapi.notification.service.NotificationCommandService;
import com.thundercrew.opsapi.telemetry.domain.BikeCurrentState;
import com.thundercrew.opsapi.telemetry.domain.TelemetryConnection;
import com.thundercrew.opsapi.telemetry.domain.TelemetryIgnitionStatus;
import com.thundercrew.opsapi.telemetry.repository.BikeCurrentStateRepository;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 완료 자동 추정 + 클리닝 임박/지연 알림 스케줄러 (3단계).
 *
 * 자동 완료 판정 (배송·클리닝 공통):
 *   목적지 반경 진입 → 정지(시동 OFF 또는 저속) 유지 → "도착 감지" 확정
 *   → 이후 반경 이탈 → COMPLETED (source=AUTO)
 *
 * 정지 유지·도착 확정은 틱 사이에 상태를 이어가야 해서 주문 행의
 * arrival_stop_since / arrival_detected_at (V64) 에 기록한다.
 *
 * 텔레메트리 미연결(OFFLINE) 차량은 판정하지 않는다 — 모니터가 "추정 불가"
 * 로 표시하고 운영자가 수동 완료한다. 반경·정지 시간 등 기준값은 현장 보정
 * 전제로 properties 에서 조정한다 (설정 화면은 4단계).
 *
 * 구조는 {@link com.thundercrew.opsapi.maintenance.service.MaintenanceAlarmEvaluator}
 * 를 따른다 — 건별 try/catch 로 한 건 실패가 나머지를 막지 않는다.
 */
@Service
public class DispatchCompletionEvaluator {

    private static final Logger log = LoggerFactory.getLogger(DispatchCompletionEvaluator.class);
    private static final String TYPE_CLEANING_DUE = "CLEANING_DUE";
    private static final String TYPE_CLEANING_DELAYED = "CLEANING_DELAYED";
    private static final double EARTH_RADIUS_M = 6371000.0;

    private final DispatchOrderRepository dispatchOrderRepository;
    private final BikeCurrentStateRepository bikeCurrentStateRepository;
    private final NotificationRepository notificationRepository;
    private final NotificationCommandService notificationCommandService;
    private final AuditLogCommandService auditLogCommandService;
    private final Clock clock;

    private final double arrivalRadiusMeters;
    private final Duration stopHold;
    private final double stopSpeedThresholdKph;
    private final int defaultServiceMinutes;
    private final Duration dueLead;

    public DispatchCompletionEvaluator(
            DispatchOrderRepository dispatchOrderRepository,
            BikeCurrentStateRepository bikeCurrentStateRepository,
            NotificationRepository notificationRepository,
            NotificationCommandService notificationCommandService,
            AuditLogCommandService auditLogCommandService,
            Clock clock,
            @Value("${thundercrew.dispatch.arrival-radius-m:100}") double arrivalRadiusMeters,
            @Value("${thundercrew.dispatch.arrival-stop-minutes:3}") long stopHoldMinutes,
            @Value("${thundercrew.dispatch.stop-speed-threshold-kph:3}") double stopSpeedThresholdKph,
            @Value("${thundercrew.dispatch.default-service-minutes:60}") int defaultServiceMinutes,
            @Value("${thundercrew.dispatch.due-lead-minutes:30}") long dueLeadMinutes
    ) {
        this.dispatchOrderRepository = dispatchOrderRepository;
        this.bikeCurrentStateRepository = bikeCurrentStateRepository;
        this.notificationRepository = notificationRepository;
        this.notificationCommandService = notificationCommandService;
        this.auditLogCommandService = auditLogCommandService;
        this.clock = clock;
        this.arrivalRadiusMeters = arrivalRadiusMeters;
        this.stopHold = Duration.ofMinutes(stopHoldMinutes);
        this.stopSpeedThresholdKph = stopSpeedThresholdKph;
        this.defaultServiceMinutes = defaultServiceMinutes;
        this.dueLead = Duration.ofMinutes(dueLeadMinutes);
    }

    @Scheduled(fixedDelayString = "${thundercrew.dispatch.completion-interval-ms:60000}")
    @Transactional
    public void evaluate() {
        Instant now = Instant.now(clock);
        List<DispatchOrder> assigned =
                dispatchOrderRepository.findByStatusAndDeletedAtIsNull(DispatchOrderStatus.ASSIGNED);
        for (DispatchOrder order : assigned) {
            try {
                evaluateOrder(order, now);
            } catch (Exception ex) {
                log.error("DispatchCompletionEvaluator: 주문 {} 판정 실패 — 건너뜀", order.getId(), ex);
            }
        }
    }

    private void evaluateOrder(DispatchOrder order, Instant now) {
        if (order.getBikeId() != null) {
            evaluateAutoCompletion(order, now);
        }
        if (order.getScheduledAt() != null) {
            evaluateCleaningAlerts(order, now);
        }
    }

    // ── 자동 완료 ──────────────────────────────────────────────────

    private void evaluateAutoCompletion(DispatchOrder order, Instant now) {
        Optional<BikeCurrentState> maybe = bikeCurrentStateRepository.findByBikeId(order.getBikeId());
        if (maybe.isEmpty()) {
            return; // 텔레메트리가 한 번도 없던 차량 — 추정 불가.
        }
        BikeCurrentState state = maybe.get();
        if (!"ONLINE".equals(TelemetryConnection.status(
                state.getLastReceivedAt(), now, state.getIgnitionStatus()))) {
            // 오프라인 동안의 상태는 신뢰할 수 없다. 도착 추적을 이어가지 않고
            // 리셋한다 — 재접속 후 처음부터 다시 판정.
            if (order.getArrivalStopSince() != null) {
                order.clearArrivalStop();
            }
            return;
        }
        if (state.getLatitude() == null || state.getLongitude() == null) {
            return;
        }

        double distance = haversineMeters(
                state.getLatitude(), state.getLongitude(), order.getLatitude(), order.getLongitude());
        boolean inRadius = distance <= arrivalRadiusMeters;
        boolean stopped = isStopped(state);

        if (order.getArrivalDetectedAt() != null) {
            // 도착 감지 확정 상태 — 반경을 벗어나는 순간 완료.
            if (!inRadius) {
                order.completeAuto(now);
                auditLogCommandService.record(new AuditLogCreateRequest(
                        "DISPATCH_ORDER", order.getId(), "status", "ASSIGNED", "COMPLETED"));
                log.info("자동 완료: 주문 {} (차량 {}) — 도착 감지 {} 후 반경 이탈",
                        order.getId(), order.getBikeId(), order.getArrivalDetectedAt());
            }
            return;
        }

        if (inRadius && stopped) {
            if (order.getArrivalStopSince() == null) {
                order.markArrivalStop(now);
            } else if (Duration.between(order.getArrivalStopSince(), now).compareTo(stopHold) >= 0) {
                order.confirmArrival(now);
            }
        } else if (order.getArrivalStopSince() != null) {
            // 반경 이탈 또는 재이동 — 정지 관측을 처음부터 다시.
            order.clearArrivalStop();
        }
    }

    private boolean isStopped(BikeCurrentState state) {
        if (state.getIgnitionStatus() == TelemetryIgnitionStatus.OFF) {
            return true;
        }
        BigDecimal speed = state.getSpeedKph();
        return speed != null && speed.doubleValue() < stopSpeedThresholdKph;
    }

    private static double haversineMeters(BigDecimal lat1, BigDecimal lon1, double lat2, double lon2) {
        double phi1 = Math.toRadians(lat1.doubleValue());
        double phi2 = Math.toRadians(lat2);
        double dPhi = Math.toRadians(lat2 - lat1.doubleValue());
        double dLambda = Math.toRadians(lon2 - lon1.doubleValue());
        double a = Math.sin(dPhi / 2) * Math.sin(dPhi / 2)
                + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) * Math.sin(dLambda / 2);
        return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    // ── 클리닝 임박/지연 알림 ─────────────────────────────────────

    private void evaluateCleaningAlerts(DispatchOrder order, Instant now) {
        Instant scheduledAt = order.getScheduledAt();
        int minutes = order.getServiceMinutes() != null ? order.getServiceMinutes() : defaultServiceMinutes;
        Instant plannedEnd = scheduledAt.plus(Duration.ofMinutes(minutes));

        // 임박: 예정 N분 전 ~ 예정 시각 사이 1회.
        if (!now.isBefore(scheduledAt.minus(dueLead)) && now.isBefore(scheduledAt)) {
            recordOnce(order, TYPE_CLEANING_DUE, scheduledAt.minus(dueLead), now,
                    "클리닝 예정 임박",
                    order.getCustomerName() + " · " + order.getAddress());
        }

        // 지연: 예정 종료를 넘겼는데 아직 미완료 — 1회.
        if (now.isAfter(plannedEnd)) {
            recordOnce(order, TYPE_CLEANING_DELAYED, plannedEnd, now,
                    "클리닝 일정 지연",
                    order.getCustomerName() + " · " + order.getAddress());
        }
    }

    /** (차량, 주문, 타입) 기준 창(threshold 이후) 내 중복 알림 방지 후 생성. */
    private void recordOnce(DispatchOrder order, String type, Instant windowStart, Instant now,
                            String title, String body) {
        boolean exists = notificationRepository
                .existsByRefBikeIdAndRefEntityIdAndTypeAndOccurredAtAfterAndDeletedAtIsNull(
                        order.getBikeId(), order.getId(), type, windowStart);
        if (exists) {
            return;
        }
        notificationCommandService.record(type, title, body, order.getBikeId(), order.getId(), null, now);
    }
}
