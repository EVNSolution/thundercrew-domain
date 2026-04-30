package com.thundercrew.opsapi;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class IntegrityScanApiContractTests extends PostgresContainerSupport {

    private static final UUID ADMIN_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final UUID MISSING_RIDER_ID = UUID.fromString("10000000-0000-0000-0000-000000000001");
    private static final UUID DELETED_RIDER_ID = UUID.fromString("10000000-0000-0000-0000-000000000002");
    private static final UUID MISSING_BIKE_ID = UUID.fromString("20000000-0000-0000-0000-000000000001");
    private static final UUID DELETED_BIKE_ID = UUID.fromString("20000000-0000-0000-0000-000000000002");
    private static final UUID MISSING_TEMPLATE_ID = UUID.fromString("30000000-0000-0000-0000-000000000001");
    private static final UUID MISSING_INSURANCE_ITEM_ID = UUID.fromString("40000000-0000-0000-0000-000000000001");
    private static final UUID DELETED_EQUIPMENT_TYPE_ID = UUID.fromString("50000000-0000-0000-0000-000000000002");
    private static final UUID MISSING_DEVICE_ID = UUID.fromString("60000000-0000-0000-0000-000000000001");
    private static final UUID DELETED_DEVICE_ID = UUID.fromString("60000000-0000-0000-0000-000000000002");
    private static final UUID MISSING_STATION_ID = UUID.fromString("70000000-0000-0000-0000-000000000001");
    private static final Pattern ACCESS_TOKEN_PATTERN = Pattern.compile("\\\"accessToken\\\"\\s*:\\s*\\\"([^\\\"]+)\\\"");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private String accessToken;

    @DynamicPropertySource
    static void postgresProperties(DynamicPropertyRegistry registry) {
        registerPostgresProperties(registry);
    }

    @BeforeEach
    void resetRows() throws Exception {
        List.of(
                "admin_auth_sessions",
                "bike_current_states",
                "bike_recent_states",
                "station_battery_count_logs",
                "bike_device_installations",
                "bike_equipments",
                "rider_insurances",
                "rider_bike_contracts",
                "telemetry_ingestion_error_logs",
                "device_telemetry_logs",
                "battery_stations",
                "devices",
                "equipment_types",
                "insurance_items",
                "bikes",
                "riders",
                "admin_users"
        ).forEach(table -> jdbcTemplate.update("delete from " + table));

        jdbcTemplate.update("""
                insert into admin_users (id, login_id, email, password_hash, display_name, enabled)
                values (?, 'ops-admin', 'ops@example.test', ?, 'Ops Admin', true)
                """, ADMIN_ID, passwordEncoder.encode("correct-password"));
        accessToken = loginAndExtractToken();
    }

    @Test
    void integrityScanRequiresAdminAuthentication() throws Exception {
        mockMvc.perform(get("/api/v1/integrity/reference-checks"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_FAILED"));
    }

    @Test
    void integrityScanReportsDocumentedNoForeignKeyReferenceFindings() throws Exception {
        seedDeletedTargets();
        seedBrokenReferenceRows();

        MvcResult result = mockMvc.perform(get("/api/v1/integrity/reference-checks")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.generatedAt").isString())
                .andExpect(jsonPath("$.totalFindings").value(14))
                .andExpect(jsonPath("$.summary[?(@.category == 'REFERENCE_NOT_FOUND')].count").value(org.hamcrest.Matchers.contains(8)))
                .andExpect(jsonPath("$.summary[?(@.category == 'REFERENCE_DELETED')].count").value(org.hamcrest.Matchers.contains(6)))
                .andExpect(jsonPath("$.findings").isArray())
                .andReturn();

        String json = result.getResponse().getContentAsString();
        assertThat(json)
                .contains("rider_bike_contracts", "rider_id", MISSING_RIDER_ID.toString(), "REFERENCE_NOT_FOUND")
                .contains("rider_bike_contracts", "bike_id", DELETED_BIKE_ID.toString(), "REFERENCE_DELETED")
                .contains("rider_bike_contracts", "contract_template_id", MISSING_TEMPLATE_ID.toString())
                .contains("rider_insurances", "insurance_item_id", MISSING_INSURANCE_ITEM_ID.toString())
                .contains("bike_equipments", "equipment_type_id", DELETED_EQUIPMENT_TYPE_ID.toString())
                .contains("bike_device_installations", "device_id", MISSING_DEVICE_ID.toString())
                .contains("bike_recent_states", "device_id", DELETED_DEVICE_ID.toString())
                .contains("bike_current_states", "bike_id", DELETED_BIKE_ID.toString())
                .contains("station_battery_count_logs", "station_id", MISSING_STATION_ID.toString());
    }

    @Test
    void integrityScanReturnsEmptyResultWhenReferencesAreClean() throws Exception {
        mockMvc.perform(get("/api/v1/integrity/reference-checks")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalFindings").value(0))
                .andExpect(jsonPath("$.summary").isEmpty())
                .andExpect(jsonPath("$.findings").isEmpty());
    }

    private void seedDeletedTargets() {
        jdbcTemplate.update("""
                insert into riders (id, name, phone_number, app_account_linked, memo, deleted_at)
                values (?, '삭제 라이더', '010-0000-0002', false, 'integrity fixture', now())
                """, DELETED_RIDER_ID);
        jdbcTemplate.update("""
                insert into bikes (id, plate_number, vin, model_name, operation_status, deleted_at)
                values (?, '서울T-삭제', 'VIN-DELETED-BIKE', 'TC-100', 'READY', now())
                """, DELETED_BIKE_ID);
        jdbcTemplate.update("""
                insert into equipment_types (id, name, description, enabled, deleted_at)
                values (?, '삭제 장비유형', 'integrity fixture', false, now())
                """, DELETED_EQUIPMENT_TYPE_ID);
        jdbcTemplate.update("""
                insert into devices (id, device_uid, manufacturer, model_name, enabled, deleted_at)
                values (?, 'DEV-DELETED', 'ThunderDevice', 'TD-100', false, now())
                """, DELETED_DEVICE_ID);
    }

    private void seedBrokenReferenceRows() {
        Instant now = Instant.now();
        jdbcTemplate.update("""
                insert into rider_bike_contracts (id, rider_id, bike_id, contract_template_id, start_at, memo)
                values (?, ?, ?, ?, ?::timestamptz, 'broken contract refs')
                """, UUID.fromString("80000000-0000-0000-0000-000000000001"), MISSING_RIDER_ID,
                DELETED_BIKE_ID, MISSING_TEMPLATE_ID, now.minusSeconds(3600).toString());
        jdbcTemplate.update("""
                insert into rider_insurances (id, rider_id, insurance_item_id, memo, enabled)
                values (?, ?, ?, 'broken rider insurance refs', true)
                """, UUID.fromString("80000000-0000-0000-0000-000000000002"), DELETED_RIDER_ID,
                MISSING_INSURANCE_ITEM_ID);
        jdbcTemplate.update("""
                insert into bike_equipments (id, bike_id, equipment_type_id, installed_at, management_due_date, memo)
                values (?, ?, ?, ?::timestamptz, current_date, 'broken equipment refs')
                """, UUID.fromString("80000000-0000-0000-0000-000000000003"), MISSING_BIKE_ID,
                DELETED_EQUIPMENT_TYPE_ID, now.minusSeconds(7200).toString());
        jdbcTemplate.update("""
                insert into bike_device_installations (id, bike_id, device_id, installed_at, memo)
                values (?, ?, ?, ?::timestamptz, 'broken installation refs')
                """, UUID.fromString("80000000-0000-0000-0000-000000000004"), DELETED_BIKE_ID,
                MISSING_DEVICE_ID, now.minusSeconds(7200).toString());
        jdbcTemplate.update("""
                insert into bike_recent_states (id, bike_id, device_id, received_at, ignition_status, telemetry_source)
                values (?, ?, ?, ?::timestamptz, 'ON', 'POLLING')
                """, UUID.fromString("80000000-0000-0000-0000-000000000005"), MISSING_BIKE_ID,
                DELETED_DEVICE_ID, now.minusSeconds(600).toString());
        jdbcTemplate.update("""
                insert into bike_current_states (bike_id, device_id, last_received_at, ignition_status, telemetry_source)
                values (?, ?, ?::timestamptz, 'OFF', 'WEBHOOK')
                """, DELETED_BIKE_ID, MISSING_DEVICE_ID, now.minusSeconds(300).toString());
        jdbcTemplate.update("""
                insert into station_battery_count_logs (
                    id, station_id,
                    before_max_battery_capacity, after_max_battery_capacity,
                    before_current_battery_count, after_current_battery_count,
                    before_available_battery_count, after_available_battery_count,
                    reason, changed_at
                ) values (?, ?, 10, 10, 5, 6, 2, 3, 'broken station ref', ?::timestamptz)
                """, UUID.fromString("80000000-0000-0000-0000-000000000006"), MISSING_STATION_ID,
                now.minusSeconds(120).toString());
    }

    private String loginAndExtractToken() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"loginId":"ops-admin","password":"correct-password"}
                                """))
                .andExpect(status().isOk())
                .andReturn();
        Matcher matcher = ACCESS_TOKEN_PATTERN.matcher(result.getResponse().getContentAsString());
        if (!matcher.find()) {
            throw new AssertionError("accessToken was not present in login response: "
                    + result.getResponse().getContentAsString());
        }
        return matcher.group(1);
    }
}
