package com.thundercrew.opsapi.dashboard.repository;

import com.thundercrew.opsapi.bike.domain.BikeOperationStatus;
import com.thundercrew.opsapi.contract.domain.ContractCategory;
import com.thundercrew.opsapi.contract.domain.ContractDurationUnit;
import com.thundercrew.opsapi.contract.domain.ContractReturnType;
import com.thundercrew.opsapi.insurance.domain.InsuranceCategory;
import com.thundercrew.opsapi.insurance.domain.InsuranceCoverageType;
import com.thundercrew.opsapi.rider.domain.RiderEducationType;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * Read-side queries that back {@code GET /api/v1/dashboard/bikes/{bikeId}/snapshot}.
 * The four queries run inside a single read-only transaction at the service
 * layer so the operator sees a coherent snapshot, even if a rider link is
 * being mutated while the panel opens.
 */
@Repository
public class DashboardBikeSnapshotQueryRepository {

    private final JdbcTemplate jdbcTemplate;

    public DashboardBikeSnapshotQueryRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public Optional<BikeRow> findActiveBike(UUID bikeId) {
        try {
            BikeRow row = jdbcTemplate.queryForObject("""
                    select
                        id, idx, plate_number, vin, model_name, operation_status,
                        memo, created_at, updated_at
                    from bikes
                    where id = ? and deleted_at is null
                    """, this::mapBikeRow, bikeId);
            return Optional.ofNullable(row);
        } catch (EmptyResultDataAccessException exception) {
            return Optional.empty();
        }
    }

    public Optional<ActiveContractRow> findActiveContractForBike(UUID bikeId, Instant now) {
        try {
            ActiveContractRow row = jdbcTemplate.queryForObject("""
                    select
                        c.id, c.idx,
                        c.rider_id, c.contract_template_id,
                        c.start_at, c.end_at, c.terminated_at, c.terminated_reason, c.memo,
                        t.name as template_name,
                        t.category as template_category,
                        t.return_type as template_return_type,
                        t.duration_unit as template_duration_unit,
                        t.duration_value as template_duration_value,
                        t.includes_insurance as template_includes_insurance
                    from rider_bike_contracts c
                    join contract_templates t
                      on t.id = c.contract_template_id
                    where c.bike_id = ?
                      and c.deleted_at is null
                      and c.start_at <= ?::timestamptz
                      and ?::timestamptz < coalesce(c.terminated_at, c.end_at, 'infinity'::timestamptz)
                    order by c.start_at desc, c.idx desc
                    limit 1
                    """, this::mapActiveContractRow, bikeId, now.toString(), now.toString());
            return Optional.ofNullable(row);
        } catch (EmptyResultDataAccessException exception) {
            return Optional.empty();
        }
    }

    public Optional<RiderRow> findRider(UUID riderId, Instant now) {
        try {
            RiderRow row = jdbcTemplate.queryForObject("""
                    select
                        r.id, r.idx, r.name, r.phone_number, r.team_name, r.area_name,
                        r.app_account_linked, r.memo,
                        latest.education_type        as latest_education_type,
                        latest.completed_at          as latest_completed_at,
                        latest.expires_at            as latest_expires_at
                    from riders r
                    left join lateral (
                        select education_type, completed_at, expires_at
                        from rider_education_records
                        where rider_id = r.id
                          and deleted_at is null
                        order by completed_at desc, idx desc
                        limit 1
                    ) latest on true
                    where r.id = ? and r.deleted_at is null
                    """, (rs, rowNum) -> mapRiderRow(rs, now), riderId);
            return Optional.ofNullable(row);
        } catch (EmptyResultDataAccessException exception) {
            return Optional.empty();
        }
    }

    public List<RiderInsuranceRow> findActiveRiderInsurances(UUID riderId) {
        return jdbcTemplate.query("""
                select
                    ri.id, ri.insurance_item_id, ri.starts_at, ri.ends_at,
                    ri.rider_bike_contract_id, ri.memo,
                    item.name           as item_name,
                    item.category       as item_category,
                    item.coverage_type  as item_coverage_type
                from rider_insurances ri
                join insurance_items item
                  on item.id = ri.insurance_item_id
                 and item.deleted_at is null
                where ri.rider_id = ?
                  and ri.deleted_at is null
                  and ri.enabled = true
                order by ri.idx desc
                """, this::mapRiderInsuranceRow, riderId);
    }

    public List<BikeEquipmentRow> findActiveBikeEquipments(UUID bikeId) {
        return jdbcTemplate.query("""
                select
                    eq.id, eq.equipment_type_id, eq.equipment_label, eq.model_name,
                    eq.serial_number, eq.installed_at, eq.removed_at,
                    eq.management_due_date, eq.memo,
                    et.name as type_name
                from bike_equipments eq
                join equipment_types et
                  on et.id = eq.equipment_type_id
                 and et.deleted_at is null
                where eq.bike_id = ?
                  and eq.deleted_at is null
                  and eq.removed_at is null
                order by eq.idx desc
                """, this::mapBikeEquipmentRow, bikeId);
    }

