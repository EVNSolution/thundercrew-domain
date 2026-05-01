package com.thundercrew.opsapi.station.service;

import com.thundercrew.opsapi.common.api.PageResponse;
import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import com.thundercrew.opsapi.station.dto.BatteryStationReadResponse;
import com.thundercrew.opsapi.station.dto.StationBatteryCountLogReadResponse;
import com.thundercrew.opsapi.station.repository.BatteryStationRepository;
import com.thundercrew.opsapi.station.repository.StationBatteryCountLogRepository;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class StationReadService {

    private final BatteryStationRepository batteryStationRepository;
    private final StationBatteryCountLogRepository countLogRepository;

    public StationReadService(BatteryStationRepository batteryStationRepository, StationBatteryCountLogRepository countLogRepository) {
        this.batteryStationRepository = batteryStationRepository;
        this.countLogRepository = countLogRepository;
    }

    public PageResponse<BatteryStationReadResponse> listStations(Pageable pageable) {
        return PageResponse.of(batteryStationRepository.findByDeletedAtIsNull(pageable).map(BatteryStationReadResponse::from));
    }

    public BatteryStationReadResponse getStation(UUID id) {
        return batteryStationRepository.findByIdAndDeletedAtIsNull(id)
                .map(BatteryStationReadResponse::from)
                .orElseThrow(() -> new ResourceNotFoundException("BatteryStation", id));
    }

    public PageResponse<StationBatteryCountLogReadResponse> listCountLogs(Pageable pageable) {
        return PageResponse.of(countLogRepository.findByDeletedAtIsNull(pageable).map(StationBatteryCountLogReadResponse::from));
    }

    public StationBatteryCountLogReadResponse getCountLog(UUID id) {
        return countLogRepository.findByIdAndDeletedAtIsNull(id)
                .map(StationBatteryCountLogReadResponse::from)
                .orElseThrow(() -> new ResourceNotFoundException("StationBatteryCountLog", id));
    }
}
