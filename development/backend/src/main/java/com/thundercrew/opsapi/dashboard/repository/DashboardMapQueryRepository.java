package com.thundercrew.opsapi.dashboard.repository;

import com.thundercrew.opsapi.bike.domain.BikeOperationStatus;
import com.thundercrew.opsapi.bike.domain.BikePurpose;
import com.thundercrew.opsapi.bike.domain.BikeWheelType;
import com.thundercrew.opsapi.dashboard.dto.DashboardMapStateResponse.BikePin;
import com.thundercrew.opsapi.telemetry.domain.TelemetryIgnitionStatus;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
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
                    b.purpose as purpose,
                    b.wheel_type,
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
                    bnc.longitude      as next_customer_lng,
                    bnc.current_customer_name  as current_customer_name,
                    bnc.current_customer_phone as current_customer_phone
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

    private BikePinRow mapBikePinRow(ResultSet rs, int rowNum) throws SQLException {
        return new BikePinRow(
                rs.getObject("bike_id", UUID.class),
                rs.getLong("bike_idx"),
                rs.getString("plate_number"),
                rs.getString("model_name"),
                BikeOperationStatus.valueOf(rs.getString("operation_status")),
                BikePurpose.valueOf(rs.getString("purpose")),
                BikeWheelType.valueOf(rs.getString("wheel_type")),
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
                rs.getBigDecimal("next_customer_lng"),
                rs.getString("current_customer_name"),
                rs.getString("current_customer_phone")
        );
    }

    public Map<UUID, List<BikePin.TrackPoint>> findRecentTracks(Instant since, int maxPerBike) {
        List<TrackRow> rows = jdbcTemplate.query("""
                select bike_id, latitude, longitude, received_at
                from (
                    select bike_id, latitude, longitude, received_at,
                           row_number() over (partition by bike_id order by received_at desc) as rn
                    from bike_recent_states
                    where received_at >= ?::timestamptz
                      and latitude is not null
                      and longitude is not null
                ) ranked
                where rn <= ?
                order by bike_id, received_at asc
                """,
                (rs, rowNum) -> new TrackRow(
                        rs.getObject("bike_id", UUID.class),
                        rs.getBigDecimal("latitude"),
                        rs.getBigDecimal("longitude"),
                        rs.getTimestamp("received_at").toInstant().toEpochMilli()),
                since.toString(), maxPerBike);

        Map<UUID, List<BikePin.TrackPoint>> byBike = new LinkedHashMap<>();
        for (TrackRow row : rows) {
            byBike.computeIfAbsent(row.bikeId(), key -> new ArrayList<>())
                    .add(new BikePin.TrackPoint(row.latitude(), row.longitude(), row.t()));
        }
        return byBike;
    }

    private record TrackRow(UUID bikeId, BigDecimal latitude, BigDecimal longitude, long t) {
    }

    public record BikePinRow(
            UUID bikeId,
            Long bikeIdx,
            String plateNumber,
            String modelName,
            BikeOperationStatus operationStatus,
            BikePurpose purpose,
            BikeWheelType wheelType,
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
            BigDecimal nextCustomerLng,
            String currentCustomerName,
            String currentCustomerPhone
    ) {
    }
}
