package com.thundercrew.opsapi.maintenance.repository;

import com.thundercrew.opsapi.maintenance.domain.VehicleMaintenanceRecord;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.Repository;

public interface VehicleMaintenanceRecordRepository extends Repository<VehicleMaintenanceRecord, UUID> {

    VehicleMaintenanceRecord save(VehicleMaintenanceRecord record);

    Optional<VehicleMaintenanceRecord> findByIdAndDeletedAtIsNull(UUID id);

    /**
     * 한 차량의 모든 정비 이력 (최신순). UI 가 품목별로 마지막 교환을 derive
     * 할 때 시간 역순으로 한 번 훑는다.
     */
    List<VehicleMaintenanceRecord> findByBikeIdAndDeletedAtIsNullOrderByServicedAtDesc(UUID bikeId);

    /**
     * 전체 차량의 정비 이력 (페이징). 차량 탭의 "정비 상태" 필터가 모든 차량의
     * 마지막 교환 시점을 한 번에 받기 위해 사용. MVP 규모(< 200 차량 × ~10 품목)
     * 에서 한 페이지 (size=500) 면 1회 호출로 충분.
     */
    Page<VehicleMaintenanceRecord> findByDeletedAtIsNull(Pageable pageable);
}