    private BikeRow mapBikeRow(ResultSet rs, int rowNum) throws SQLException {
        return new BikeRow(
                rs.getObject("id", UUID.class),
                rs.getLong("idx"),
                rs.getString("plate_number"),
                rs.getString("vin"),
                rs.getString("model_name"),
                BikeOperationStatus.valueOf(rs.getString("operation_status")),
                rs.getString("memo"),
                rs.getTimestamp("created_at").toInstant(),
                rs.getTimestamp("updated_at").toInstant()
        );
    }

    private ActiveContractRow mapActiveContractRow(ResultSet rs, int rowNum) throws SQLException {
        return new ActiveContractRow(
                rs.getObject("id", UUID.class),
                rs.getLong("idx"),
                rs.getObject("rider_id", UUID.class),
                rs.getObject("contract_template_id", UUID.class),
                rs.getTimestamp("start_at").toInstant(),
                optionalInstant(rs, "end_at"),
                optionalInstant(rs, "terminated_at"),
                rs.getString("terminated_reason"),
                rs.getString("memo"),
                rs.getString("template_name"),
                ContractCategory.valueOf(rs.getString("template_category")),
                optionalEnum(rs.getString("template_return_type"), ContractReturnType.class),
                optionalEnum(rs.getString("template_duration_unit"), ContractDurationUnit.class),
                (Integer) rs.getObject("template_duration_value"),
                rs.getBoolean("template_includes_insurance")
        );
    }

    private RiderRow mapRiderRow(ResultSet rs, Instant now) throws SQLException {
        Instant latestCompletedAt = optionalInstant(rs, "latest_completed_at");
        Instant latestExpiresAt = optionalInstant(rs, "latest_expires_at");
        RiderEducationType latestEducationType = optionalEnum(
                rs.getString("latest_education_type"), RiderEducationType.class);
        boolean educationExpired = latestExpiresAt != null && !now.isBefore(latestExpiresAt);
        return new RiderRow(
                rs.getObject("id", UUID.class),
                rs.getLong("idx"),
                rs.getString("name"),
                rs.getString("phone_number"),
                rs.getString("team_name"),
                rs.getString("area_name"),
                rs.getBoolean("app_account_linked") ? "LINKED" : "NOT_LINKED",
                rs.getString("memo"),
                latestEducationType != null,
                latestEducationType,
                latestCompletedAt,
                latestExpiresAt,
                educationExpired
        );
    }

    private RiderInsuranceRow mapRiderInsuranceRow(ResultSet rs, int rowNum) throws SQLException {
        return new RiderInsuranceRow(
                rs.getObject("id", UUID.class),
                rs.getObject("insurance_item_id", UUID.class),
                rs.getString("item_name"),
                InsuranceCategory.valueOf(rs.getString("item_category")),
                optionalEnum(rs.getString("item_coverage_type"), InsuranceCoverageType.class),
                optionalInstant(rs, "starts_at"),
                optionalInstant(rs, "ends_at"),
                rs.getObject("rider_bike_contract_id", UUID.class),
                rs.getString("memo")
        );
    }

    private BikeEquipmentRow mapBikeEquipmentRow(ResultSet rs, int rowNum) throws SQLException {
        return new BikeEquipmentRow(
                rs.getObject("id", UUID.class),
                rs.getObject("equipment_type_id", UUID.class),
                rs.getString("type_name"),
                rs.getString("equipment_label"),
                rs.getString("model_name"),
                rs.getString("serial_number"),
                rs.getTimestamp("installed_at").toInstant(),
                optionalInstant(rs, "removed_at"),
                rs.getString("management_due_date"),
                rs.getString("memo")
        );
    }

    private static Instant optionalInstant(ResultSet rs, String column) throws SQLException {
        java.sql.Timestamp timestamp = rs.getTimestamp(column);
        return timestamp == null ? null : timestamp.toInstant();
    }

    private static <E extends Enum<E>> E optionalEnum(String value, Class<E> type) {
        return value == null ? null : Enum.valueOf(type, value);
    }

    public record BikeRow(
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

    public record ActiveContractRow(
            UUID id,
            Long idx,
            UUID riderId,
            UUID contractTemplateId,
            Instant startAt,
            Instant endAt,
            Instant terminatedAt,
            String terminatedReason,
            String memo,
            String templateName,
            ContractCategory templateCategory,
            ContractReturnType templateReturnType,
            ContractDurationUnit templateDurationUnit,
            Integer templateDurationValue,
            boolean templateIncludesInsurance
    ) {
    }

    public record RiderRow(
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

    public record RiderInsuranceRow(
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

    public record BikeEquipmentRow(
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
