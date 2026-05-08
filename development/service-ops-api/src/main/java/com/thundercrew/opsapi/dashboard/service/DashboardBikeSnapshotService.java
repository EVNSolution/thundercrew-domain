package com.thundercrew.opsapi.dashboard.service;

import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import com.thundercrew.opsapi.dashboard.dto.DashboardBikeSnapshotResponse;
import com.thundercrew.opsapi.dashboard.dto.DashboardBikeSnapshotResponse.ActiveContractSummary;
import com.thundercrew.opsapi.dashboard.dto.DashboardBikeSnapshotResponse.BikeEquipmentSummary;
import com.thundercrew.opsapi.dashboard.dto.DashboardBikeSnapshotResponse.BikeSummary;
import com.thundercrew.opsapi.dashboard.dto.DashboardBikeSnapshotResponse.RiderInsuranceSummary;
import com.thundercrew.opsapi.dashboard.dto.DashboardBikeSnapshotResponse.RiderSummary;
import com.thundercrew.opsapi.dashboard.repository.DashboardBikeSnapshotQueryRepository;
import com.thundercrew.opsapi.dashboard.repository.DashboardBikeSnapshotQueryRepository.ActiveContractRow;
import com.thundercrew.opsapi.dashboard.repository.DashboardBikeSnapshotQueryRepository.BikeEquipmentRow;
import com.thundercrew.opsapi.dashboard.repository.DashboardBikeSnapshotQueryRepository.BikeRow;
import com.thundercrew.opsapi.dashboard.repository.DashboardBikeSnapshotQueryRepository.RiderInsuranceRow;
import com.thundercrew.opsapi.dashboard.repository.DashboardBikeSnapshotQueryRepository.RiderRow;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class DashboardBikeSnapshotService {

    private final DashboardBikeSnapshotQueryRepository queryRepository;
    private final Clock clock;

    public DashboardBikeSnapshotService(DashboardBikeSnapshotQueryRepository queryRepository, Clock clock) {
        this.queryRepository = queryRepository;
        this.clock = clock;
    }

    public DashboardBikeSnapshotResponse getSnapshot(UUID bikeId) {
        Instant now = Instant.now(clock);

        BikeRow bikeRow = queryRepository.findActiveBike(bikeId)
                .orElseThrow(() -> new ResourceNotFoundException("Bike", bikeId));

        ActiveContractRow contractRow = queryRepository.findActiveContractForBike(bikeId, now).orElse(null);
        RiderRow riderRow = contractRow == null
                ? null
                : queryRepository.findRider(contractRow.riderId(), now).orElse(null);
        List<RiderInsuranceRow> insuranceRows = riderRow == null
                ? List.of()
                : queryRepository.findActiveRiderInsurances(riderRow.id());
        List<BikeEquipmentRow> equipmentRows = queryRepository.findActiveBikeEquipments(bikeId);

        return new DashboardBikeSnapshotResponse(
                bikeId,
                now,
                toBikeSummary(bikeRow),
                contractRow == null ? null : toActiveContractSummary(contractRow),
                riderRow == null ? null : toRiderSummary(riderRow),
                insuranceRows.stream().map(DashboardBikeSnapshotService::toRiderInsuranceSummary).toList(),
                equipmentRows.stream().map(DashboardBikeSnapshotService::toBikeEquipmentSummary).toList()
        );
    }

    private static BikeSummary toBikeSummary(BikeRow row) {
        return new BikeSummary(
                row.id(),
                row.idx(),
                row.plateNumber(),
                row.vin(),
                row.modelName(),
                row.operationStatus(),
                row.memo(),
                row.createdAt(),
                row.updatedAt()
        );
    }

    private static ActiveContractSummary toActiveContractSummary(ActiveContractRow row) {
        return new ActiveContractSummary(
                row.id(),
                row.idx(),
                row.contractTemplateId(),
                row.templateName(),
                row.templateCategory(),
                row.templateReturnType(),
                row.templateDurationUnit(),
                row.templateDurationValue(),
                row.templateIncludesInsurance(),
                row.startAt(),
                row.endAt(),
                row.terminatedAt(),
                row.terminatedReason(),
                row.memo()
        );
    }

    private static RiderSummary toRiderSummary(RiderRow row) {
        return new RiderSummary(
                row.id(),
                row.idx(),
                row.name(),
                row.phoneNumber(),
                row.teamName(),
                row.areaName(),
                row.appLinkStatus(),
                row.memo(),
                row.educationCompleted(),
                row.latestEducationType(),
                row.latestEducationCompletedAt(),
                row.latestEducationExpiresAt(),
                row.educationExpired()
        );
    }

    private static RiderInsuranceSummary toRiderInsuranceSummary(RiderInsuranceRow row) {
        return new RiderInsuranceSummary(
                row.id(),
                row.insuranceItemId(),
                row.itemName(),
                row.category(),
                row.coverageType(),
                row.startsAt(),
                row.endsAt(),
                row.riderBikeContractId(),
                row.memo()
        );
    }

    private static BikeEquipmentSummary toBikeEquipmentSummary(BikeEquipmentRow row) {
        return new BikeEquipmentSummary(
                row.id(),
                row.equipmentTypeId(),
                row.typeName(),
                row.equipmentLabel(),
                row.modelName(),
                row.serialNumber(),
                row.installedAt(),
                row.removedAt(),
                row.managementDueDate(),
                row.memo()
        );
    }
}
