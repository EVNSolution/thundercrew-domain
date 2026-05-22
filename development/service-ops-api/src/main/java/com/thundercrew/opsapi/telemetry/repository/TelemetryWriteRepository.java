package com.thundercrew.opsapi.telemetry.repository;

import com.thundercrew.opsapi.telemetry.domain.DeviceTelemetryLog;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Types;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class TelemetryWriteRepository {

    private final JdbcTemplate jdbcTemplate;

    public TelemetryWriteRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public Optional<UUID> insertDeviceTelemetryLogIfAbsent(DeviceTelemetryLog log) {
        String sql = """
                insert into device_telemetry_logs (
                    id, device_id, device_uid, bike_id, vendor_event_id, payload_hash,
                    received_at, device_reported_at, latitude, longitude, speed_kph,
                    battery_percent, odometer_km, ignition_status, telemetry_source, raw_payload
                ) values (
                    ?, ?, ?, ?, ?, ?,
                    ?::timestamptz, ?::timestamptz, ?, ?, ?,
                    ?, ?, ?, ?, ?::jsonb
                )
                %s
                returning id
                """.formatted(idempotencyConflictClause(log));

        List<UUID> insertedIds = jdbcTemplate.query(
                connection -> {
                    PreparedStatement ps = connection.prepareStatement(sql);
                    bindTelemetryLogInsert(ps, log);
                    return ps;
                },
                (rs, rowNum) -> (UUID) rs.getObject("id")
        );
        return insertedIds.stream().findFirst();
    }

    public boolean upsertBikeCurrentStateIfNewer(DeviceTelemetryLog log) {
        int affectedRows = jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement("""
                    insert into bike_current_states (
                        bike_id, device_id, telemetry_log_id, last_received_at,
                        latitude, longitude, speed_kph, battery_percent, odometer_km,
                        ignition_status, telemetry_source, updated_at
                    ) values (
                        ?, ?, ?, ?::timestamptz,
                        ?, ?, ?, ?, ?,
                        ?, ?, now()
                    )
                    on conflict (bike_id) do update set
                        device_id = excluded.device_id,
                        telemetry_log_id = excluded.telemetry_log_id,
                        last_received_at = excluded.last_received_at,
                        latitude = excluded.latitude,
                        longitude = excluded.longitude,
                        speed_kph = excluded.speed_kph,
                        battery_percent = excluded.battery_percent,
                        odometer_km = excluded.odometer_km,
                        ignition_status = excluded.ignition_status,
                        telemetry_source = excluded.telemetry_source,
                        updated_at = now()
                    where bike_current_states.last_received_at < excluded.last_received_at
                    """);
            setUuid(ps, 1, log.getBikeId());
            setUuid(ps, 2, log.getDeviceId());
            setUuid(ps, 3, log.getId());
            setInstantAsIsoString(ps, 4, log.getReceivedAt());
            ps.setBigDecimal(5, log.getLatitude());
            ps.setBigDecimal(6, log.getLongitude());
            ps.setBigDecimal(7, log.getSpeedKph());
            ps.setBigDecimal(8, log.getBatteryPercent());
            setNullableInteger(ps, 9, log.getOdometerKm());
            ps.setString(10, log.getIgnitionStatus().name());
            ps.setString(11, log.getTelemetrySource().name());
            return ps;
        });
        return affectedRows > 0;
    }

    private String idempotencyConflictClause(DeviceTelemetryLog log) {
        if (log.getVendorEventId() != null) {
            return """
                    on conflict (device_uid, vendor_event_id)
                    where vendor_event_id is not null
                    do nothing
                    """;
        }
        return """
                on conflict (device_uid, received_at, telemetry_source, payload_hash)
                where vendor_event_id is null
                do nothing
                """;
    }

    private void bindTelemetryLogInsert(PreparedStatement ps, DeviceTelemetryLog log) throws SQLException {
        setUuid(ps, 1, log.getId());
        setUuid(ps, 2, log.getDeviceId());
        ps.setString(3, log.getDeviceUid());
        setUuid(ps, 4, log.getBikeId());
        setNullableString(ps, 5, log.getVendorEventId());
        ps.setString(6, log.getPayloadHash());
        setInstantAsIsoString(ps, 7, log.getReceivedAt());
        setInstantAsIsoString(ps, 8, log.getDeviceReportedAt());
        ps.setBigDecimal(9, log.getLatitude());
        ps.setBigDecimal(10, log.getLongitude());
        ps.setBigDecimal(11, log.getSpeedKph());
        ps.setBigDecimal(12, log.getBatteryPercent());
        setNullableInteger(ps, 13, log.getOdometerKm());
        ps.setString(14, log.getIgnitionStatus().name());
        ps.setString(15, log.getTelemetrySource().name());
        setNullableString(ps, 16, log.getRawPayload());
    }

    private void setUuid(PreparedStatement ps, int index, UUID value) throws SQLException {
        if (value == null) {
            ps.setNull(index, Types.OTHER);
            return;
        }
        ps.setObject(index, value);
    }

    private void setInstantAsIsoString(PreparedStatement ps, int index, Instant value) throws SQLException {
        if (value == null) {
            ps.setNull(index, Types.TIMESTAMP_WITH_TIMEZONE);
            return;
        }
        ps.setString(index, value.toString());
    }

    private void setNullableString(PreparedStatement ps, int index, String value) throws SQLException {
        if (value == null) {
            ps.setNull(index, Types.VARCHAR);
            return;
        }
        ps.setString(index, value);
    }

    private void setNullableInteger(PreparedStatement ps, int index, Integer value) throws SQLException {
        if (value == null) {
            ps.setNull(index, Types.INTEGER);
            return;
        }
        ps.setInt(index, value);
    }
}
