package com.thundercrew.opsapi.maintenance.service;

import com.thundercrew.opsapi.bike.domain.Bike;
import com.thundercrew.opsapi.bike.domain.BikeEngineType;
import com.thundercrew.opsapi.bike.domain.BikeWheelType;
import com.thundercrew.opsapi.bike.repository.BikeRepository;
import com.thundercrew.opsapi.common.api.PageResponse;
import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import com.thundercrew.opsapi.maintenance.domain.MaintenanceCategory;
import com.thundercrew.opsapi.maintenance.dto.MaintenanceItemReadResponse;
import com.thundercrew.opsapi.maintenance.dto.VehicleMaintenanceRecordReadResponse;
import com.thundercrew.opsapi.maintenance.repository.MaintenanceItemRepository;
import com.thundercrew.opsapi.maintenance.repository.VehicleMaintenanceRecordRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class MaintenanceReadService {

    private final MaintenanceItemRepository itemRepository;
    private final VehicleMaintenanceRecordRepository recordRepository;
    private final BikeRepository bikeRepository;

    public MaintenanceReadService(
            MaintenanceItemRepository itemRepository,
            VehicleMaintenanceRecordRepository recordRepository,
            BikeRepository bikeRepository
    ) {
        this.itemRepository = itemRepository;
        this.recordRepository = recordRepository;
        this.bikeRepository = bikeRepository;
    }

    /**
     * 전체 카탈로그(페이지). 카탈로그 편집 화면이 전체 품목을 한 번에
     * 노출하기 위해 호출. 이름 오름차순.
     */
    public PageResponse<MaintenanceItemReadResponse> listItems(Pageable pageable) {
        return PageResponse.of(
                itemRepository.findByDeletedAtIsNull(pageable).map(MaintenanceItemReadResponse::from)
        );
    }

    public MaintenanceItemReadResponse getItem(UUID id) {
        return itemRepository.findByIdAndDeletedAtIsNull(id)
                .map(MaintenanceItemReadResponse::from)
                .orElseThrow(() -> new ResourceNotFoundException("MaintenanceItem", id));
    }

    /**
     * 한 차량의 정비 catalog — 그 차량의 단일 카테고리(wheelType × engineType)에
     * 속하는 품목만. 이름 오름차순.
     */
    public List<MaintenanceItemReadResponse> listItemsForBike(UUID bikeId) {
        Bike bike = bikeRepository.findByIdAndDeletedAtIsNull(bikeId)
                .orElseThrow(() -> new ResourceNotFoundException("Bike", bikeId));
        MaintenanceCategory category = toCategory(bike.getWheelType(), bike.getEngineType());
        return itemRepository.findByCategory(category).stream()
                .map(MaintenanceItemReadResponse::from)
                .toList();
    }

    /**
     * 전체 차량의 정비 이력 (페이징).
     */
    public PageResponse<VehicleMaintenanceRecordReadResponse> listRecords(Pageable pageable) {
        return PageResponse.of(
                recordRepository.findByDeletedAtIsNull(pageable).map(VehicleMaintenanceRecordReadResponse::from)
        );
    }

    public List<VehicleMaintenanceRecordReadResponse> listRecordsForBike(UUID bikeId) {
        bikeRepository.findByIdAndDeletedAtIsNull(bikeId)
                .orElseThrow(() -> new ResourceNotFoundException("Bike", bikeId));
        return recordRepository
                .findByBikeIdAndDeletedAtIsNullOrderByServicedAtDesc(bikeId)
                .stream()
                .map(VehicleMaintenanceRecordReadResponse::from)
                .toList();
    }

    private static MaintenanceCategory toCategory(BikeWheelType wheel, BikeEngineType engine) {
        boolean four = wheel == BikeWheelType.FOUR_WHEEL;
        boolean ice = engine == BikeEngineType.ICE;
        if (four) return ice ? MaintenanceCategory.FOUR_WHEEL_ICE : MaintenanceCategory.FOUR_WHEEL_ELECTRIC;
        return ice ? MaintenanceCategory.TWO_WHEEL_ICE : MaintenanceCategory.TWO_WHEEL_ELECTRIC;
    }
}
