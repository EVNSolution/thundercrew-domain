package com.thundercrew.opsapi.dispatch.repository;

import com.thundercrew.opsapi.dispatch.domain.DispatchOrder;
import com.thundercrew.opsapi.dispatch.domain.DispatchOrderStatus;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

public interface DispatchOrderRepository extends Repository<DispatchOrder, UUID> {

    List<DispatchOrder> findByBikeIdAndDeletedAtIsNullOrderBySequenceAsc(UUID bikeId);

    List<DispatchOrder> findByBikeIdAndStatusAndDeletedAtIsNullOrderBySequenceAsc(
            UUID bikeId, DispatchOrderStatus status);

    List<DispatchOrder> findByStatusAndDeletedAtIsNull(DispatchOrderStatus status);

    Optional<DispatchOrder> findByIdAndDeletedAtIsNull(UUID id);

    Optional<DispatchOrder> findTopByBikeIdAndDeletedAtIsNullOrderBySequenceDesc(UUID bikeId);

    List<DispatchOrder> findByStatusAndDeletedAtIsNullOrderByCreatedAtAsc(DispatchOrderStatus status);

    List<DispatchOrder> findByBikeIdAndStatusAndDeletedAtIsNullOrderByCompletedAtDesc(UUID bikeId, DispatchOrderStatus status);

    List<DispatchOrder> findByStatusAndCompletedAtAfterAndDeletedAtIsNull(
            DispatchOrderStatus status, java.time.Instant completedAtAfter);

    /** 클리닝 일정표 — 예정 시각 범위의 시간 배차 전건 (상태 무관, 예정 시각순). */
    List<DispatchOrder> findByScheduledAtGreaterThanEqualAndScheduledAtLessThanAndDeletedAtIsNullOrderByScheduledAtAsc(
            Instant fromInclusive, Instant toExclusive);

    /**
     * 클리닝 시간 겹침 검사 — 같은 차량의 미완료 시간 배차와 [start, end) 가
     * 겹치면 참. 소요시간이 비어 있는 기존 행은 설정 기본값으로 계산한다.
     * ix_dispatch_orders_bike_scheduled (V56) 을 탄다.
     */
    @Query(value = """
            select exists (
                select 1 from dispatch_orders
                where bike_id = :bikeId
                  and deleted_at is null
                  and status = 'ASSIGNED'
                  and scheduled_at is not null
                  and scheduled_at < :endAt
                  and :startAt < scheduled_at
                        + make_interval(mins => coalesce(service_minutes, :defaultMinutes))
            )
            """, nativeQuery = true)
    boolean existsCleaningOverlap(
            @Param("bikeId") UUID bikeId,
            @Param("startAt") Instant startAt,
            @Param("endAt") Instant endAt,
            @Param("defaultMinutes") int defaultMinutes);

    DispatchOrder save(DispatchOrder order);
}
