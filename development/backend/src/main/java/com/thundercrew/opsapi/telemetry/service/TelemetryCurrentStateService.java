package com.thundercrew.opsapi.telemetry.service;

import com.thundercrew.opsapi.common.api.PageResponse;
import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import com.thundercrew.opsapi.telemetry.dto.BikeCurrentStateReadResponse;
import com.thundercrew.opsapi.telemetry.repository.BikeCurrentStateRepository;
import java.time.Clock;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class TelemetryCurrentStateService {

    private final BikeCurrentStateRepository currentStateRepository;
    private final Clock clock;

    public TelemetryCurrentStateService(BikeCurrentStateRepository currentStateRepository, Clock clock) {
        this.currentStateRepository = currentStateRepository;
        this.clock = clock;
    }

    public PageResponse<BikeCurrentStateReadResponse> listCurrentStates(Pageable pageable) {
        return PageResponse.of(currentStateRepository.findAll(pageable)
                .map(state -> BikeCurrentStateReadResponse.from(state, clock)));
    }

    public BikeCurrentStateReadResponse getCurrentState(UUID bikeId) {
        return currentStateRepository.findByBikeId(bikeId)
                .map(state -> BikeCurrentStateReadResponse.from(state, clock))
                .orElseThrow(() -> new ResourceNotFoundException("BikeCurrentState", bikeId));
    }
}
