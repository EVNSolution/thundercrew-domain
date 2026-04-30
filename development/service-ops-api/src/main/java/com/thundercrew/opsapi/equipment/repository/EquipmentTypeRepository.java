package com.thundercrew.opsapi.equipment.repository;

import com.thundercrew.opsapi.equipment.domain.EquipmentType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.Repository;

public interface EquipmentTypeRepository extends Repository<EquipmentType, UUID> {

    Page<EquipmentType> findByDeletedAtIsNull(Pageable pageable);

    Optional<EquipmentType> findByIdAndDeletedAtIsNull(UUID id);

    boolean existsByNameAndDeletedAtIsNull(String name);

    boolean existsByNameAndIdNotAndDeletedAtIsNull(String name, UUID id);

    EquipmentType save(EquipmentType equipmentType);
}
