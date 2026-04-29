package com.thundercrew.opsapi;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

@SpringBootTest
@ActiveProfiles("test")
class CorePersistenceBaselineTests extends PostgresContainerSupport {

    private static final List<String> CORE_TABLES = List.of(
            "riders",
            "bikes",
            "bike_operation_status_histories",
            "rider_bike_contracts",
            "insurance_items",
            "rider_insurances",
            "equipment_types",
            "bike_equipments",
            "devices",
            "bike_device_installations",
            "battery_stations",
            "station_battery_count_logs");

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @DynamicPropertySource
    static void postgresProperties(DynamicPropertyRegistry registry) {
        registerPostgresProperties(registry);
    }

    @Test
    void flywayCreatesEveryNonTelemetryCoreOperationsTable() {
        List<String> tables = jdbcTemplate.queryForList("""
                select table_name
                from information_schema.tables
                where table_schema = current_schema()
                order by table_name
                """, String.class);

        assertThat(tables).containsAll(CORE_TABLES);
    }

    @Test
    void coreSchemaDoesNotCreateCrossDomainForeignKeys() {
        Integer foreignKeyCount = jdbcTemplate.queryForObject("""
                select count(*)
                from information_schema.table_constraints
                where table_schema = current_schema()
                  and constraint_type = 'FOREIGN KEY'
                  and table_name in (
                    'riders',
                    'bikes',
                    'bike_operation_status_histories',
                    'rider_bike_contracts',
                    'insurance_items',
                    'rider_insurances',
                    'equipment_types',
                    'bike_equipments',
                    'devices',
                    'bike_device_installations',
                    'battery_stations',
                    'station_battery_count_logs'
                  )
                """, Integer.class);

        assertThat(foreignKeyCount).isZero();
    }


    @Test
    void schemaExposesRequiredPartialIndexesAndOmitsTelemetryTables() {
        List<String> indexNames = jdbcTemplate.queryForList("""
                select indexname
                from pg_indexes
                where schemaname = current_schema()
                order by indexname
                """, String.class);

        assertThat(indexNames).contains(
                "ux_riders_phone_number_active",
                "ux_bikes_plate_number_active",
                "ux_bikes_vin_active",
                "ux_bike_operation_status_histories_open_bike",
                "ux_insurance_items_name_active",
                "ux_rider_insurances_active_pair",
                "ux_equipment_types_name_active",
                "ux_bike_equipments_serial_active",
                "ux_devices_device_uid_active",
                "ux_bike_device_installations_active_bike",
                "ux_bike_device_installations_active_device",
                "ux_battery_stations_name_active");

        List<String> telemetryTables = jdbcTemplate.queryForList("""
                select table_name
                from information_schema.tables
                where table_schema = current_schema()
                  and table_name in (
                    'device_telemetry_logs',
                    'bike_recent_states',
                    'bike_current_states',
                    'device_api_sync_logs',
                    'telemetry_ingestion_error_logs'
                  )
                """, String.class);

        assertThat(telemetryTables).isEmpty();
    }

    @Test
    void mutableCoreTablesHaveUuidIdDisplayIdxAndAuditColumns() {
        for (String tableName : CORE_TABLES) {
            List<String> columns = jdbcTemplate.queryForList("""
                    select column_name
                    from information_schema.columns
                    where table_schema = current_schema()
                      and table_name = ?
                    """, String.class, tableName);

            assertThat(columns)
                    .as("%s should follow the core table column convention", tableName)
                    .contains("id", "idx", "created_at", "updated_at", "deleted_at", "created_by", "updated_by", "deleted_by");
        }
    }

    @Test
    void activeUniqueIndexesAllowBusinessIdentifierReuseAfterSoftDelete() {
        UUID deletedRiderId = UUID.randomUUID();
        UUID replacementRiderId = UUID.randomUUID();

        jdbcTemplate.update("""
                insert into riders (id, name, phone_number, deleted_at)
                values (?, 'Deleted Rider', '010-9999-0000', now())
                """, deletedRiderId);

        jdbcTemplate.update("""
                insert into riders (id, name, phone_number)
                values (?, 'Replacement Rider', '010-9999-0000')
                """, replacementRiderId);

        Integer activeCount = jdbcTemplate.queryForObject("""
                select count(*) from riders
                where phone_number = '010-9999-0000'
                  and deleted_at is null
                """, Integer.class);

        assertThat(activeCount).isEqualTo(1);
    }

    @Test
    void activeUniqueIndexesProtectHumanBusinessIdentifiers() {
        UUID rider1 = UUID.randomUUID();
        UUID rider2 = UUID.randomUUID();
        jdbcTemplate.update("insert into riders (id, name, phone_number) values (?, 'Kim Rider', '010-1111-2222')", rider1);
        assertThatThrownBy(() -> jdbcTemplate.update(
                "insert into riders (id, name, phone_number) values (?, 'Park Rider', '010-1111-2222')", rider2))
                .isInstanceOf(DataIntegrityViolationException.class);

        UUID bike1 = UUID.randomUUID();
        UUID bike2 = UUID.randomUUID();
        UUID bike3 = UUID.randomUUID();
        jdbcTemplate.update("insert into bikes (id, plate_number, vin, operation_status) values (?, '서울A-001', 'VIN-001', 'READY')", bike1);
        assertThatThrownBy(() -> jdbcTemplate.update(
                "insert into bikes (id, plate_number, vin, operation_status) values (?, '서울A-001', 'VIN-002', 'READY')", bike2))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbcTemplate.update(
                "insert into bikes (id, plate_number, vin, operation_status) values (?, '서울A-003', 'VIN-001', 'READY')", bike3))
                .isInstanceOf(DataIntegrityViolationException.class);

