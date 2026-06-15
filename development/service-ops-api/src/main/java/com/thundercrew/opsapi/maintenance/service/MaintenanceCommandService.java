package com.thundercrew.opsapi.maintenance.service;

import com.thundercrew.opsapi.bike.repository.BikeRepository;
import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import com.thundercrew.opsapi.maintenance.domain.MaintenanceItem;
import com.thundercrew.opsapi.maintenance.domain.VehicleMaintenanceRecord;
import com.thundercrew.opsapi.maintenance.dto.MaintenanceItemCreateRequest;
import com.thundercrew.opsapi.maintenance.dto.MaintenanceItemReadResponse;
import com.thundercrew.opsapi.maintenance.dto.MaintenanceItemUpdateRequest;
import com.thundercrew.opsapi.maintenance.dto.VehicleMaintenanceRecordCreateRequest;
import com.thundercrew.opsapi.maintenance.dto.VehicleMaintenanceRecordReadResponse;
import com.thundercrew.opsapi.maintenance.repository.MaintenanceItemRepository;
import com.thundercrew.opsapi.maintenance.repository.VehicleMaintenanceRecordRepository;
import jakarta.persistence.EntityManager;
import java.time.Clock;
import java.time.Instant;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MaintenanceCommandService {

    private final MaintenanceItemRepository itemRepository;
    private final VehicleMaintenanceRecordRepository recordRepository;
    private final BikeRepository bikeRepository;
    private final EntityManager entityManager;
    private final Clock clock;

    public MaintenanceCommandService(
            MaintenanceItemRepository itemRepository,
            VehicleMaintenanceRecordRepository recordRepository,
            BikeRepository bikeRepository,
            EntityManager entityManager,
            Clock clock
    ) {
        this.itemRepository = itemRepository;
        this.recordRepository = recordRepository;
        this.bikeRepository = bikeRepository;
        this.entityManager = entityManager;
        this.clock = clock;
    }

    @Transactional
    public MaintenanceItemReadResponse createItem(MaintenanceItemCreateRequest request) {
        MaintenanceItem item = MaintenanceItem.create(
                request.name(),
                request.appliesTo(),
                request.appliesToWheel(),
                request.parentItemId(),
                request.cycleKm(),
                request.cycleMonths(),
                request.cycleLabel(),
                request.displayOrder() != null ? request.displayOrder() : 0,
                request.memo()
        );
        MaintenanceItem saved = itemRepository.save(item);
        entityManager.flush();
        entityManager.refresh(saved);
        return MaintenanceItemReadResponse.from(saved);
    }

    @Transactional
    public MaintenanceItemReadResponse updateItem(UUID id, MaintenanceItemUpdateRequest request) {
        MaintenanceItem item = itemRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("MaintenanceItem", id));
        item.updateCatalog(
                request.name(),
                request.appliesTo(),
                request.appliesToWheel(),
                request.parentItemId(),
                request.cycleKm(),
                request.cycleMonths(),
                request.cycleLabel(),
                request.displayOrder(),
                request.enabled(),
                request.memo()
        );
        entityManager.flush();
        return MaintenanceItemReadResponse.from(item);
    }

    @Transactional
    public void softDeleteItem(UUID id) {
        MaintenanceItem item = itemRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("MaintenanceItem", id));
        item.markDeleted(null, clock.instant());
    }

    @Transactional
    public VehicleMaintenanceRecordReadResponse createRecord(
            UUID bikeId,
            VehicleMaintenanceRecordCreateRequest request
    ) {
        // bike + item 모두 존재 확인. 삭제된 행 참조 차단.
        bikeRepository.findByIdAndDeletedAtIsNull(bikeId)
                .orElseThrow(() -> new ResourceNotFoundException("Bike", bikeId));
        itemRepository.findByIdAndDeletedAtIsNull(request.itemId())
                .orElseThrow(() -> new ResourceNotFoundException("MaintenanceItem", request.itemId()));

        Instant servicedAt = request.servicedAt() != null ? request.servicedAt() : Instant.now(clock);
        VehicleMaintenanceRecord record = VehicleMaintenanceRecord.create(
                bikeId,
                request.itemId(),
                servicedAt,
                request.servicedAtOdometerKm(),
                request.memo()
        );
        VehicleMaintenanceRecord saved = recordRepository.save(record);
        entityManager.flush();
        entityManager.refresh(saved);
        return VehicleMaintenanceRecordReadResponse.from(saved);
    }

    @Transactional
    public void softDeleteRecord(UUID id) {
        VehicleMaintenanceRecord record = recordRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("VehicleMaintenanceRecord", id));
        record.markDeleted(null, clock.instant());
    }
}
