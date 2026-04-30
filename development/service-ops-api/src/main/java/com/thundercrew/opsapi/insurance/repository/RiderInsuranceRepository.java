package com.thundercrew.opsapi.insurance.repository;

import com.thundercrew.opsapi.insurance.domain.RiderInsurance;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.Repository;

public interface RiderInsuranceRepository extends Repository<RiderInsurance, UUID> {

    Page<RiderInsurance> findByDeletedAtIsNull(Pageable pageable);

    Optional<RiderInsurance> findByIdAndDeletedAtIsNull(UUID id);

    boolean existsByRiderIdAndInsuranceItemIdAndDeletedAtIsNull(UUID riderId, UUID insuranceItemId);

    boolean existsByInsuranceItemIdAndEnabledTrueAndDeletedAtIsNull(UUID insuranceItemId);

    RiderInsurance save(RiderInsurance riderInsurance);
}
