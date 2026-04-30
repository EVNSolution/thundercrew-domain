package com.thundercrew.opsapi.dashboard.repository;

import com.thundercrew.opsapi.bike.domain.BikeOperationStatus;
import com.thundercrew.opsapi.station.domain.BatteryStationStatus;
import com.thundercrew.opsapi.telemetry.domain.TelemetryIgnitionStatus;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class DashboardMapQueryRepository {

    private final JdbcTemplate jdbcTemplate;

    public DashboardMapQueryRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public long countActiveBikes() {
        Long result = jdbcTemplate.queryForObject("""
                select count(*)
                from bikes
                where deleted_at is null
                """, Long.class);
        return result == null ? 0 : result;
    }

    public List<BikePinRow> findCurrentBikeStates(Instant now) {
        return jdbcTemplate.query("""
                select
                    b.id as bike_id,
                    b.idx as bike_idx,
                    b.plate_number,
                    b.model_name,
                    b.operation_status,
                    active_rider.rider_name,
                    cs.device_id,
                    cs.last_received_at,
                    cs.latitude,
                    cs.longitude,
                    cs.speed_kph,
                    cs.battery_percent,
                    cs.ignition_status,
                    cs.telemetry_source
                from bike_current_states cs
                join bikes b
                  on b.id = cs.bike_id
                 and b.deleted_at is null
                left join lateral (
                    select
                        r.name as rider_name
                    from rider_bike_contracts c
                    join riders r
                      on r.id = c.rider_id
                     and r.deleted_at is null
                    where c.bike_id = b.id
                      and c.deleted_at is null
                      and c.terminated_at is null
                      and c.start_at <= ?::timestamptz
                      and (c.end_at is null or c.end_at > ?::timestamptz)
                    order by c.start_at desc, c.idx desc
                    limit 1
                ) active_rider on true
                order by cs.last_received_at desc, b.idx asc
                """, this::mapBikePinRow, now.toString(), now.toString());
    }

    public List<StationPinRow> findStationPins() {
        return jdbcTemplate.query("""
                select
                    id,
                    idx,
                    name,
                    address,
                    latitude,
                    longitude,
                    status,
                    max_battery_capacity,
                    current_battery_count,
                    available_battery_count
                from battery_stations
                where deleted_at is null
                order by idx asc
                """, this::mapStationPinRow);
    }

    private BikePinRow mapBikePinRow(ResultSet rs, int rowNum) throws SQLException {
        return new BikePinRow(
                rs.getObject("bike_id", UUID.class),
                rs.getLong("bike_idx"),
                rs.getString("plate_number"),
                rs.getString("model_name"),
                BikeOperationStatus.valueOf(rs.getString("operation_status")),
                rs.getString("rider_name"),
                rs.getObject("device_id", UUID.class),
                rs.getTimestamp("last_received_at").toInstant(),
                rs.getBigDecimal("latitude"),
                rs.getBigDecimal("longitude"),
                rs.getBigDecimal("speed_kph"),
                rs.getBigDecimal("battery_percent"),
                TelemetryIgnitionStatus.valueOf(rs.getString("ignition_status")),
                rs.getString("telemetry_source")
        );
    }

    private StationPinRow mapStationPinRow(ResultSet rs, int rowNum) throws SQLException {
        return new StationPinRow(
                rs.getObject("id", UUID.class),
                rs.getLong("idx"),
                rs.getString("name"),
                rs.getString("address"),
                rs.getBigDecimal("latitude"),
                rs.getBigDecimal("longitude"),
                BatteryStationStatus.valueOf(rs.getString("status")),
                rs.getInt("max_battery_capacity"),
                rs.getInt("current_battery_count"),
                rs.getInt("available_battery_count")
        );
    }

    public record BikePinRow(
            UUID bikeId,
            Long bikeIdx,
            String plateNumber,
            String modelName,
            BikeOperationStatus operationStatus,
            String activeRiderName,
            UUID deviceId,
            Instant lastReceivedAt,
            BigDecimal latitude,
            BigDecimal longitude,
            BigDecimal speedKph,
            BigDecimal batteryPercent,
            TelemetryIgnitionStatus ignitionStatus,
            String telemetrySource
    ) {
    }

    public record StationPinRow(
            UUID stationId,
            Long stationIdx,
            String name,
            String address,
            BigDecimal latitude,
            BigDecimal longitude,
            BatteryStationStatus status,
            int maxBatteryCapacity,
            int currentBatteryCount,
            int availableBatteryCount
    ) {
    }
}
