package com.thundercrew.opsapi.maintenance.service;

import com.thundercrew.opsapi.bike.domain.Bike;
import com.thundercrew.opsapi.bike.domain.BikeOperationStatus;
import com.thundercrew.opsapi.bike.repository.BikeRepository;
import com.thundercrew.opsapi.contract.repository.RiderBikeContractRepository;
import com.thundercrew.opsapi.maintenance.domain.MaintenanceCategory;
import com.thundercrew.opsapi.maintenance.dto.MaintenanceItemReadResponse;
import com.thundercrew.opsapi.maintenance.dto.VehicleMaintenanceRecordReadResponse;
import com.thundercrew.opsapi.maintenance.repository.MaintenanceItemRepository;
import com.thundercrew.opsapi.maintenance.repository.VehicleMaintenanceRecordRepository;
import com.thundercrew.opsapi.notification.repository.NotificationRepository;
import com.thundercrew.opsapi.notification.service.NotificationCommandService;
import com.thundercrew.opsapi.telemetry.repository.BikeCurrentStateRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class MaintenanceAlarmEvaluator {

    private static final Logger log = LoggerFactory.getLogger(MaintenanceAlarmEvaluator.class);
    private static final String TYPE_MAINTENANCE_ALARM = "MAINTENANCE_ALARM";
    private static final double DAYS_PER_MONTH = 30.4;

    private final BikeRepository bikeRepository;
    private final MaintenanceItemRepository maintenanceItemRepository;
    private final VehicleMaintenanceRecordRepository vehicleMaintenanceRecordRepository;
    private final BikeCurrentStateRepository bikeCurrentStateRepository;
    private final RiderBikeContractRepository riderBikeContractRepository;
    private final NotificationRepository notificationRepository;
    private final NotificationCommandService notificationCommandService;
    private final Clock clock;

    public MaintenanceAlarmEvaluator(
            BikeRepository bikeRepository,
            MaintenanceItemRepository maintenanceItemRepository,
            VehicleMaintenanceRecordRepository vehicleMaintenanceRecordRepository,
            BikeCurrentStateRepository bikeCurrentStateRepository,
            RiderBikeContractRepository riderBikeContractRepository,
            NotificationRepository notificationRepository,
            NotificationCommandService notificationCommandService,
            Clock clock
    ) {
        this.bikeRepository = bikeRepository;
        this.maintenanceItemRepository = maintenanceItemRepository;
        this.vehicleMaintenanceRecordRepository = vehicleMaintenanceRecordRepository;
        this.bikeCurrentStateRepository = bikeCurrentStateRepository;
        this.riderBikeContractRepository = riderBikeContractRepository;
        this.notificationRepository = notificationRepository;
        this.notificationCommandService = notificationCommandService;
        this.clock = clock;
    }

    @Scheduled(fixedDelayString = "${thundercrew.maintenance.alarm-interval-ms:600000}")
    public void evaluate() {
        Instant now = Instant.now(clock);
        List<Bike> activeBikes = bikeRepository.findAllByDeletedAtIsNull().stream()
                .filter(b -> b.getOperationStatus() == BikeOperationStatus.IN_SERVICE)
                .toList();

        for (Bike bike : activeBikes) {
            try {
                evaluateBike(bike, now);
            } catch (Exception ex) {
                log.error("MaintenanceAlarmEvaluator: failed for bike {} — skipping", bike.getId(), ex);
            }
        }
    }

    private void evaluateBike(Bike bike, Instant now) {
        UUID bikeId = bike.getId();

        // Resolve category for this bike
        MaintenanceCategory category = toCategory(bike);

        // Applicable items (with alertThresholdPercent set)
        List<MaintenanceItemReadResponse> applicableItems = maintenanceItemRepository
                .findByCategory(category)
                .stream()
                .map(MaintenanceItemReadResponse::from)
                .filter(item -> item.alertThresholdPercent() != null)
                .toList();

        if (applicableItems.isEmpty()) {
            return;
        }

        // Latest record per item (records already servicedAt DESC)
        List<VehicleMaintenanceRecordReadResponse> records =
                vehicleMaintenanceRecordRepository
                        .findByBikeIdAndDeletedAtIsNullOrderByServicedAtDesc(bikeId)
                        .stream()
                        .map(VehicleMaintenanceRecordReadResponse::from)
                        .toList();

        Map<UUID, VehicleMaintenanceRecordReadResponse> latestByItemId = records.stream()
                .collect(Collectors.toMap(
                        VehicleMaintenanceRecordReadResponse::itemId,
                        r -> r,
                        (existing, replacement) -> existing  // keep first (most recent)
                ));

        // Current odometer (may be null)
        Integer currentOdometer = bikeCurrentStateRepository.findByBikeId(bikeId)
                .map(state -> state.getOdometerKm())
                .orElse(null);

        for (MaintenanceItemReadResponse item : applicableItems) {
            VehicleMaintenanceRecordReadResponse latestRecord = latestByItemId.get(item.id());
            if (latestRecord == null) {
                continue;
            }

            Double consumed = computeConsumedRatio(item, latestRecord, currentOdometer, now);
            if (consumed == null) {
                continue;
            }

            if (consumed * 100 >= item.alertThresholdPercent()) {
                // Dedup: skip if alarm already raised this cycle (occurredAt after servicedAt of latest record)
                boolean alreadyRaised = notificationRepository
                        .existsByRefBikeIdAndRefEntityIdAndTypeAndOccurredAtAfterAndDeletedAtIsNull(
                                bikeId,
                                item.id(),
                                TYPE_MAINTENANCE_ALARM,
                                latestRecord.servicedAt()
                        );

                if (alreadyRaised) {
                    continue;
                }

                UUID riderId = riderBikeContractRepository.findActiveByBikeId(bikeId)
                        .map(contract -> contract.getRiderId())
                        .orElse(null);

                long roundedPercent = Math.round(consumed * 100);
                String title = String.format("정비 임박: %s %s", bike.getPlateNumber(), item.name());
                String body = String.format("%s %d%% 소진 (임계 %d%%)",
                        item.name(), roundedPercent, item.alertThresholdPercent());

                notificationCommandService.record(
                        TYPE_MAINTENANCE_ALARM,
                        title,
                        body,
                        bikeId,
                        item.id(),
                        riderId,
                        now
                );

                log.info("MaintenanceAlarmEvaluator: raised alarm for bike={} item={} consumed={}%",
                        bikeId, item.id(), roundedPercent);
            }
        }
    }

    /**
     * Computes the consumed ratio (0.0 = new, 1.0 = fully consumed, >1.0 = overdue).
     * Returns null if neither months nor km ratio can be computed.
     */
    private Double computeConsumedRatio(
            MaintenanceItemReadResponse item,
            VehicleMaintenanceRecordReadResponse latestRecord,
            Integer currentOdometer,
            Instant now
    ) {
        Double monthsRatio = null;
        if (item.cycleMonths() != null) {
            long daysBetween = ChronoUnit.DAYS.between(latestRecord.servicedAt(), now);
            double fractionalMonths = daysBetween / DAYS_PER_MONTH;
            monthsRatio = fractionalMonths / item.cycleMonths();
        }

        Double kmRatio = null;
        if (item.cycleKm() != null
                && currentOdometer != null
                && latestRecord.servicedAtOdometerKm() != null) {
            double kmDelta = currentOdometer - latestRecord.servicedAtOdometerKm();
            kmRatio = kmDelta / item.cycleKm();
        }

        if (monthsRatio == null && kmRatio == null) {
            return null;
        }
        if (monthsRatio == null) {
            return kmRatio;
        }
        if (kmRatio == null) {
            return monthsRatio;
        }
        return Math.max(monthsRatio, kmRatio);
    }

    private MaintenanceCategory toCategory(Bike bike) {
        boolean four = bike.getWheelType() == com.thundercrew.opsapi.bike.domain.BikeWheelType.FOUR_WHEEL;
        boolean ice = bike.getEngineType() == com.thundercrew.opsapi.bike.domain.BikeEngineType.ICE;
        if (four) {
            return ice ? MaintenanceCategory.FOUR_WHEEL_ICE : MaintenanceCategory.FOUR_WHEEL_ELECTRIC;
        }
        return ice ? MaintenanceCategory.TWO_WHEEL_ICE : MaintenanceCategory.TWO_WHEEL_ELECTRIC;
    }
}
