package com.thundercrew.opsapi.bike.repository;

import com.thundercrew.opsapi.bike.domain.Bike;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

public interface BikeRepository extends Repository<Bike, UUID> {

    Page<Bike> findByDeletedAtIsNull(Pageable pageable);

    boolean existsById(UUID id);

    Optional<Bike> findByIdAndDeletedAtIsNull(UUID id);

    boolean existsByPlateNumberAndDeletedAtIsNull(String plateNumber);

    boolean existsByPlateNumberAndIdNotAndDeletedAtIsNull(String plateNumber, UUID id);

    boolean existsByVinAndDeletedAtIsNull(String vin);

    boolean existsByVinAndIdNotAndDeletedAtIsNull(String vin, UUID id);

    Bike save(Bike bike);

    @Query(value = """
            select exists (
                select 1
                from rider_bike_contracts
                where bike_id = :bikeId
                  and deleted_at is null
                  and terminated_at is null
            )
            """, nativeQuery = true)
    boolean existsActiveContractReference(@Param("bikeId") UUID bikeId);

    @Query(value = """
            select exists (
                select 1
                from bike_equipments
                where bike_id = :bikeId
                  and deleted_at is null
                  and removed_at is null
            )
            """, nativeQuery = true)
    boolean existsActiveEquipmentReference(@Param("bikeId") UUID bikeId);

    @Query(value = """
            select exists (
                select 1
                from bike_device_installations
                where bike_id = :bikeId
                  and deleted_at is null
                  and removed_at is null
            )
            """, nativeQuery = true)
    boolean existsActiveDeviceInstallationReference(@Param("bikeId") UUID bikeId);

    Optional<Bike> findByPlateNumberAndDeletedAtIsNull(String plateNumber);

    List<Bike> findAllByDeletedAtIsNull();
}
