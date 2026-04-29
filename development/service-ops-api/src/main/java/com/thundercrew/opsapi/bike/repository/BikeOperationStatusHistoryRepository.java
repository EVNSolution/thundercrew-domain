package com.thundercrew.opsapi.bike.repository;

import com.thundercrew.opsapi.bike.domain.BikeOperationStatusHistory;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.Repository;

public interface BikeOperationStatusHistoryRepository extends Repository<BikeOperationStatusHistory, UUID> {

    Page<BikeOperationStatusHistory> findByDeletedAtIsNull(Pageable pageable);

    Optional<BikeOperationStatusHistory> findByIdAndDeletedAtIsNull(UUID id);
}
