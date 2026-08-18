package com.thundercrew.opsapi.dispatch.repository;

import com.thundercrew.opsapi.dispatch.domain.DispatchOrder;
import com.thundercrew.opsapi.dispatch.domain.DispatchOrderStatus;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.repository.Repository;

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

    DispatchOrder save(DispatchOrder order);
}
