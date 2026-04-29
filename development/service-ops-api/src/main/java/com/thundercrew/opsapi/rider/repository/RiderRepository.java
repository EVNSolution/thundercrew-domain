package com.thundercrew.opsapi.rider.repository;

import com.thundercrew.opsapi.rider.domain.Rider;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.Repository;

public interface RiderRepository extends Repository<Rider, UUID> {

    Page<Rider> findByDeletedAtIsNull(Pageable pageable);

    Optional<Rider> findByIdAndDeletedAtIsNull(UUID id);
}
