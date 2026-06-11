package com.thundercrew.opsapi.dashboard.dto;

import com.thundercrew.opsapi.bike.domain.BikeOperationStatus;
import com.thundercrew.opsapi.bike.domain.BikeServiceType;
import com.thundercrew.opsapi.dispatch.domain.DispatchOrderKind;
import com.thundercrew.opsapi.station.domain.BatteryStationStatus;
import com.thundercrew.opsapi.telemetry.domain.TelemetryIgnitionStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record DashboardMapStateResponse(
        Instant generatedAt,
        DashboardSummary summary,
        List<BikePin> bikePins,
        List<StationPin> stationPins,
        List<TipPin> tipPins
) {
    public record DashboardSummary(
            long totalBikes,
            int bikePinCount,
            long onlineBikeCount,
            long signalLostBikeCount,
            long parkedOfflineBikeCount,
            long lowBatteryBikeCount,
            long activeStationCount,
            int stationPinCount,
            long availableBatteryCount
    ) {
    }

    public record BikePin(
            UUID bikeId,
            Long bikeIdx,
            String plateNumber,
            String modelName,
            BikeOperationStatus operationStatus,
            String activeRiderLabel,
            UUID deviceId,
            Instant lastReceivedAt,
            BigDecimal latitude,
            BigDecimal longitude,
            BigDecimal speedKph,
            BigDecimal batteryPercent,
            TelemetryIgnitionStatus ignitionStatus,
            String telemetrySource,
            String drivingStatus,
            String connectionStatus,
            String batteryStatus,
            String pinLabel,
            BikeServiceType serviceType,
            String nextCustomerName,
            String nextCustomerPhone,
            BigDecimal nextCustomerLat,
            BigDecimal nextCustomerLng,
            String currentCustomerName,
            String currentCustomerPhone,
            String currentDispatchCustomerName,
            String currentDispatchAddress,
            BigDecimal currentDispatchLatitude,
            BigDecimal currentDispatchLongitude,
            DispatchOrderKind currentDispatchKind,
            int dispatchQueueCount
    ) {
    }

    public record StationPin(
            UUID stationId,
            Long stationIdx,
            String name,
            String address,
            BigDecimal latitude,
            BigDecimal longitude,
            BatteryStationStatus status,
            int maxBatteryCapacity,
            int currentBatteryCount,
            int availableBatteryCount,
            String availableBatteryLabel,
            int availableBatteryPercentage,
            String pinLabel
    ) {
    }

    public record TipPin(
            UUID id,
            String address,
            String content,
            double latitude,
            double longitude
    ) {
    }
}
