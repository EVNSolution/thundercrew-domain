package com.thundercrew.opsapi.testmatching.matching.repository;

import com.thundercrew.opsapi.testmatching.matching.domain.TestMatching;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TestMatchingRepository extends JpaRepository<TestMatching, UUID> {
    Optional<TestMatching> findByIdAndDeletedAtIsNull(UUID id);
    List<TestMatching> findAllByDeletedAtIsNullOrderByIdxAsc();
}
