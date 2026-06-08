package com.thundercrew.opsapi.testmatching.rider.repository;

import com.thundercrew.opsapi.testmatching.rider.domain.TestRider;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TestRiderRepository extends JpaRepository<TestRider, UUID> {
    Optional<TestRider> findByIdAndDeletedAtIsNull(UUID id);
    List<TestRider> findAllByDeletedAtIsNullOrderByIdxAsc();
    boolean existsByPhoneNumberAndDeletedAtIsNull(String phoneNumber);
}
