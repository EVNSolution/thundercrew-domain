package com.thundercrew.opsapi.rider.service;

import com.thundercrew.opsapi.bike.domain.Bike;
import com.thundercrew.opsapi.bike.domain.BikeServiceType;
import com.thundercrew.opsapi.bike.repository.BikeRepository;
import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import com.thundercrew.opsapi.contract.domain.RiderBikeContract;
import com.thundercrew.opsapi.contract.repository.RiderBikeContractRepository;
import com.thundercrew.opsapi.rider.dto.RiderVehicleResponse;
import com.thundercrew.opsapi.telemetry.domain.BikeCurrentState;
import com.thundercrew.opsapi.telemetry.domain.TelemetryConnection;
import com.thundercrew.opsapi.telemetry.repository.BikeCurrentStateRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RiderVehicleReadService {

    private final RiderBikeContractRepository contractRepository;
    private final BikeRepository bikeRepository;
    private final BikeCurrentStateRepository currentStateRepository;
    private final Clock clock;

    public RiderVehicleReadService(
            RiderBikeContractRepository contractRepository,
            BikeRepository bikeRepository,
            BikeCurrentStateRepository currentStateRepository,
            Clock clock
    ) {
        this.contractRepository = contractRepository;
        this.bikeRepository = bikeRepository;
        this.currentStateRepository = currentStateRepository;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public RiderVehicleResponse getMyVehicle(UUID riderId) {
        RiderBikeContract contract = contractRepository.findActiveByRiderId(riderId)
                .orElseThrow(() -> new ResourceNotFoundException("RiderVehicle", riderId));
        UUID bikeId = contract.getBikeId();
        Bike bike = bikeRepository.findByIdAndDeletedAtIsNull(bikeId)
                .orElseThrow(() -> new ResourceNotFoundException("Bike", bikeId));

        BikeCurrentState state = currentStateRepository.findByBikeId(bikeId).orElse(null);
        Double lat = null, lng = null;
        Integer odo = null;
        String connection = null;
        Instant lastReceivedAt = null;
        if (state != null) {
            lat = state.getLatitude() == null ? null : state.getLatitude().doubleValue();
            lng = state.getLongitude() == null ? null : state.getLongitude().doubleValue();
            odo = state.getOdometerKm();
            lastReceivedAt = state.getLastReceivedAt();
            connection = TelemetryConnection.status(state.getLastReceivedAt(), Instant.now(clock), state.getIgnitionStatus());
        }
        return new RiderVehicleResponse(
                bike.getId(), bike.getPlateNumber(), bike.getImei(), contract.getServiceType(),
                lat, lng, odo, connection, lastReceivedAt);
    }

    @Transactional(readOnly = true)
    public UUID activeBikeIdOrNull(UUID riderId) {
        return contractRepository.findActiveByRiderId(riderId).map(c -> c.getBikeId()).orElse(null);
    }

    @Transactional(readOnly = true)
    public boolean isCallBike(UUID bikeId) {
        return contractRepository.findActiveByBikeId(bikeId)
                .map(c -> c.getServiceType() == BikeServiceType.CALL)
                .orElse(false);
    }
}
