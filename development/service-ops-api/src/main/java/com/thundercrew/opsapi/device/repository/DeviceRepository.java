package com.thundercrew.opsapi.device.repository;

import com.thundercrew.opsapi.device.domain.Device;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.Repository;

public interface DeviceRepository extends Repository<Device, UUID> {

    Page<Device> findByDeletedAtIsNull(Pageable pageable);

    Optional<Device> findByIdAndDeletedAtIsNull(UUID id);
}
