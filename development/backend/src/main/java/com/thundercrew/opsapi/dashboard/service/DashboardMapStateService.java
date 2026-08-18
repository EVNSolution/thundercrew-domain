package com.thundercrew.opsapi.dashboard.service;

import com.thundercrew.opsapi.dashboard.dto.DashboardMapStateResponse;
import com.thundercrew.opsapi.dashboard.dto.DashboardMapStateResponse.BikePin;
import com.thundercrew.opsapi.dashboard.dto.DashboardMapStateResponse.DashboardSummary;
import com.thundercrew.opsapi.dashboard.repository.DashboardMapQueryRepository;
import com.thundercrew.opsapi.dashboard.repository.DashboardMapQueryRepository.BikePinRow;
import com.thundercrew.opsapi.dispatch.domain.DispatchOrder;
import com.thundercrew.opsapi.dispatch.domain.DispatchOrderStatus;
import com.thundercrew.opsapi.dispatch.repository.DispatchOrderRepository;
import com.thundercrew.opsapi.telemetry.domain.TelemetryConnection;
import com.thundercrew.opsapi.telemetry.domain.TelemetryIgnitionStatus;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class DashboardMapStateService {

    private static final long TRACK_WINDOW_SECONDS = 120;
    private static final int MAX_TRACK_POINTS = 20;

    private final DashboardMapQueryRepository dashboardMapQueryRepository;
    private final DispatchOrderRepository dispatchOrderRepository;
    private final Clock clock;

    public DashboardMapStateService(
            DashboardMapQueryRepository dashboardMapQueryRepository,
            DispatchOrderRepository dispatchOrderRepository,
            Clock clock) {
        this.dashboardMapQueryRepository = dashboardMapQueryRepository;
        this.dispatchOrderRepository = dispatchOrderRepository;
        this.clock = clock;
    }

    public DashboardMapStateResponse getMapState() {
        Instant generatedAt = Instant.now(clock);
        long totalBikes = dashboardMapQueryRepository.countActiveBikes();
        List<BikePinRow> currentBikeStates = dashboardMapQueryRepository.findCurrentBikeStates(generatedAt);
        Instant trackSince = generatedAt.minusSeconds(TRACK_WINDOW_SECONDS);
        Map<UUID, List<BikePin.TrackPoint>> tracksByBike =
                dashboardMapQueryRepository.findRecentTracks(trackSince, MAX_TRACK_POINTS);
        Map<UUID, List<DispatchOrder>> assignedOrdersByBike = dispatchOrderRepository
                .findByStatusAndDeletedAtIsNull(DispatchOrderStatus.ASSIGNED).stream()
                .filter(order -> order.getBikeId() != null)
                .collect(Collectors.groupingBy(DispatchOrder::getBikeId));
        List<BikePin> bikePins = currentBikeStates.stream()
                .filter(DashboardMapStateService::hasCoordinates)
                .map(row -> toBikePin(row, generatedAt, assignedOrdersByBike.get(row.bikeId()),
                        tracksByBike.getOrDefault(row.bikeId(), List.of())))
                .toList();
        DashboardSummary summary = new DashboardSummary(
                totalBikes,
                bikePins.size(),
                currentBikeStates.stream().filter(row -> connectionStatus(row, generatedAt).equals("ONLINE")).count(),
                0L,
                currentBikeStates.stream().filter(row -> connectionStatus(row, generatedAt).equals("OFFLINE")).count(),
                currentBikeStates.stream().filter(row -> batteryStatus(row).equals("LOW") || batteryStatus(row).equals("CRITICAL")).count()
        );


        return new DashboardMapStateResponse(generatedAt, summary, bikePins);
    }

    private BikePin toBikePin(BikePinRow row, Instant generatedAt, List<DispatchOrder> assignedOrders,
            List<BikePin.TrackPoint> recentTrack) {
        String drivingStatus = drivingStatus(row);
        String connectionStatus = connectionStatus(row, generatedAt);
        String batteryStatus = batteryStatus(row);
        int dispatchQueueCount = assignedOrders == null ? 0 : assignedOrders.size();
        DispatchOrder currentDispatch = assignedOrders == null ? null
                : assignedOrders.stream()
                        .min(Comparator.comparingLong(DispatchOrder::getSequence))
                        .orElse(null);
        return new BikePin(
                row.bikeId(),
                row.bikeIdx(),
                row.plateNumber(),
                row.modelName(),
                row.operationStatus(),
                activeRiderLabel(row),
                row.deviceId(),
                row.lastReceivedAt(),
                row.latitude(),
                row.longitude(),
                row.speedKph(),
                row.batteryPercent(),
                row.ignitionStatus(),
                row.telemetrySource(),
                drivingStatus,
                connectionStatus,
                batteryStatus,
                bikePinLabel(row),
                row.purpose(),
                row.wheelType(),
                row.nextCustomerName(),
                row.nextCustomerPhone(),
                row.nextCustomerLat(),
                row.nextCustomerLng(),
                row.currentCustomerName(),
                row.currentCustomerPhone(),
                currentDispatch == null ? null : currentDispatch.getCustomerName(),
                currentDispatch == null ? null : currentDispatch.getAddress(),
                currentDispatch == null ? null : BigDecimal.valueOf(currentDispatch.getLatitude()),
                currentDispatch == null ? null : BigDecimal.valueOf(currentDispatch.getLongitude()),
                dispatchQueueCount,
                recentTrack
        );
    }

    private static boolean hasCoordinates(BikePinRow row) {
        return row.latitude() != null && row.longitude() != null;
    }

    private String bikePinLabel(BikePinRow row) {
        String activeRiderLabel = activeRiderLabel(row);
        if (activeRiderLabel == null) {
            return row.plateNumber();
        }
        return row.plateNumber() + " · " + activeRiderLabel;
    }

    private String activeRiderLabel(BikePinRow row) {
        if (row.activeRiderName() == null || row.activeRiderName().isBlank()) {
            return null;
        }
        return row.activeRiderName();
    }

    private String drivingStatus(BikePinRow row) {
        if (row.ignitionStatus() == TelemetryIgnitionStatus.UNKNOWN) {
            return "UNKNOWN";
        }
        if (row.ignitionStatus() == TelemetryIgnitionStatus.OFF) {
            return "PARKED";
        }
        BigDecimal speedKph = row.speedKph() == null ? BigDecimal.ZERO : row.speedKph();
        return speedKph.compareTo(BigDecimal.valueOf(3)) >= 0 ? "DRIVING" : "STOPPED";
    }

    private String connectionStatus(BikePinRow row, Instant generatedAt) {
        return TelemetryConnection.status(row.lastReceivedAt(), generatedAt, row.ignitionStatus());
    }

    private String batteryStatus(BikePinRow row) {
        if (row.batteryPercent() == null) {
            return "UNKNOWN";
        }
        if (row.batteryPercent().compareTo(BigDecimal.valueOf(20)) < 0) {
            return "CRITICAL";
        }
        if (row.batteryPercent().compareTo(BigDecimal.valueOf(50)) < 0) {
            return "LOW";
        }
        return "NORMAL";
    }
}
