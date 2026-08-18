package com.thundercrew.opsapi.dashboard.dto;

import com.thundercrew.opsapi.bike.domain.BikeOperationStatus;
import com.thundercrew.opsapi.bike.domain.BikePurpose;
import com.thundercrew.opsapi.bike.domain.BikeWheelType;
import com.thundercrew.opsapi.telemetry.domain.TelemetryIgnitionStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record DashboardMapStateResponse(
        Instant generatedAt,
        DashboardSummary summary,
        List<BikePin> bikePins
) {
    public record DashboardSummary(
            long totalBikes,
            int bikePinCount,
            long onlineBikeCount,
            long signalLostBikeCount,
            long parkedOfflineBikeCount,
            long lowBatteryBikeCount
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
            BikePurpose purpose,
            BikeWheelType wheelType,
            String nextCustomerName,
            String nextCustomerPhone,
            BigDecimal nextCustomerLat,
            BigDecimal nextCustomerLng,
            String currentCustomerName,
            String currentCustomerPhone,
            String currentDispatchCustomerName,
            String currentDispatchCustomerPhone,
            String currentDispatchAddress,
            BigDecimal currentDispatchLatitude,
            BigDecimal currentDispatchLongitude,
            int dispatchQueueCount,
            List<TrackPoint> recentTrack
    ) {
        public record TrackPoint(
                BigDecimal latitude,
                BigDecimal longitude,
                long t
        ) {
        }
    }

}
