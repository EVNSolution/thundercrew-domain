package com.thundercrew.opsapi.integrity.repository;

import com.thundercrew.opsapi.integrity.dto.IntegrityFindingCategory;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class IntegrityScanRepository {

    private final JdbcTemplate jdbcTemplate;

    public IntegrityScanRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<IntegrityFindingRow> findReferenceIntegrityFindings() {
        return jdbcTemplate.query(REFERENCE_SCAN_SQL, this::mapRow);
    }

    private IntegrityFindingRow mapRow(ResultSet resultSet, int rowNumber) throws SQLException {
        return new IntegrityFindingRow(
                IntegrityFindingCategory.valueOf(resultSet.getString("category")),
                resultSet.getString("source_table"),
                resultSet.getObject("source_id", UUID.class),
                resultSet.getObject("source_idx", Long.class),
                resultSet.getString("reference_field"),
                resultSet.getObject("reference_id", UUID.class),
                resultSet.getString("target_table")
        );
    }

    private static final String REFERENCE_SCAN_SQL = """
            select *
            from (
                select
                    case when r.id is null then 'REFERENCE_NOT_FOUND' else 'REFERENCE_DELETED' end as category,
                    'rider_bike_contracts' as source_table,
                    c.id as source_id,
                    c.idx as source_idx,
                    'rider_id' as reference_field,
                    c.rider_id as reference_id,
                    'riders' as target_table
                from rider_bike_contracts c
                left join riders r on r.id = c.rider_id
                where c.deleted_at is null
                  and (r.id is null or r.deleted_at is not null)

                union all
                select
                    case when b.id is null then 'REFERENCE_NOT_FOUND' else 'REFERENCE_DELETED' end,
                    'rider_bike_contracts', c.id, c.idx, 'bike_id', c.bike_id, 'bikes'
                from rider_bike_contracts c
                left join bikes b on b.id = c.bike_id
                where c.deleted_at is null
                  and (b.id is null or b.deleted_at is not null)

                union all
                select
                    case when t.id is null then 'REFERENCE_NOT_FOUND' else 'REFERENCE_DELETED' end,
                    'rider_bike_contracts', c.id, c.idx, 'contract_template_id', c.contract_template_id, 'contract_templates'
                from rider_bike_contracts c
                left join contract_templates t on t.id = c.contract_template_id
                where c.deleted_at is null
                  and (t.id is null or t.deleted_at is not null)

                union all
                select
                    case when r.id is null then 'REFERENCE_NOT_FOUND' else 'REFERENCE_DELETED' end,
                    'rider_insurances', ri.id, ri.idx, 'rider_id', ri.rider_id, 'riders'
                from rider_insurances ri
                left join riders r on r.id = ri.rider_id
                where ri.deleted_at is null
                  and (r.id is null or r.deleted_at is not null)

                union all
                select
                    case when ii.id is null then 'REFERENCE_NOT_FOUND' else 'REFERENCE_DELETED' end,
                    'rider_insurances', ri.id, ri.idx, 'insurance_item_id', ri.insurance_item_id, 'insurance_items'
                from rider_insurances ri
                left join insurance_items ii on ii.id = ri.insurance_item_id
                where ri.deleted_at is null
                  and (ii.id is null or ii.deleted_at is not null)

                union all
                select
                    case when b.id is null then 'REFERENCE_NOT_FOUND' else 'REFERENCE_DELETED' end,
                    'bike_equipments', be.id, be.idx, 'bike_id', be.bike_id, 'bikes'
                from bike_equipments be
                left join bikes b on b.id = be.bike_id
                where be.deleted_at is null
                  and (b.id is null or b.deleted_at is not null)

                union all
                select
                    case when et.id is null then 'REFERENCE_NOT_FOUND' else 'REFERENCE_DELETED' end,
                    'bike_equipments', be.id, be.idx, 'equipment_type_id', be.equipment_type_id, 'equipment_types'
                from bike_equipments be
                left join equipment_types et on et.id = be.equipment_type_id
                where be.deleted_at is null
                  and (et.id is null or et.deleted_at is not null)

                union all
                select
                    case when b.id is null then 'REFERENCE_NOT_FOUND' else 'REFERENCE_DELETED' end,
                    'bike_device_installations', bdi.id, bdi.idx, 'bike_id', bdi.bike_id, 'bikes'
                from bike_device_installations bdi
                left join bikes b on b.id = bdi.bike_id
                where bdi.deleted_at is null
                  and (b.id is null or b.deleted_at is not null)

                union all
                select
                    case when d.id is null then 'REFERENCE_NOT_FOUND' else 'REFERENCE_DELETED' end,
                    'bike_device_installations', bdi.id, bdi.idx, 'device_id', bdi.device_id, 'devices'
                from bike_device_installations bdi
                left join devices d on d.id = bdi.device_id
                where bdi.deleted_at is null
                  and (d.id is null or d.deleted_at is not null)

                union all
                select
                    case when b.id is null then 'REFERENCE_NOT_FOUND' else 'REFERENCE_DELETED' end,
                    'bike_recent_states', brs.id, brs.idx, 'bike_id', brs.bike_id, 'bikes'
                from bike_recent_states brs
                left join bikes b on b.id = brs.bike_id
                where b.id is null or b.deleted_at is not null

                union all
                select
                    case when d.id is null then 'REFERENCE_NOT_FOUND' else 'REFERENCE_DELETED' end,
                    'bike_recent_states', brs.id, brs.idx, 'device_id', brs.device_id, 'devices'
                from bike_recent_states brs
                left join devices d on d.id = brs.device_id
                where brs.device_id is not null
                  and (d.id is null or d.deleted_at is not null)

                union all
                select
                    case when b.id is null then 'REFERENCE_NOT_FOUND' else 'REFERENCE_DELETED' end,
                    'bike_current_states', bcs.bike_id, null::bigint, 'bike_id', bcs.bike_id, 'bikes'
                from bike_current_states bcs
                left join bikes b on b.id = bcs.bike_id
                where b.id is null or b.deleted_at is not null

                union all
                select
                    case when d.id is null then 'REFERENCE_NOT_FOUND' else 'REFERENCE_DELETED' end,
                    'bike_current_states', bcs.bike_id, null::bigint, 'device_id', bcs.device_id, 'devices'
                from bike_current_states bcs
                left join devices d on d.id = bcs.device_id
                where bcs.device_id is not null
                  and (d.id is null or d.deleted_at is not null)

                union all
                select
                    case when s.id is null then 'REFERENCE_NOT_FOUND' else 'REFERENCE_DELETED' end,
                    'station_battery_count_logs', l.id, l.idx, 'station_id', l.station_id, 'battery_stations'
                from station_battery_count_logs l
                left join battery_stations s on s.id = l.station_id
                where l.deleted_at is null
                  and (s.id is null or s.deleted_at is not null)
            ) findings
            order by source_table, source_idx nulls last, reference_field
            """;
}
