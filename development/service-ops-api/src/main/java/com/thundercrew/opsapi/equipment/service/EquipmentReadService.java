package com.thundercrew.opsapi.equipment.service;

import com.thundercrew.opsapi.common.api.PageResponse;
import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import com.thundercrew.opsapi.equipment.dto.BikeEquipmentReadResponse;
import com.thundercrew.opsapi.equipment.dto.EquipmentTypeReadResponse;
import com.thundercrew.opsapi.equipment.repository.BikeEquipmentRepository;
import com.thundercrew.opsapi.equipment.repository.EquipmentTypeRepository;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class EquipmentReadService {

    private final EquipmentTypeRepository equipmentTypeRepository;
    private final BikeEquipmentRepository bikeEquipmentRepository;

    public EquipmentReadService(EquipmentTypeRepository equipmentTypeRepository, BikeEquipmentRepository bikeEquipmentRepository) {
        this.equipmentTypeRepository = equipmentTypeRepository;
        this.bikeEquipmentRepository = bikeEquipmentRepository;
    }

    public PageResponse<EquipmentTypeReadResponse> listTypes(Pageable pageable) {
        return PageResponse.of(equipmentTypeRepository.findByDeletedAtIsNull(pageable).map(EquipmentTypeReadResponse::from));
    }

    public EquipmentTypeReadResponse getType(UUID id) {
        return equipmentTypeRepository.findByIdAndDeletedAtIsNull(id)
                .map(EquipmentTypeReadResponse::from)
                .orElseThrow(() -> new ResourceNotFoundException("EquipmentType", id));
    }

    public PageResponse<BikeEquipmentReadResponse> listBikeEquipments(Pageable pageable) {
        return PageResponse.of(bikeEquipmentRepository.findByDeletedAtIsNull(pageable).map(BikeEquipmentReadResponse::from));
    }

    public BikeEquipmentReadResponse getBikeEquipment(UUID id) {
        return bikeEquipmentRepository.findByIdAndDeletedAtIsNull(id)
                .map(BikeEquipmentReadResponse::from)
                .orElseThrow(() -> new ResourceNotFoundException("BikeEquipment", id));
    }
}
