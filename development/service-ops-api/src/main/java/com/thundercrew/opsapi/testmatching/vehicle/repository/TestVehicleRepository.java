package com.thundercrew.opsapi.testmatching.vehicle.repository;

import com.thundercrew.opsapi.testmatching.vehicle.domain.TestVehicle;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TestVehicleRepository extends JpaRepository<TestVehicle, UUID> {
    Optional<TestVehicle> findByIdAndDeletedAtIsNull(UUID id);
    List<TestVehicle> findAllByDeletedAtIsNullOrderByIdxAsc();
    boolean existsByPlateNumberAndDeletedAtIsNull(String plateNumber);
}