        UUID device1 = UUID.randomUUID();
        UUID device2 = UUID.randomUUID();
        jdbcTemplate.update("insert into devices (id, device_uid) values (?, 'DEVICE-001')", device1);
        assertThatThrownBy(() -> jdbcTemplate.update("insert into devices (id, device_uid) values (?, 'DEVICE-001')", device2))
                .isInstanceOf(DataIntegrityViolationException.class);

        UUID station1 = UUID.randomUUID();
        UUID station2 = UUID.randomUUID();
        jdbcTemplate.update("""
                insert into battery_stations
                    (id, name, address, latitude, longitude, status, max_battery_capacity, current_battery_count, available_battery_count)
                values (?, '강남 스테이션', '서울 강남구', 37.5000000, 127.0300000, 'ACTIVE', 20, 10, 5)
                """, station1);
        assertThatThrownBy(() -> jdbcTemplate.update("""
                insert into battery_stations
                    (id, name, address, latitude, longitude, status, max_battery_capacity, current_battery_count, available_battery_count)
                values (?, '강남 스테이션', '서울 강남구', 37.5000000, 127.0300000, 'ACTIVE', 20, 10, 5)
                """, station2)).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void coreCheckConstraintsAndPartialUniqueIndexesProtectRepresentativeInvariants() {
        UUID bikeId = UUID.randomUUID();
        UUID otherBikeId = UUID.randomUUID();
        UUID deviceId = UUID.randomUUID();
        UUID otherDeviceId = UUID.randomUUID();

        jdbcTemplate.update("insert into bikes (id, plate_number, vin, operation_status) values (?, '서울B-001', 'VIN-B-001', 'IN_SERVICE')", bikeId);
        jdbcTemplate.update("insert into bikes (id, plate_number, vin, operation_status) values (?, '서울B-002', 'VIN-B-002', 'IN_SERVICE')", otherBikeId);
        jdbcTemplate.update("insert into devices (id, device_uid) values (?, 'DEVICE-B-001')", deviceId);
        jdbcTemplate.update("insert into devices (id, device_uid) values (?, 'DEVICE-B-002')", otherDeviceId);

        jdbcTemplate.update("""
                insert into bike_operation_status_histories (id, bike_id, operation_status, started_at)
                values (?, ?, 'IN_SERVICE', now())
                """, UUID.randomUUID(), bikeId);
        assertThatThrownBy(() -> jdbcTemplate.update("""
                insert into bike_operation_status_histories (id, bike_id, operation_status, started_at)
                values (?, ?, 'READY', now())
                """, UUID.randomUUID(), bikeId)).isInstanceOf(DataIntegrityViolationException.class);

        jdbcTemplate.update("""
                insert into bike_device_installations (id, bike_id, device_id, installed_at)
                values (?, ?, ?, now())
                """, UUID.randomUUID(), bikeId, deviceId);
        assertThatThrownBy(() -> jdbcTemplate.update("""
                insert into bike_device_installations (id, bike_id, device_id, installed_at)
                values (?, ?, ?, now())
                """, UUID.randomUUID(), bikeId, otherDeviceId)).isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbcTemplate.update("""
                insert into bike_device_installations (id, bike_id, device_id, installed_at)
                values (?, ?, ?, now())
                """, UUID.randomUUID(), otherBikeId, deviceId)).isInstanceOf(DataIntegrityViolationException.class);

        assertThatThrownBy(() -> jdbcTemplate.update("""
                insert into battery_stations
                    (id, name, address, latitude, longitude, status, max_battery_capacity, current_battery_count, available_battery_count)
                values (?, '카운트 오류 스테이션', '서울', 37.5000000, 127.0300000, 'ACTIVE', 5, 10, 1)
                """, UUID.randomUUID())).isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbcTemplate.update("""
                insert into battery_stations
                    (id, name, address, latitude, longitude, status, max_battery_capacity, current_battery_count, available_battery_count)
                values (?, '사용가능수 오류 스테이션', '서울', 37.5000000, 127.0300000, 'ACTIVE', 10, 3, 4)
                """, UUID.randomUUID())).isInstanceOf(DataIntegrityViolationException.class);

        assertThatThrownBy(() -> jdbcTemplate.update("""
                insert into rider_bike_contracts
                    (id, rider_id, bike_id, contract_template_id, start_at, end_at)
                values (?, ?, ?, ?, '2026-05-02T00:00:00Z', '2026-05-01T00:00:00Z')
                """, UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID()))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbcTemplate.update("""
                insert into rider_bike_contracts
                    (id, rider_id, bike_id, contract_template_id, start_at, terminated_at)
                values (?, ?, ?, ?, '2026-05-02T00:00:00Z', '2026-05-01T00:00:00Z')
                """, UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID()))
                .isInstanceOf(DataIntegrityViolationException.class);
    }
}
