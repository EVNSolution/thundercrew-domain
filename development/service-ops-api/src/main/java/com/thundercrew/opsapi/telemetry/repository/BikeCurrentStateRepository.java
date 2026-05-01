package com.thundercrew.opsapi.telemetry.repository;

import com.thundercrew.opsapi.telemetry.domain.BikeCurrentState;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.Repository;

public interface BikeCurrentStateRepository extends Repository<BikeCurrentState, UUID> {

    Page<BikeCurrentState> findAll(Pageable pageable);

    Optional<BikeCurrentState> findByBikeId(UUID bikeId);

    BikeCurrentState save(BikeCurrentState state);
}
