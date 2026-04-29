package com.thundercrew.opsapi.insurance.repository;

import com.thundercrew.opsapi.insurance.domain.InsuranceItem;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.Repository;

public interface InsuranceItemRepository extends Repository<InsuranceItem, UUID> {

    Page<InsuranceItem> findByDeletedAtIsNull(Pageable pageable);

    Optional<InsuranceItem> findByIdAndDeletedAtIsNull(UUID id);
}
