package com.thundercrew.opsapi.dispatch.repository;

import com.thundercrew.opsapi.dispatch.domain.DispatchBatch;
import com.thundercrew.opsapi.dispatch.domain.DispatchBatchStatus;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.repository.Repository;

public interface DispatchBatchRepository extends Repository<DispatchBatch, UUID> {

    List<DispatchBatch> findByStatusInAndDeletedAtIsNull(Collection<DispatchBatchStatus> statuses);

    Optional<DispatchBatch> findByIdAndDeletedAtIsNull(UUID id);

    DispatchBatch save(DispatchBatch batch);
}
