package com.thundercrew.opsapi.dashboard.dto;

import com.thundercrew.opsapi.bike.domain.BikeOperationStatus;
import com.thundercrew.opsapi.contract.domain.ContractCategory;
import com.thundercrew.opsapi.contract.domain.ContractDurationUnit;
import com.thundercrew.opsapi.contract.domain.ContractReturnType;
import com.thundercrew.opsapi.insurance.domain.InsuranceCategory;
import com.thundercrew.opsapi.insurance.domain.InsuranceCoverageType;
import com.thundercrew.opsapi.rider.domain.RiderEducationType;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Aggregate snapshot returned by {@code GET /api/v1/dashboard/bikes/{bikeId}/snapshot}.
 *
 * <p>Joins the bike with its current active rider-bike contract, the rider on that
 * contract (plus the rider's latest education record summary), the rider's active
 * insurance links, and the bike's currently installed equipment. Telemetry
 * {@code current state} is intentionally <em>not</em> bundled here — the dashboard
 * detail panel keeps fetching that from the existing
 * {@code GET /api/v1/telemetry/bikes/{id}/current-state} endpoint so polling and
 * the snapshot stay independently cacheable.</p>
 */
public record DashboardBikeSnapshotResponse(
        UUID bikeId,
        Instant generatedAt,
        BikeSummary bike,
        ActiveContractSummary activeContract,
        RiderSummary rider,
        List<RiderInsuranceSummary> insurances,
        List<BikeEquipmentSummary> equipments
) {
    public record BikeSummary(
            UUID id,
            Long idx,
            String plateNumber,
            String vin,
            String modelName,
            BikeOperationStatus operationStatus,
            String memo,
            Instant createdAt,
            Instant updatedAt
    ) {
    }

    public record ActiveContractSummary(
            UUID id,
            Long idx,
            UUID contractTemplateId,
            String templateName,
            ContractCategory templateCategory,
            ContractReturnType templateReturnType,
            ContractDurationUnit templateDurationUnit,
            Integer templateDurationValue,
            boolean templateIncludesInsurance,
            Instant startAt,
            Instant endAt,
            Instant terminatedAt,
            String terminatedReason,
            String memo
    ) {
    }

    public record RiderSummary(
            UUID id,
            Long idx,
            String name,
            String phoneNumber,
            String teamName,
            String areaName,
            String appLinkStatus,
            String memo,
            boolean educationCompleted,
            RiderEducationType latestEducationType,
            Instant latestEducationCompletedAt,
            Instant latestEducationExpiresAt,
            boolean educationExpired
    ) {
    }

    public record RiderInsuranceSummary(
            UUID id,
            UUID insuranceItemId,
            String itemName,
            InsuranceCategory category,
            InsuranceCoverageType coverageType,
            Instant startsAt,
            Instant endsAt,
            UUID riderBikeContractId,
            String memo
    ) {
    }

    public record BikeEquipmentSummary(
            UUID id,
            UUID equipmentTypeId,
            String typeName,
            String equipmentLabel,
            String modelName,
            String serialNumber,
            Instant installedAt,
            Instant removedAt,
            String managementDueDate,
            String memo
    ) {
    }
}
