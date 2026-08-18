package com.thundercrew.opsapi.equipment.repository;

import com.thundercrew.opsapi.equipment.domain.BikeEquipment;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.Repository;

public interface BikeEquipmentRepository extends Repository<BikeEquipment, UUID> {

    Page<BikeEquipment> findByDeletedAtIsNull(Pageable pageable);

    Page<BikeEquipment> findByBikeIdAndDeletedAtIsNull(UUID bikeId, Pageable pageable);

    Optional<BikeEquipment> findByIdAndDeletedAtIsNull(UUID id);

    boolean existsByEquipmentTypeIdAndRemovedAtIsNullAndDeletedAtIsNull(UUID equipmentTypeId);

    boolean existsBySerialNumberAndRemovedAtIsNullAndDeletedAtIsNull(String serialNumber);

    boolean existsBySerialNumberAndIdNotAndRemovedAtIsNullAndDeletedAtIsNull(String serialNumber, UUID id);

    BikeEquipment save(BikeEquipment equipment);
}
