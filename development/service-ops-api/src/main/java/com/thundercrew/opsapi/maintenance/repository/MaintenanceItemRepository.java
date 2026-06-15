package com.thundercrew.opsapi.maintenance.repository;

import com.thundercrew.opsapi.maintenance.domain.MaintenanceAppliesTo;
import com.thundercrew.opsapi.maintenance.domain.MaintenanceItem;
import com.thundercrew.opsapi.maintenance.domain.MaintenanceWheelApplies;
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

    /**
     * 차량 단위 catalog 조회 — 엔진 축 + 휠 축 동시 필터.
     * bike.engineType 과 bike.wheelType 모두 적용. 각 in-list 는 서비스 측에서 구성.
     */
    List<MaintenanceItem> findByAppliesToInAndAppliesToWheelInAndDeletedAtIsNullOrderByDisplayOrderAsc(
            List<MaintenanceAppliesTo> appliesTo, List<MaintenanceWheelApplies> appliesToWheel
    );
}
