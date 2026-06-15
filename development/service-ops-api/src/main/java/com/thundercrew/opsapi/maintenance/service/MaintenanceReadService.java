package com.thundercrew.opsapi.maintenance.service;

import com.thundercrew.opsapi.bike.domain.Bike;
import com.thundercrew.opsapi.bike.domain.BikeEngineType;
import com.thundercrew.opsapi.bike.domain.BikeWheelType;
import com.thundercrew.opsapi.bike.repository.BikeRepository;
import com.thundercrew.opsapi.common.api.PageResponse;
import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import com.thundercrew.opsapi.maintenance.domain.MaintenanceAppliesTo;
import com.thundercrew.opsapi.maintenance.domain.MaintenanceWheelApplies;
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
     * 한 차량의 정비 catalog — 그 차량의 engineType AND wheelType 에 적용 가능한 품목만.
     * 엔진: ELECTRIC→(ELECTRIC+BOTH), ICE→(ICE+BOTH). 휠: FOUR_WHEEL→(FOUR_WHEEL+BOTH),
     * TWO_WHEEL→(TWO_WHEEL+BOTH). 두 축 모두 매치하는 품목만. 정렬은 displayOrder 오름차순.
     */
    public List<MaintenanceItemReadResponse> listItemsForBike(UUID bikeId) {
        Bike bike = bikeRepository.findByIdAndDeletedAtIsNull(bikeId)
                .orElseThrow(() -> new ResourceNotFoundException("Bike", bikeId));
        List<MaintenanceAppliesTo> appliesTo = bike.getEngineType() == BikeEngineType.ELECTRIC
                ? List.of(MaintenanceAppliesTo.ELECTRIC, MaintenanceAppliesTo.BOTH)
                : List.of(MaintenanceAppliesTo.ICE, MaintenanceAppliesTo.BOTH);
        List<MaintenanceWheelApplies> appliesToWheel = bike.getWheelType() == BikeWheelType.FOUR_WHEEL
                ? List.of(MaintenanceWheelApplies.FOUR_WHEEL, MaintenanceWheelApplies.BOTH)
                : List.of(MaintenanceWheelApplies.TWO_WHEEL, MaintenanceWheelApplies.BOTH);
        return itemRepository
                .findByAppliesToInAndAppliesToWheelInAndDeletedAtIsNullOrderByDisplayOrderAsc(appliesTo, appliesToWheel)
                .stream()
                .map(MaintenanceItemReadResponse::from)
                .toList();
    }

    /**
     * 전체 차량의 정비 이력 (페이징). 차량 탭 필터가 차량별 최신 record 를 한 번에
     * 받아 임박/지연 상태를 client-side 에서 derive 할 때 사용.
     */
    public PageResponse<VehicleMaintenanceRecordReadResponse> listRecords(Pageable pageable) {
        return PageResponse.of(
                recordRepository.findByDeletedAtIsNull(pageable).map(VehicleMaintenanceRecordReadResponse::from)
        );
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
