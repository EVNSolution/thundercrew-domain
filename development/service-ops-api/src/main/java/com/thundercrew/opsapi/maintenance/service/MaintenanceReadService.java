package com.thundercrew.opsapi.maintenance.service;

import com.thundercrew.opsapi.bike.domain.Bike;
import com.thundercrew.opsapi.bike.domain.BikeEngineType;
import com.thundercrew.opsapi.bike.repository.BikeRepository;
import com.thundercrew.opsapi.common.api.PageResponse;
import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import com.thundercrew.opsapi.maintenance.domain.MaintenanceAppliesTo;
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
     * 전체 카탈로그(페이지). 카탈로그 편집 화면이 두 표(전기/내연)를 한 번에
     * 노출하기 위해 호출. UI 가 클라이언트 측에서 appliesTo 별로 그룹핑.
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
     * 한 차량의 정비 catalog — 그 차량의 engineType 에 적용 가능한 품목만.
     * ELECTRIC 차량은 (ELECTRIC + BOTH), ICE 는 (ICE + BOTH). 정렬은
     * displayOrder 오름차순으로 사진 표 순서 유지.
     */
    public List<MaintenanceItemReadResponse> listItemsForBike(UUID bikeId) {
        Bike bike = bikeRepository.findByIdAndDeletedAtIsNull(bikeId)
                .orElseThrow(() -> new ResourceNotFoundException("Bike", bikeId));
        List<MaintenanceAppliesTo> appliesTo = bike.getEngineType() == BikeEngineType.ELECTRIC
                ? List.of(MaintenanceAppliesTo.ELECTRIC, MaintenanceAppliesTo.BOTH)
                : List.of(MaintenanceAppliesTo.ICE, MaintenanceAppliesTo.BOTH);
        return itemRepository
                .findByAppliesToInAndDeletedAtIsNullOrderByDisplayOrderAsc(appliesTo)
                .stream()
                .map(MaintenanceItemReadResponse::from)
                .toList();
    }

    public List<VehicleMaintenanceRecordReadResponse> listRecordsForBike(UUID bikeId) {
        // bike 존재 여부 보장 — 삭제된 차량 ID 로 잘못 조회되면 404.
        bikeRepository.findByIdAndDeletedAtIsNull(bikeId)
                .orElseThrow(() -> new ResourceNotFoundException("Bike", bikeId));
        return recordRepository
                .findByBikeIdAndDeletedAtIsNullOrderByServicedAtDesc(bikeId)
                .stream()
                .map(VehicleMaintenanceRecordReadResponse::from)
                .toList();
    }
}
