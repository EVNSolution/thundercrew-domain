package com.thundercrew.opsapi.device.repository;

import com.thundercrew.opsapi.device.domain.Device;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.Repository;

public interface DeviceRepository extends Repository<Device, UUID> {

    Page<Device> findByDeletedAtIsNull(Pageable pageable);

    Optional<Device> findById(UUID id);

    Optional<Device> findByIdAndDeletedAtIsNull(UUID id);

    Optional<Device> findByDeviceUidAndDeletedAtIsNull(String deviceUid);

    boolean existsByDeviceUidAndDeletedAtIsNull(String deviceUid);

    boolean existsByDeviceUidAndIdNotAndDeletedAtIsNull(String deviceUid, UUID id);

    Device save(Device device);
}
