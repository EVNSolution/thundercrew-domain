package com.thundercrew.opsapi;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
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
import org.springframework.mock.web.MockMultipartFile;
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
class RiderDriverApiContractTests extends PostgresContainerSupport {

    private static final UUID ADMIN_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final UUID RIDER_ID = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private static final UUID RIDER_NO_VEHICLE_ID = UUID.fromString("cccccccc-cccc-cccc-cccc-cccccccccccc");
    private static final UUID BIKE_ID = UUID.fromString("dddddddd-dddd-dddd-dddd-dddddddddddd");
    private static final UUID BIKE_NON_CALL_ID = UUID.fromString("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee");
    private static final UUID CONTRACT_TEMPLATE_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final String RIDER_PHONE = "010-9999-1111";
    private static final String RIDER_NO_VEHICLE_PHONE = "010-9999-2222";
    private static final String RIDER_NON_CALL_PHONE = "010-9999-3333";
    private static final UUID RIDER_NON_CALL_ID = UUID.fromString("ffffffff-ffff-ffff-ffff-ffffffffffff");
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
        jdbcTemplate.update("delete from notifications");
        jdbcTemplate.update("delete from bike_current_states");
        jdbcTemplate.update("delete from dispatch_orders");
        jdbcTemplate.update("delete from rider_credentials");
        jdbcTemplate.update("delete from rider_bike_contracts");
        jdbcTemplate.update("delete from bikes");
        jdbcTemplate.update("delete from riders");
        jdbcTemplate.update("delete from tips");
        jdbcTemplate.update("delete from battery_stations");
        jdbcTemplate.update("delete from admin_users");

        jdbcTemplate.update("""
                insert into admin_users (id, login_id, email, password_hash, display_name, enabled)
                values (?, 'ops-admin-dr', 'ops-dr@example.test', ?, 'Ops Admin', true)
                """, ADMIN_ID, passwordEncoder.encode("correct-password"));

        // Rider with CALL vehicle
        jdbcTemplate.update("""
                insert into riders (id, name, phone_number, team_name, area_name, app_account_linked, memo, deleted_at)
                values (?, '라이더A', ?, '강남팀', '서울 강남', false, 'fixture', null)
                """, RIDER_ID, RIDER_PHONE);

        // Rider without vehicle
        jdbcTemplate.update("""
                insert into riders (id, name, phone_number, team_name, area_name, app_account_linked, memo, deleted_at)
                values (?, '라이더B', ?, '강남팀', '서울 강남', false, 'fixture', null)
                """, RIDER_NO_VEHICLE_ID, RIDER_NO_VEHICLE_PHONE);

        // Rider with non-CALL vehicle
        jdbcTemplate.update("""
                insert into riders (id, name, phone_number, team_name, area_name, app_account_linked, memo, deleted_at)
                values (?, '라이더C', ?, '강남팀', '서울 강남', false, 'fixture', null)
                """, RIDER_NON_CALL_ID, RIDER_NON_CALL_PHONE);

        // CALL bike for RIDER_ID
        jdbcTemplate.update("""
                insert into bikes (id, plate_number, operation_status, engine_type, wheel_type,
                    ignition_blocked, created_at, updated_at)
                values (?, '12가3456', 'IN_SERVICE', 'ELECTRIC', 'TWO_WHEEL', false, now(), now())
                """, BIKE_ID);

        // SINGLE bike for RIDER_NON_CALL_ID
        jdbcTemplate.update("""
                insert into bikes (id, plate_number, operation_status, engine_type, wheel_type,
                    ignition_blocked, created_at, updated_at)
                values (?, '99나9999', 'IN_SERVICE', 'ELECTRIC', 'TWO_WHEEL', false, now(), now())
                """, BIKE_NON_CALL_ID);

