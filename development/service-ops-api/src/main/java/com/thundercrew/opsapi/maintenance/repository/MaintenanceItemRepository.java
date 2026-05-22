package com.thundercrew.opsapi.maintenance.repository;

import com.thundercrew.opsapi.maintenance.domain.MaintenanceAppliesTo;
import com.thundercrew.opsapi.maintenance.domain.MaintenanceItem;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.Repository;

public interface MaintenanceItemRepository extends Repository<MaintenanceItem, UUID> {

    MaintenanceItem save(MaintenanceItem item);

    Optional<MaintenanceItem> findByIdAndDeletedAtIsNull(UUID id);

    Page<MaintenanceItem> findByDeletedAtIsNull(Pageable pageable);

    /**
     * 차량 단위 catalog 조회 — bike.engineType 이 ELECTRIC 이면
     * `appliesTo IN (ELECTRIC, BOTH)`, ICE 면 `(ICE, BOTH)`.
     * 서비스 측에서 호출 전에 in-list 를 만들어 넘긴다.
     */
    List<MaintenanceItem> findByAppliesToInAndDeletedAtIsNullOrderByDisplayOrderAsc(
            List<MaintenanceAppliesTo> appliesTo
    );
}
