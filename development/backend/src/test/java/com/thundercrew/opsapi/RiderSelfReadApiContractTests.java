package com.thundercrew.opsapi;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
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
import org.springframework.test.web.servlet.ResultActions;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class RiderSelfReadApiContractTests extends PostgresContainerSupport {

    private static final UUID ADMIN_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final UUID RIDER_ID = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private static final UUID RIDER_NO_VEHICLE_ID = UUID.fromString("cccccccc-cccc-cccc-cccc-cccccccccccc");
    private static final UUID BIKE_ID = UUID.fromString("dddddddd-dddd-dddd-dddd-dddddddddddd");
    private static final UUID CONTRACT_TEMPLATE_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final String RIDER_PHONE = "010-9999-1111";
    private static final String RIDER_NO_VEHICLE_PHONE = "010-9999-2222";
    private static final String RIDER_PASSWORD = "rider-test-secret";
    private static final Pattern ACCESS_TOKEN_PATTERN = Pattern.compile("\"accessToken\"\\s*:\\s*\"([^\"]+)\"");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private String adminToken;

    @DynamicPropertySource
    static void postgresProperties(DynamicPropertyRegistry registry) {
        registerPostgresProperties(registry);
    }

    @BeforeEach
    void resetRows() throws Exception {
        jdbcTemplate.update("delete from bike_current_states");
        jdbcTemplate.update("delete from dispatch_orders");
        jdbcTemplate.update("delete from rider_credentials");
        jdbcTemplate.update("delete from rider_bike_contracts");
        jdbcTemplate.update("delete from bikes");
        jdbcTemplate.update("delete from riders");
        jdbcTemplate.update("delete from admin_users");

        jdbcTemplate.update("""
                insert into admin_users (id, login_id, email, password_hash, display_name, enabled)
                values (?, 'ops-admin-sr', 'ops-sr@example.test', ?, 'Ops Admin', true)
                """, ADMIN_ID, passwordEncoder.encode("correct-password"));

        // Rider with vehicle
        jdbcTemplate.update("""
                insert into riders (id, name, phone_number, team_name, area_name, app_account_linked, memo, deleted_at)
                values (?, '라이더A', ?, '강남팀', '서울 강남', false, 'fixture', null)
                """, RIDER_ID, RIDER_PHONE);

        // Rider without vehicle
        jdbcTemplate.update("""
                insert into riders (id, name, phone_number, team_name, area_name, app_account_linked, memo, deleted_at)
                values (?, '라이더B', ?, '강남팀', '서울 강남', false, 'fixture', null)
                """, RIDER_NO_VEHICLE_ID, RIDER_NO_VEHICLE_PHONE);

        // Bike
        jdbcTemplate.update("""
                insert into bikes (id, plate_number, operation_status, engine_type, wheel_type,
                    ignition_blocked, created_at, updated_at)
                values (?, '12가3456', 'IN_SERVICE', 'ELECTRIC', 'TWO_WHEEL', false, now(), now())
                """, BIKE_ID);

        // Active contract linking RIDER_ID → BIKE_ID
        jdbcTemplate.update("""
                insert into rider_bike_contracts (id, rider_id, bike_id, contract_template_id, start_at, created_at, updated_at)
                values (?, ?, ?, ?, ?, now(), now())
                """,
                UUID.randomUUID(), RIDER_ID, BIKE_ID, CONTRACT_TEMPLATE_ID,
                Instant.parse("2026-01-01T00:00:00Z"));

        adminToken = loginAdminAndExtractAccessToken();
    }

    // ────────────────────────────────────── /me/dispatch-orders ──────────────────────────

    @Test
    void dispatchOrders_withAssignedOrders_returns200AndOrdersInSequence() throws Exception {
        seedAssignedOrder(BIKE_ID, 1, "고객A", "010-1111-0001", "서울 강남구 테헤란로 1", 37.5000, 127.0000);
        seedAssignedOrder(BIKE_ID, 2, "고객B", "010-1111-0002", "서울 강남구 테헤란로 2", 37.5001, 127.0001);

        String token = loginRiderAndGetToken(RIDER_PHONE, RIDER_PASSWORD);

        mockMvc.perform(get("/api/v1/rider/me/dispatch-orders")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].sequence").value(1))
                .andExpect(jsonPath("$[1].sequence").value(2));
    }

    @Test
    void dispatchOrders_riderWithNoVehicle_returns200AndEmptyList() throws Exception {
        String token = loginRiderAndGetToken(RIDER_NO_VEHICLE_PHONE, RIDER_PASSWORD);

        mockMvc.perform(get("/api/v1/rider/me/dispatch-orders")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    // ────────────────────────────────────── /me/vehicle ──────────────────────────────────

    @Test
    void vehicle_withTelemetry_returns200AndAllFields() throws Exception {
        seedBikeCurrentState(BIKE_ID, 37.5665, 126.9780, 1234,
                Instant.now().minusSeconds(60)); // 1 minute ago = ONLINE

        String token = loginRiderAndGetToken(RIDER_PHONE, RIDER_PASSWORD);

        mockMvc.perform(get("/api/v1/rider/me/vehicle")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.plateNumber").value("12가3456"))
                .andExpect(jsonPath("$.currentLatitude").isNumber())
                .andExpect(jsonPath("$.odometerKm").value(1234))
                .andExpect(jsonPath("$.connectionStatus").exists());
    }

    @Test
    void vehicle_withoutTelemetry_returns200AndNullLocationFields() throws Exception {
        String token = loginRiderAndGetToken(RIDER_PHONE, RIDER_PASSWORD);

        mockMvc.perform(get("/api/v1/rider/me/vehicle")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.plateNumber").value("12가3456"))
                .andExpect(jsonPath("$.currentLatitude").doesNotExist())
                .andExpect(jsonPath("$.odometerKm").doesNotExist())
                .andExpect(jsonPath("$.connectionStatus").doesNotExist());
    }

    @Test
    void vehicle_riderWithNoVehicle_returns404() throws Exception {
        String token = loginRiderAndGetToken(RIDER_NO_VEHICLE_PHONE, RIDER_PASSWORD);

        mockMvc.perform(get("/api/v1/rider/me/vehicle")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isNotFound());
    }

    @Test
    void vehicle_unauthenticated_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/rider/me/vehicle"))
                .andExpect(status().isUnauthorized());
    }

    // ────────────────────────────────────── helpers ──────────────────────────────────────

    private void seedAssignedOrder(UUID bikeId, long sequence, String customerName,
            String customerPhone, String address, double lat, double lng) {
        jdbcTemplate.update("""
                insert into dispatch_orders
                    (id, bike_id, customer_name, customer_phone, address,
                     latitude, longitude, sequence, status, kind, created_at, updated_at)
                values (?, ?, ?, ?, ?, ?, ?, ?, 'ASSIGNED', 'DELIVERY', now(), now())
                """,
                UUID.randomUUID(), bikeId, customerName, customerPhone, address, lat, lng, sequence);
    }

    private void seedBikeCurrentState(UUID bikeId, double lat, double lng,
            int odometerKm, Instant lastReceivedAt) {
        jdbcTemplate.update("""
                insert into bike_current_states
                    (bike_id, last_received_at, latitude, longitude, odometer_km,
                     ignition_status, telemetry_source, updated_at)
                values (?, ?, ?, ?, ?, 'ON', 'POLLING', now())
                """,
                bikeId, lastReceivedAt, lat, lng, odometerKm);
    }

    private String loginRiderAndGetToken(String phone, String password) throws Exception {
        issueRiderCredential(RIDER_ID.equals(getIdByPhone(phone)) ? RIDER_ID : RIDER_NO_VEHICLE_ID, password);
        MvcResult result = riderLogin(phone, getNameByPhone(phone))
                .andExpect(status().isOk())
                .andReturn();
        return extract(ACCESS_TOKEN_PATTERN, result);
    }

    private UUID getIdByPhone(String phone) {
        return RIDER_PHONE.equals(phone) ? RIDER_ID : RIDER_NO_VEHICLE_ID;
    }

    private String getNameByPhone(String phone) {
        return RIDER_PHONE.equals(phone) ? "라이더A" : "라이더B";
    }

    private void issueRiderCredential(UUID riderId, String password) throws Exception {
        mockMvc.perform(patch("/api/v1/riders/{id}/credential", riderId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"newPassword\":\"%s\"}".formatted(password)))
                .andExpect(status().isNoContent());
    }

    private ResultActions riderLogin(String phone, String name) throws Exception {
        return mockMvc.perform(post("/api/v1/rider-auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"phoneNumber\":\"%s\",\"name\":\"%s\"}".formatted(phone, name)));
    }

    private String loginAdminAndExtractAccessToken() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"loginId\":\"ops-admin-sr\",\"password\":\"correct-password\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return extract(ACCESS_TOKEN_PATTERN, result);
    }

    private String extract(Pattern pattern, MvcResult result) throws Exception {
        Matcher matcher = pattern.matcher(result.getResponse().getContentAsString());
        assertThat(matcher.find()).isTrue();
        return matcher.group(1);
    }
}
