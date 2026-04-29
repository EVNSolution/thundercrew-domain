package com.thundercrew.opsapi.bike.repository;

import com.thundercrew.opsapi.bike.domain.Bike;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.Repository;

public interface BikeRepository extends Repository<Bike, UUID> {

    Page<Bike> findByDeletedAtIsNull(Pageable pageable);

    Optional<Bike> findByIdAndDeletedAtIsNull(UUID id);
}
