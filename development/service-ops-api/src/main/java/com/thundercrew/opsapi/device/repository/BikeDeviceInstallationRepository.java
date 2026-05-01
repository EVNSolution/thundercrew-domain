package com.thundercrew.opsapi.device.repository;

import com.thundercrew.opsapi.device.domain.BikeDeviceInstallation;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

public interface BikeDeviceInstallationRepository extends Repository<BikeDeviceInstallation, UUID> {

    Page<BikeDeviceInstallation> findByDeletedAtIsNull(Pageable pageable);

    Optional<BikeDeviceInstallation> findByIdAndDeletedAtIsNull(UUID id);

    boolean existsByDeviceIdAndRemovedAtIsNullAndDeletedAtIsNull(UUID deviceId);

    Optional<BikeDeviceInstallation> findByBikeIdAndRemovedAtIsNullAndDeletedAtIsNull(UUID bikeId);

    Optional<BikeDeviceInstallation> findByDeviceIdAndRemovedAtIsNullAndDeletedAtIsNull(UUID deviceId);

    @Query(value = """
            select *
            from bike_device_installations
            where device_id = :deviceId
              and deleted_at is null
              and installed_at <= :observedAt
              and (removed_at is null or removed_at >= :observedAt)
            order by installed_at desc
            limit 1
            """, nativeQuery = true)
    Optional<BikeDeviceInstallation> findActiveAtByDeviceId(
            @Param("deviceId") UUID deviceId,
            @Param("observedAt") java.time.Instant observedAt
    );

    BikeDeviceInstallation save(BikeDeviceInstallation installation);
}
