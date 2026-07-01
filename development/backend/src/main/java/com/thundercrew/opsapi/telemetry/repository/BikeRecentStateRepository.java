package com.thundercrew.opsapi.telemetry.repository;

import com.thundercrew.opsapi.telemetry.domain.BikeRecentState;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.Repository;

public interface BikeRecentStateRepository extends Repository<BikeRecentState, UUID> {

    Page<BikeRecentState> findByBikeIdOrderByReceivedAtDesc(UUID bikeId, Pageable pageable);

    BikeRecentState save(BikeRecentState state);
}
