package com.thundercrew.opsapi.station.repository;

import com.thundercrew.opsapi.station.domain.BatteryStation;
import com.thundercrew.opsapi.station.domain.BatteryStationStatus;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.Repository;

public interface BatteryStationRepository extends Repository<BatteryStation, UUID> {

    Page<BatteryStation> findByDeletedAtIsNull(Pageable pageable);

    List<BatteryStation> findByStatusAndDeletedAtIsNull(BatteryStationStatus status);

    Optional<BatteryStation> findById(UUID id);

    Optional<BatteryStation> findByIdAndDeletedAtIsNull(UUID id);

    boolean existsByAddressAndDeletedAtIsNull(String address);

    boolean existsByAddressAndIdNotAndDeletedAtIsNull(String address, UUID id);

    BatteryStation save(BatteryStation station);
}