        // Active contract: RIDER_ID → BIKE_ID (serviceType=CALL so offeredCalls filter works)
        jdbcTemplate.update("""
                insert into rider_bike_contracts (id, rider_id, bike_id, contract_template_id, start_at, service_type, created_at, updated_at)
                values (?, ?, ?, ?, ?, 'CALL', now(), now())
                """,
                UUID.randomUUID(), RIDER_ID, BIKE_ID, CONTRACT_TEMPLATE_ID,
                Instant.parse("2026-01-01T00:00:00Z"));

        // Active contract: RIDER_NON_CALL_ID → BIKE_NON_CALL_ID (serviceType=SINGLE so offeredCalls returns empty)
        jdbcTemplate.update("""
                insert into rider_bike_contracts (id, rider_id, bike_id, contract_template_id, start_at, service_type, created_at, updated_at)
                values (?, ?, ?, ?, ?, 'SINGLE', now(), now())
                """,
                UUID.randomUUID(), RIDER_NON_CALL_ID, BIKE_NON_CALL_ID, CONTRACT_TEMPLATE_ID,
                Instant.parse("2026-01-01T00:00:00Z"));

        adminToken = loginAdminAndExtractAccessToken();
    }

    // ────────────────────────── /me/dispatch-orders/completed ──────────────────────────

    @Test
    void completedOrders_returns200AndCompletedOrders() throws Exception {
        seedCompletedOrder(BIKE_ID, "고객A", "010-1111-0001", "서울 강남구 테헤란로 1", 37.5000, 127.0000);

        String token = riderToken(RIDER_ID, RIDER_PHONE);

        mockMvc.perform(get("/api/v1/rider/me/dispatch-orders/completed")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].status").value("COMPLETED"));
    }

    @Test
    void completedOrders_noVehicle_returns200AndEmpty() throws Exception {
        String token = riderToken(RIDER_NO_VEHICLE_ID, RIDER_NO_VEHICLE_PHONE);

        mockMvc.perform(get("/api/v1/rider/me/dispatch-orders/completed")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    // ────────────────────────── /me/offered-calls ──────────────────────────────────────

    @Test
    void offeredCalls_callBike_returns200AndOfferedOrders() throws Exception {
        seedOfferedOrder("고객X", "010-2222-0001", "서울 마포구 1", 37.5500, 126.9200);

        String token = riderToken(RIDER_ID, RIDER_PHONE);

        mockMvc.perform(get("/api/v1/rider/me/offered-calls")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].status").value("OFFERED"));
    }

    @Test
    void offeredCalls_nonCallBike_returns200AndEmpty() throws Exception {
        seedOfferedOrder("고객X", "010-2222-0001", "서울 마포구 1", 37.5500, 126.9200);

        String token = riderToken(RIDER_NON_CALL_ID, RIDER_NON_CALL_PHONE);

        mockMvc.perform(get("/api/v1/rider/me/offered-calls")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void offeredCalls_noVehicle_returns200AndEmpty() throws Exception {
        seedOfferedOrder("고객X", "010-2222-0001", "서울 마포구 1", 37.5500, 126.9200);

        String token = riderToken(RIDER_NO_VEHICLE_ID, RIDER_NO_VEHICLE_PHONE);

        mockMvc.perform(get("/api/v1/rider/me/offered-calls")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    // ────────────────────────── /me/tips ───────────────────────────────────────────────

    @Test
    void tips_returnsOnlyPublished() throws Exception {
        seedTip(UUID.randomUUID(), "서울 강남구 테헤란로 1", "팁 내용 1", 37.5, 127.0, "PUBLISHED");
        seedTip(UUID.randomUUID(), "서울 강남구 테헤란로 2", "팁 내용 2", 37.5, 127.1, "PENDING");

        String token = riderToken(RIDER_ID, RIDER_PHONE);

        mockMvc.perform(get("/api/v1/rider/me/tips")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].status").value("PUBLISHED"));
    }

    // ────────────────────────── /me/stations ───────────────────────────────────────────

    @Test
    void stations_returnsOnlyActive() throws Exception {
        seedBatteryStation(UUID.randomUUID(), "강남 충전소", "서울 강남구 1", "ACTIVE");
        seedBatteryStation(UUID.randomUUID(), "마포 충전소", "서울 마포구 1", "INACTIVE");

        String token = riderToken(RIDER_ID, RIDER_PHONE);

        mockMvc.perform(get("/api/v1/rider/me/stations")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].status").value("ACTIVE"));
    }

    // ────────────────────────── /me/maintenance ────────────────────────────────────────

    @Test
    void maintenance_withVehicle_returns200AndItemsAndRecords() throws Exception {
        String token = riderToken(RIDER_ID, RIDER_PHONE);

        mockMvc.perform(get("/api/v1/rider/me/maintenance")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isArray())
                .andExpect(jsonPath("$.records").isArray());
    }

    @Test
    void maintenance_noVehicle_returns200AndEmptyLists() throws Exception {
        String token = riderToken(RIDER_NO_VEHICLE_ID, RIDER_NO_VEHICLE_PHONE);

        mockMvc.perform(get("/api/v1/rider/me/maintenance")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isArray())
                .andExpect(jsonPath("$.items.length()").value(0))
                .andExpect(jsonPath("$.records").isArray())
                .andExpect(jsonPath("$.records.length()").value(0));
    }

    // ────────────────────────── /me/notifications ──────────────────────────────────────

    @Test
    void notifications_returnsRiderScopedOnly() throws Exception {
        UUID otherId = UUID.fromString("11111111-1111-1111-1111-111111111111");
        UUID otherBikeId = UUID.fromString("22222222-2222-2222-2222-222222222222");

        seedNotification(UUID.randomUUID(), "MAINT", "My Rider Notif", RIDER_ID, null, otherId);
        seedNotification(UUID.randomUUID(), "MAINT", "My Bike Notif", null, BIKE_ID, otherId);
        seedNotification(UUID.randomUUID(), "MAINT", "Other Notif", otherId, otherBikeId, otherId);

        String token = riderToken(RIDER_ID, RIDER_PHONE);

        mockMvc.perform(get("/api/v1/rider/me/notifications")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));
    }

    // ────────────────────────── POST /me/offered-calls/{id}/accept ─────────────────────

    @Test
    void acceptCall_assignsOrderToMyBike() throws Exception {
        UUID offeredOrderId = seedOfferedOrder("고객Y", "010-3333-0001", "서울 용산구 1", 37.5400, 126.9800);

        String token = riderToken(RIDER_ID, RIDER_PHONE);

        mockMvc.perform(post("/api/v1/rider/me/offered-calls/{id}/accept", offeredOrderId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ASSIGNED"))
                .andExpect(jsonPath("$.bikeId").value(BIKE_ID.toString()));
    }

    // ────────────────────────── POST /me/dispatch-orders/{id}/complete ─────────────────

    @Test
    void complete_ownershipViolation_returns403() throws Exception {
        // Seed an ASSIGNED order for BIKE_NON_CALL_ID (belongs to another rider)
        UUID othersOrderId = seedAssignedOrder(BIKE_NON_CALL_ID, "고객Z", "010-4444-0001", "서울 종로구 1", 37.5700, 126.9800);

        // RIDER_ID tries to complete an order that belongs to BIKE_NON_CALL_ID
        String token = riderToken(RIDER_ID, RIDER_PHONE);

        mockMvc.perform(multipart("/api/v1/rider/me/dispatch-orders/{id}/complete", othersOrderId)
                        .file(new MockMultipartFile("photo", "photo.jpg", "image/jpeg", "fake-image".getBytes()))
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    void complete_ownOrder_returnsCompleted() throws Exception {
        UUID myOrderId = seedAssignedOrder(BIKE_ID, "고객W", "010-5555-0001", "서울 서초구 1", 37.4900, 127.0100);

        String token = riderToken(RIDER_ID, RIDER_PHONE);

        mockMvc.perform(multipart("/api/v1/rider/me/dispatch-orders/{id}/complete", myOrderId)
                        .file(new MockMultipartFile("photo", "photo.jpg", "image/jpeg", "fake-image-bytes".getBytes()))
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("COMPLETED"));
    }

    // ────────────────────────── helpers ────────────────────────────────────────────────

    private UUID seedAssignedOrder(UUID bikeId, String customerName, String customerPhone,
            String address, double lat, double lng) {
        UUID id = UUID.randomUUID();
        jdbcTemplate.update("""
                insert into dispatch_orders
                    (id, bike_id, customer_name, customer_phone, address,
                     latitude, longitude, sequence, status, kind, created_at, updated_at)
                values (?, ?, ?, ?, ?, ?, ?, ?, 'ASSIGNED', 'DELIVERY', now(), now())
                """,
                id, bikeId, customerName, customerPhone, address, lat, lng, 1L);
        return id;
    }

    private void seedCompletedOrder(UUID bikeId, String customerName, String customerPhone,
            String address, double lat, double lng) {
        jdbcTemplate.update("""
                insert into dispatch_orders
                    (id, bike_id, customer_name, customer_phone, address,
                     latitude, longitude, sequence, status, kind, completed_at, completed_by,
                     created_at, updated_at)
                values (?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', 'DELIVERY', now(), ?, now(), now())
                """,
                UUID.randomUUID(), bikeId, customerName, customerPhone, address, lat, lng, 1L, bikeId);
    }

    private UUID seedOfferedOrder(String customerName, String customerPhone, String address,
            double lat, double lng) {
        UUID id = UUID.randomUUID();
        jdbcTemplate.update("""
                insert into dispatch_orders
                    (id, bike_id, customer_name, customer_phone, address,
                     latitude, longitude, sequence, status, kind, created_at, updated_at)
                values (?, null, ?, ?, ?, ?, ?, 0, 'OFFERED', 'DELIVERY', now(), now())
                """,
                id, customerName, customerPhone, address, lat, lng);
        return id;
    }

    private void seedTip(UUID id, String address, String content, double lat, double lng, String status) {
        jdbcTemplate.update("""
                insert into tips (id, address, content, latitude, longitude, status, created_at, updated_at)
                values (?, ?, ?, ?, ?, ?, now(), now())
                """,
                id, address, content, lat, lng, status);
    }

    private void seedBatteryStation(UUID id, String name, String address, String status) {
        jdbcTemplate.update("""
                insert into battery_stations
                    (id, name, address, latitude, longitude, status,
                     max_battery_capacity, current_battery_count, available_battery_count,
                     created_at, updated_at)
                values (?, ?, ?, 37.5000, 127.0000, ?, 10, 5, 5, now(), now())
                """,
                id, name, address, status);
    }

    private void seedNotification(UUID id, String type, String title,
            UUID refRiderId, UUID refBikeId, UUID refEntityId) {
        jdbcTemplate.update("""
                insert into notifications
                    (id, type, title, body, ref_rider_id, ref_bike_id, ref_entity_id,
                     occurred_at, created_at, updated_at)
                values (?, ?, ?, null, ?, ?, ?, now(), now(), now())
                """,
                id, type, title, refRiderId, refBikeId, refEntityId);
    }

    private String riderToken(UUID riderId, String phone) throws Exception {
        issueRiderCredential(riderId);
        MvcResult result = riderLogin(phone, nameById(riderId))
                .andExpect(status().isOk())
                .andReturn();
        return extract(ACCESS_TOKEN_PATTERN, result);
    }

    private String nameById(UUID riderId) {
        if (RIDER_ID.equals(riderId)) {
            return "라이더A";
        }
        if (RIDER_NO_VEHICLE_ID.equals(riderId)) {
            return "라이더B";
        }
        if (RIDER_NON_CALL_ID.equals(riderId)) {
            return "라이더C";
        }
        throw new IllegalArgumentException("Unknown riderId: " + riderId);
    }

    private void issueRiderCredential(UUID riderId) throws Exception {
        mockMvc.perform(patch("/api/v1/riders/{id}/credential", riderId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"newPassword\":\"%s\"}".formatted(RIDER_PASSWORD)))
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
                        .content("{\"loginId\":\"ops-admin-dr\",\"password\":\"correct-password\"}"))
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
