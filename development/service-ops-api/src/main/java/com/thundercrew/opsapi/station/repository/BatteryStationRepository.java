package com.thundercrew.opsapi.station.repository;

import com.thundercrew.opsapi.station.domain.BatteryStation;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.Repository;

public interface BatteryStationRepository extends Repository<BatteryStation, UUID> {

    Page<BatteryStation> findByDeletedAtIsNull(Pageable pageable);

    Optional<BatteryStation> findByIdAndDeletedAtIsNull(UUID id);
}
