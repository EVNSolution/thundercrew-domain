package com.thundercrew.opsapi.station.repository;

import com.thundercrew.opsapi.station.domain.BatteryStation;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.Repository;

public interface BatteryStationRepository extends Repository<BatteryStation, UUID> {

    Page<BatteryStation> findByDeletedAtIsNull(Pageable pageable);

    Optional<BatteryStation> findById(UUID id);

    Optional<BatteryStation> findByIdAndDeletedAtIsNull(UUID id);

    boolean existsByNameAndDeletedAtIsNull(String name);

    boolean existsByNameAndIdNotAndDeletedAtIsNull(String name, UUID id);

    BatteryStation save(BatteryStation station);
}
