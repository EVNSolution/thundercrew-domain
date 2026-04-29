package com.thundercrew.opsapi.station.repository;

import com.thundercrew.opsapi.station.domain.StationBatteryCountLog;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.Repository;

public interface StationBatteryCountLogRepository extends Repository<StationBatteryCountLog, UUID> {

    Page<StationBatteryCountLog> findByDeletedAtIsNull(Pageable pageable);

    Optional<StationBatteryCountLog> findByIdAndDeletedAtIsNull(UUID id);
}
