package com.thundercrew.opsapi.contract.repository;

import com.thundercrew.opsapi.contract.domain.RiderBikeContract;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.Repository;

public interface RiderBikeContractRepository extends Repository<RiderBikeContract, UUID> {

    Page<RiderBikeContract> findByDeletedAtIsNull(Pageable pageable);

    Optional<RiderBikeContract> findByIdAndDeletedAtIsNull(UUID id);
}
