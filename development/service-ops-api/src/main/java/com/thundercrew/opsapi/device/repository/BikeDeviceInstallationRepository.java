package com.thundercrew.opsapi.device.repository;

import com.thundercrew.opsapi.device.domain.BikeDeviceInstallation;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.Repository;

public interface BikeDeviceInstallationRepository extends Repository<BikeDeviceInstallation, UUID> {

    Page<BikeDeviceInstallation> findByDeletedAtIsNull(Pageable pageable);

    Optional<BikeDeviceInstallation> findByIdAndDeletedAtIsNull(UUID id);
}
