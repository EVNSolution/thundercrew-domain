package com.thundercrew.opsapi.maintenance.repository;

import com.thundercrew.opsapi.maintenance.domain.VehicleMaintenanceRecord;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.repository.Repository;

public interface VehicleMaintenanceRecordRepository extends Repository<VehicleMaintenanceRecord, UUID> {

    VehicleMaintenanceRecord save(VehicleMaintenanceRecord record);

    Optional<VehicleMaintenanceRecord> findByIdAndDeletedAtIsNull(UUID id);

    /**
     * 한 차량의 모든 정비 이력 (최신순). UI 가 품목별로 마지막 교환을 derive
     * 할 때 시간 역순으로 한 번 훑는다.
     */
    List<VehicleMaintenanceRecord> findByBikeIdAndDeletedAtIsNullOrderByServicedAtDesc(UUID bikeId);
}
