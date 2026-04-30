package com.thundercrew.opsapi;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ReadOnlyApiContractTests extends PostgresContainerSupport {

    private static final UUID RIDER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID BIKE_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private static final UUID STATION_ID = UUID.fromString("33333333-3333-3333-3333-333333333333");
    private static final UUID HISTORY_ID = UUID.fromString("44444444-4444-4444-4444-444444444444");
    private static final UUID CONTRACT_ID = UUID.fromString("55555555-5555-5555-5555-555555555555");
    private static final UUID INSURANCE_ITEM_ID = UUID.fromString("66666666-6666-6666-6666-666666666666");
    private static final UUID RIDER_INSURANCE_ID = UUID.fromString("77777777-7777-7777-7777-777777777777");
    private static final UUID EQUIPMENT_TYPE_ID = UUID.fromString("88888888-8888-8888-8888-888888888888");
    private static final UUID BIKE_EQUIPMENT_ID = UUID.fromString("99999999-9999-9999-9999-999999999991");
    private static final UUID DEVICE_ID = UUID.fromString("99999999-9999-9999-9999-999999999992");
    private static final UUID INSTALLATION_ID = UUID.fromString("99999999-9999-9999-9999-999999999993");
    private static final UUID COUNT_LOG_ID = UUID.fromString("99999999-9999-9999-9999-999999999994");
    private static final UUID CONTRACT_TEMPLATE_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @DynamicPropertySource
    static void postgresProperties(DynamicPropertyRegistry registry) {
        registerPostgresProperties(registry);
    }

    @BeforeEach
    void resetRows() {
        List.of(
                "station_battery_count_logs",
                "battery_stations",
                "bike_device_installations",
                "devices",
                "bike_equipments",
                "equipment_types",
                "rider_insurances",
                "insurance_items",
                "rider_bike_contracts",
                "bike_operation_status_histories",
                "bikes",
                "riders"
        ).forEach(table -> jdbcTemplate.update("delete from " + table));

        jdbcTemplate.update("""
                insert into riders (id, name, phone_number, team_name, area_name, app_account_linked, app_account_id, app_linked_at, memo)
                values (?, '김라이더', '010-1000-2000', '강남팀', '서울 강남', false, null, null, '대표 라이더')
                """, RIDER_ID);
        jdbcTemplate.update("""
                insert into bikes (id, plate_number, vin, model_name, operation_status, memo)
                values (?, 'TH-100', 'VIN-READ-001', 'Thunder M1', 'READY', '대표 바이크')
                """, BIKE_ID);
        jdbcTemplate.update("""
                insert into battery_stations (id, name, address, latitude, longitude, status, max_battery_capacity, current_battery_count, available_battery_count, memo)
                values (?, '강남 스테이션', '서울 강남구 테헤란로', 37.5010000, 127.0396000, 'ACTIVE', 5, 4, 2, '지도 핀 기준')
                """, STATION_ID);
        jdbcTemplate.update("""
                insert into bike_operation_status_histories (id, bike_id, operation_status, started_at, reason)
                values (?, ?, 'READY', now(), 'read api fixture')
                """, HISTORY_ID, BIKE_ID);
        jdbcTemplate.update("""
                insert into rider_bike_contracts (id, rider_id, bike_id, contract_template_id, start_at, memo)
                values (?, ?, ?, ?, now(), 'read api contract')
                """, CONTRACT_ID, RIDER_ID, BIKE_ID, CONTRACT_TEMPLATE_ID);
        jdbcTemplate.update("""
                insert into insurance_items (id, name, description, enabled)
                values (?, '기본 보험', 'read api fixture', true)
                """, INSURANCE_ITEM_ID);
        jdbcTemplate.update("""
                insert into rider_insurances (id, rider_id, insurance_item_id, memo, enabled)
                values (?, ?, ?, 'read api rider insurance', true)
                """, RIDER_INSURANCE_ID, RIDER_ID, INSURANCE_ITEM_ID);
        jdbcTemplate.update("""
                insert into equipment_types (id, name, description, enabled)
                values (?, '브레이크 패드', 'read api fixture', true)
                """, EQUIPMENT_TYPE_ID);
        jdbcTemplate.update("""
                insert into bike_equipments (id, bike_id, equipment_type_id, equipment_label, model_name, serial_number, installed_at, management_due_date)
                values (?, ?, ?, '전륜 브레이크', 'Brake V1', 'SERIAL-READ-001', now(), current_date)
                """, BIKE_EQUIPMENT_ID, BIKE_ID, EQUIPMENT_TYPE_ID);
        jdbcTemplate.update("""
                insert into devices (id, device_uid, manufacturer, model_name, enabled, memo)
                values (?, 'DEVICE-READ-001', 'Thunder', 'Tracker V1', true, 'read api device')
                """, DEVICE_ID);
        jdbcTemplate.update("""
                insert into bike_device_installations (id, bike_id, device_id, installed_at, memo)
                values (?, ?, ?, now(), 'read api installation')
                """, INSTALLATION_ID, BIKE_ID, DEVICE_ID);
        jdbcTemplate.update("""
                insert into station_battery_count_logs (
                    id, station_id,
                    before_max_battery_capacity, after_max_battery_capacity,
                    before_current_battery_count, after_current_battery_count,
                    before_available_battery_count, after_available_battery_count,
                    reason, changed_at
                ) values (?, ?, 5, 5, 3, 4, 1, 2, 'read api count update', now())
                """, COUNT_LOG_ID, STATION_ID);
    }

    @Test
    void readListsExposeSharedPageContractForEveryCoreResource() throws Exception {
        for (String endpoint : List.of(
                "/api/v1/riders",
                "/api/v1/bikes",
                "/api/v1/bike-operation-status-histories",
                "/api/v1/contract-templates",
                "/api/v1/rider-bike-contracts",
                "/api/v1/insurance-items",
                "/api/v1/rider-insurances",
                "/api/v1/equipment-types",
                "/api/v1/bike-equipments",
                "/api/v1/devices",
                "/api/v1/bike-device-installations",
                "/api/v1/battery-stations",
                "/api/v1/station-battery-count-logs"
        )) {
            mockMvc.perform(get(endpoint).with(user("ops-admin")).param("size", "5"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.items").isArray())
                    .andExpect(jsonPath("$.page.size").value(5))
                    .andExpect(jsonPath("$.page.totalItems").exists());
        }
    }

    @Test
    void representativeDetailsExposeHumanReadableReadDtos() throws Exception {
        mockMvc.perform(get("/api/v1/riders/{id}", RIDER_ID).with(user("ops-admin")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(RIDER_ID.toString()))
                .andExpect(jsonPath("$.idx").isNumber())
                .andExpect(jsonPath("$.name").value("김라이더"))
                .andExpect(jsonPath("$.phoneNumber").value("010-1000-2000"))
                .andExpect(jsonPath("$.appLinkStatus").value("NOT_LINKED"));

        mockMvc.perform(get("/api/v1/bikes/{id}", BIKE_ID).with(user("ops-admin")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.plateNumber").value("TH-100"))
                .andExpect(jsonPath("$.operationStatus").value("READY"));

        mockMvc.perform(get("/api/v1/battery-stations/{id}", STATION_ID).with(user("ops-admin")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("강남 스테이션"))
                .andExpect(jsonPath("$.availableBatteryLabel").value("2/5"))
                .andExpect(jsonPath("$.capacityPercentage").value(80));

        mockMvc.perform(get("/api/v1/contract-templates/{id}", CONTRACT_TEMPLATE_ID).with(user("ops-admin")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("무제한 계약"))
                .andExpect(jsonPath("$.unlimited").value(true));
    }


    @Test
    void everyDetailEndpointReturnsItsSeededResourceId() throws Exception {
        for (DetailEndpoint endpoint : detailEndpoints()) {
            mockMvc.perform(get(endpoint.path() + "/{id}", endpoint.id()).with(user("ops-admin")))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value(endpoint.id().toString()));
        }
    }

    @Test
    void missingDetailReturnsNotFoundErrorContract() throws Exception {
        UUID missingId = UUID.fromString("99999999-9999-9999-9999-999999999999");

        for (DetailEndpoint endpoint : detailEndpoints()) {
            mockMvc.perform(get(endpoint.path() + "/{id}", missingId).with(user("ops-admin")))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"))
                    .andExpect(jsonPath("$.path").value(endpoint.path() + "/" + missingId));
        }
    }


    @Test
    void softDeletedRowsAreHiddenFromReadLists() throws Exception {
        UUID deletedRiderId = UUID.fromString("44444444-4444-4444-4444-444444444444");
        jdbcTemplate.update("""
                insert into riders (id, name, phone_number, app_account_linked, deleted_at)
                values (?, '삭제라이더', '010-9999-0000', false, now())
                """, deletedRiderId);

        mockMvc.perform(get("/api/v1/riders").with(user("ops-admin")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].name").value("김라이더"));
    }

    @Test
    void malformedDetailIdReturnsValidationErrorContract() throws Exception {
        mockMvc.perform(get("/api/v1/riders/not-a-uuid").with(user("ops-admin")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.path").value("/api/v1/riders/not-a-uuid"));
    }

    @Test
    void operationReadEndpointsStillRequireAuthenticatedScaffoldPrincipal() throws Exception {
        mockMvc.perform(get("/api/v1/riders"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void remainingWriteRoutesAreNotPartOfTheCurrentCommandBaseline() throws Exception {
        UUID id = RIDER_ID;
        for (String endpoint : List.of(
                "/api/v1/bike-operation-status-histories",
                "/api/v1/insurance-items",
                "/api/v1/rider-insurances",
                "/api/v1/equipment-types",
                "/api/v1/bike-equipments",
                "/api/v1/bike-device-installations",
                "/api/v1/battery-stations",
                "/api/v1/station-battery-count-logs"
        )) {
            mockMvc.perform(post(endpoint)
                            .with(user("ops-admin"))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{}"))
                    .andExpect(status().isMethodNotAllowed());
            mockMvc.perform(put(endpoint + "/{id}", id)
                            .with(user("ops-admin"))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{}"))
                    .andExpect(status().isMethodNotAllowed());
            mockMvc.perform(patch(endpoint + "/{id}", id)
                            .with(user("ops-admin"))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{}"))
                    .andExpect(status().isMethodNotAllowed());
            mockMvc.perform(delete(endpoint + "/{id}", id).with(user("ops-admin")))
                    .andExpect(status().isMethodNotAllowed());
        }
    }

    private List<DetailEndpoint> detailEndpoints() {
        return List.of(
                new DetailEndpoint("/api/v1/riders", RIDER_ID),
                new DetailEndpoint("/api/v1/bikes", BIKE_ID),
                new DetailEndpoint("/api/v1/bike-operation-status-histories", HISTORY_ID),
                new DetailEndpoint("/api/v1/contract-templates", CONTRACT_TEMPLATE_ID),
                new DetailEndpoint("/api/v1/rider-bike-contracts", CONTRACT_ID),
                new DetailEndpoint("/api/v1/insurance-items", INSURANCE_ITEM_ID),
                new DetailEndpoint("/api/v1/rider-insurances", RIDER_INSURANCE_ID),
                new DetailEndpoint("/api/v1/equipment-types", EQUIPMENT_TYPE_ID),
                new DetailEndpoint("/api/v1/bike-equipments", BIKE_EQUIPMENT_ID),
                new DetailEndpoint("/api/v1/devices", DEVICE_ID),
                new DetailEndpoint("/api/v1/bike-device-installations", INSTALLATION_ID),
                new DetailEndpoint("/api/v1/battery-stations", STATION_ID),
                new DetailEndpoint("/api/v1/station-battery-count-logs", COUNT_LOG_ID)
        );
    }

    private record DetailEndpoint(String path, UUID id) {
    }

}
