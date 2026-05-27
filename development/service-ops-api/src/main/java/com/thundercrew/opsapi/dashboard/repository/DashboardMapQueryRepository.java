package com.thundercrew.opsapi.dashboard.repository;

import com.thundercrew.opsapi.bike.domain.BikeOperationStatus;
import com.thundercrew.opsapi.bike.domain.BikeServiceType;
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
                    b.service_type,
                    active_rider.rider_name,
                    cs.device_id,
                    cs.last_received_at,
                    cs.latitude,
                    cs.longitude,
                    cs.speed_kph,
                    cs.battery_percent,
                    cs.ignition_status,
                    cs.telemetry_source,
                    bnc.customer_name  as next_customer_name,
                    bnc.customer_phone as next_customer_phone,
                    bnc.latitude       as next_customer_lat,
                    bnc.longitude      as next_customer_lng
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
                      and c.start_at <= ?::timestamptz
                      and ?::timestamptz < coalesce(c.terminated_at, c.end_at, 'infinity'::timestamptz)
                    order by c.start_at desc, c.idx desc
                    limit 1
                ) active_rider on true
                left join bike_next_customer bnc on bnc.bike_id = b.id
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
                BikeServiceType.valueOf(rs.getString("service_type")),
                rs.getString("rider_name"),
                rs.getObject("device_id", UUID.class),
                rs.getTimestamp("last_received_at").toInstant(),
                rs.getBigDecimal("latitude"),
                rs.getBigDecimal("longitude"),
                rs.getBigDecimal("speed_kph"),
                rs.getBigDecimal("battery_percent"),
                TelemetryIgnitionStatus.valueOf(rs.getString("ignition_status")),
                rs.getString("telemetry_source"),
                rs.getString("next_customer_name"),
                rs.getString("next_customer_phone"),
                rs.getBigDecimal("next_customer_lat"),
                rs.getBigDecimal("next_customer_lng")
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
            BikeServiceType serviceType,
            String activeRiderName,
            UUID deviceId,
            Instant lastReceivedAt,
            BigDecimal latitude,
            BigDecimal longitude,
            BigDecimal speedKph,
            BigDecimal batteryPercent,
            TelemetryIgnitionStatus ignitionStatus,
            String telemetrySource,
            String nextCustomerName,
            String nextCustomerPhone,
            BigDecimal nextCustomerLat,
            BigDecimal nextCustomerLng
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
