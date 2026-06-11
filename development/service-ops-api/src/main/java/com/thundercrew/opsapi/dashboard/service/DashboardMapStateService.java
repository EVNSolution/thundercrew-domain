package com.thundercrew.opsapi.dashboard.service;

import com.thundercrew.opsapi.dashboard.dto.DashboardMapStateResponse;
import com.thundercrew.opsapi.dashboard.dto.DashboardMapStateResponse.BikePin;
import com.thundercrew.opsapi.dashboard.dto.DashboardMapStateResponse.DashboardSummary;
import com.thundercrew.opsapi.dashboard.dto.DashboardMapStateResponse.StationPin;
import com.thundercrew.opsapi.dashboard.dto.DashboardMapStateResponse.TipPin;
import com.thundercrew.opsapi.dashboard.repository.DashboardMapQueryRepository;
import com.thundercrew.opsapi.dashboard.repository.DashboardMapQueryRepository.BikePinRow;
import com.thundercrew.opsapi.dashboard.repository.DashboardMapQueryRepository.StationPinRow;
import com.thundercrew.opsapi.dispatch.domain.DispatchOrder;
import com.thundercrew.opsapi.dispatch.domain.DispatchOrderKind;
import com.thundercrew.opsapi.dispatch.domain.DispatchOrderStatus;
import com.thundercrew.opsapi.dispatch.repository.DispatchOrderRepository;
import com.thundercrew.opsapi.station.domain.BatteryStationStatus;
import com.thundercrew.opsapi.tip.repository.TipRepository;
import com.thundercrew.opsapi.telemetry.domain.TelemetryIgnitionStatus;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
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

    private static final Duration SIGNAL_LOST_THRESHOLD = Duration.ofMinutes(10);

    private final DashboardMapQueryRepository dashboardMapQueryRepository;
    private final TipRepository tipRepository;
    private final DispatchOrderRepository dispatchOrderRepository;
    private final Clock clock;

    public DashboardMapStateService(
            DashboardMapQueryRepository dashboardMapQueryRepository,
            TipRepository tipRepository,
            DispatchOrderRepository dispatchOrderRepository,
            Clock clock) {
        this.dashboardMapQueryRepository = dashboardMapQueryRepository;
        this.tipRepository = tipRepository;
        this.dispatchOrderRepository = dispatchOrderRepository;
        this.clock = clock;
    }

    public DashboardMapStateResponse getMapState() {
        Instant generatedAt = Instant.now(clock);
        long totalBikes = dashboardMapQueryRepository.countActiveBikes();
        List<BikePinRow> currentBikeStates = dashboardMapQueryRepository.findCurrentBikeStates(generatedAt);
        Map<UUID, List<DispatchOrder>> assignedOrdersByBike = dispatchOrderRepository
                .findByStatusAndDeletedAtIsNull(DispatchOrderStatus.ASSIGNED).stream()
                .filter(order -> order.getBikeId() != null)
                .collect(Collectors.groupingBy(DispatchOrder::getBikeId));
        List<BikePin> bikePins = currentBikeStates.stream()
                .filter(DashboardMapStateService::hasCoordinates)
                .map(row -> toBikePin(row, generatedAt, assignedOrdersByBike.get(row.bikeId())))
                .toList();
        List<StationPin> stationPins = dashboardMapQueryRepository.findStationPins().stream()
                .map(this::toStationPin)
                .toList();

        DashboardSummary summary = new DashboardSummary(
                totalBikes,
                bikePins.size(),
                currentBikeStates.stream().filter(row -> connectionStatus(row, generatedAt).equals("ONLINE")).count(),
                currentBikeStates.stream().filter(row -> connectionStatus(row, generatedAt).equals("SIGNAL_LOST")).count(),
                currentBikeStates.stream().filter(row -> connectionStatus(row, generatedAt).equals("PARKED_OFFLINE_NORMAL")).count(),
                currentBikeStates.stream().filter(row -> batteryStatus(row).equals("LOW") || batteryStatus(row).equals("CRITICAL")).count(),
                stationPins.stream().filter(pin -> pin.status() == BatteryStationStatus.ACTIVE).count(),
                stationPins.size(),
                stationPins.stream().mapToLong(StationPin::availableBatteryCount).sum()
        );

        List<TipPin> tipPins = tipRepository.findAllByDeletedAtIsNull().stream()
                .map(tip -> new TipPin(
                        tip.getId(),
                        tip.getAddress(),
                        tip.getContent(),
                        tip.getLatitude(),
                        tip.getLongitude()))
                .toList();

        return new DashboardMapStateResponse(generatedAt, summary, bikePins, stationPins, tipPins);
    }

    private BikePin toBikePin(BikePinRow row, Instant generatedAt, List<DispatchOrder> assignedOrders) {
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
                row.serviceType(),
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
                currentDispatch == null ? null : currentDispatch.getKind(),
                dispatchQueueCount
        );
    }

    private StationPin toStationPin(StationPinRow row) {
        String availableBatteryLabel = row.availableBatteryCount() + "/" + row.maxBatteryCapacity();
        return new StationPin(
                row.stationId(),
                row.stationIdx(),
                row.name(),
                row.address(),
                row.latitude(),
                row.longitude(),
                row.status(),
                row.maxBatteryCapacity(),
                row.currentBatteryCount(),
                row.availableBatteryCount(),
                availableBatteryLabel,
                availableBatteryPercentage(row),
                row.name() + " " + availableBatteryLabel
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
        Duration age = Duration.between(row.lastReceivedAt(), generatedAt);
        if (!age.minus(SIGNAL_LOST_THRESHOLD).isPositive()) {
            return "ONLINE";
        }
        if (row.ignitionStatus() == TelemetryIgnitionStatus.ON) {
            return "SIGNAL_LOST";
        }
        if (row.ignitionStatus() == TelemetryIgnitionStatus.OFF) {
            return "PARKED_OFFLINE_NORMAL";
        }
        return "STALE_UNKNOWN";
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

    private int availableBatteryPercentage(StationPinRow row) {
        if (row.maxBatteryCapacity() == 0) {
            return 0;
        }
        return Math.round((row.availableBatteryCount() * 100.0f) / row.maxBatteryCapacity());
    }
}
