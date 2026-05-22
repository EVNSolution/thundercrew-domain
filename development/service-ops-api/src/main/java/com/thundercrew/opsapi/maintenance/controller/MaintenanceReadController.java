package com.thundercrew.opsapi.maintenance.controller;

import com.thundercrew.opsapi.common.api.PageResponse;
import com.thundercrew.opsapi.maintenance.dto.MaintenanceItemReadResponse;
import com.thundercrew.opsapi.maintenance.dto.VehicleMaintenanceRecordReadResponse;
import com.thundercrew.opsapi.maintenance.service.MaintenanceReadService;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class MaintenanceReadController {

    private final MaintenanceReadService maintenanceReadService;

    public MaintenanceReadController(MaintenanceReadService maintenanceReadService) {
        this.maintenanceReadService = maintenanceReadService;
    }

    /** 전체 카탈로그 — 카탈로그 편집 화면이 두 표(전기/내연)를 모두 받아 그룹핑. */
    @GetMapping("/api/v1/maintenance-items")
    PageResponse<MaintenanceItemReadResponse> listItems(
            @PageableDefault(size = 100, sort = "idx", direction = Sort.Direction.ASC) Pageable pageable
    ) {
        return maintenanceReadService.listItems(pageable);
    }

    @GetMapping("/api/v1/maintenance-items/{id}")
    MaintenanceItemReadResponse getItem(@PathVariable UUID id) {
        return maintenanceReadService.getItem(id);
    }

    /** 특정 차량에 적용 가능한 카탈로그 — engineType 필터링이 서비스 측에 위치. */
    @GetMapping("/api/v1/bikes/{bikeId}/maintenance-items")
    List<MaintenanceItemReadResponse> listItemsForBike(@PathVariable UUID bikeId) {
        return maintenanceReadService.listItemsForBike(bikeId);
    }

    /** 차량 정비 이력 (최신순). 차량 상세 다이얼로그가 품목별 마지막 교환을 derive. */
    @GetMapping("/api/v1/bikes/{bikeId}/maintenance-records")
    List<VehicleMaintenanceRecordReadResponse> listRecordsForBike(@PathVariable UUID bikeId) {
        return maintenanceReadService.listRecordsForBike(bikeId);
    }

    /** 전체 차량의 정비 이력 — 차량 탭 정비 상태 필터 용 (대량 페이지). */
    @GetMapping("/api/v1/maintenance-records")
    PageResponse<VehicleMaintenanceRecordReadResponse> listRecords(
            @PageableDefault(size = 500, sort = "idx", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        return maintenanceReadService.listRecords(pageable);
    }
}
