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
class DashboardMapApiContractTests extends PostgresContainerSupport {

    private static final UUID ADMIN_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final UUID RIDER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID ONLINE_BIKE_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private static final UUID STALE_BIKE_ID = UUID.fromString("33333333-3333-3333-3333-333333333333");
    private static final UUID NO_STATE_BIKE_ID = UUID.fromString("44444444-4444-4444-4444-444444444444");
    private static final UUID DEVICE_ID = UUID.fromString("55555555-5555-5555-5555-555555555555");
    private static final UUID STALE_DEVICE_ID = UUID.fromString("66666666-6666-6666-6666-666666666666");
    private static final UUID CONTRACT_ID = UUID.fromString("77777777-7777-7777-7777-777777777777");
    private static final UUID STATION_ID = UUID.fromString("88888888-8888-8888-8888-888888888888");
    private static final UUID MAINTENANCE_STATION_ID = UUID.fromString("99999999-9999-9999-9999-999999999999");
    private static final UUID CONTRACT_TEMPLATE_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");
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
                "bike_recent_states",
                "bike_current_states",
                "rider_bike_contracts",
                "battery_stations",
                "riders",
                "bikes",
                "admin_users"
        ).forEach(table -> jdbcTemplate.update("delete from " + table));

        jdbcTemplate.update("""
                insert into admin_users (id, login_id, email, password_hash, display_name, enabled)
                values (?, 'ops-admin', 'ops@example.test', ?, 'Ops Admin', true)
                """, ADMIN_ID, passwordEncoder.encode("correct-password"));
        accessToken = loginAndExtractToken();
    }

    @Test
    void mapStateReturnsControlSummaryBikePinsAndStationPins() throws Exception {
        Instant now = Instant.now();
        seedRider(RIDER_ID, "김지도", "010-1111-2222");
        seedBike(ONLINE_BIKE_ID, "서울T-2001", "VIN-DASH-001", "IN_SERVICE");
        seedBikeWithWheelType(STALE_BIKE_ID, "서울T-2002", "VIN-DASH-002", "READY", "FOUR_WHEEL");
        seedBike(NO_STATE_BIKE_ID, "서울T-2003", "VIN-DASH-003", "IN_SERVICE");
        seedActiveContract(CONTRACT_ID, RIDER_ID, ONLINE_BIKE_ID, now.minusSeconds(3600));
        insertCurrentState(ONLINE_BIKE_ID, DEVICE_ID, now.minusSeconds(60), "ON", "12.30", "44.00");
        insertCurrentState(STALE_BIKE_ID, STALE_DEVICE_ID, now.minusSeconds(11 * 60), "ON", "0.00", "12.00");
        insertCurrentStateWithoutCoordinates(NO_STATE_BIKE_ID, UUID.fromString("12345678-1234-1234-1234-123456789abc"), now.minusSeconds(120), "OFF", "0.00", "88.00");
        seedStation(STATION_ID, "강남 스테이션", "서울 강남구 테헤란로 1", "ACTIVE", 12, 7, 5);
        seedStation(MAINTENANCE_STATION_ID, "마포 스테이션", "서울 마포구 월드컵북로 1", "MAINTENANCE", 8, 5, 2);

        mockMvc.perform(get("/api/v1/dashboard/map-state")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.generatedAt").isString())
                .andExpect(jsonPath("$.summary.totalBikes").value(3))
                .andExpect(jsonPath("$.summary.bikePinCount").value(2))
                // 시동 ON 이면 연결 임계가 2분이다(2026-07-01 이중 임계값). 11분 전
                // 수신 + 시동 ON 인 STALE_BIKE 는 OFFLINE 이 맞다 — 전에는 120분
                // 단일 임계라 ONLINE 으로 셌다.
                .andExpect(jsonPath("$.summary.onlineBikeCount").value(2))
                .andExpect(jsonPath("$.summary.signalLostBikeCount").value(0))
                .andExpect(jsonPath("$.summary.parkedOfflineBikeCount").value(0))
                .andExpect(jsonPath("$.summary.lowBatteryBikeCount").value(2))
                .andExpect(jsonPath("$.summary.activeStationCount").value(1))
                .andExpect(jsonPath("$.summary.stationPinCount").value(2))
                .andExpect(jsonPath("$.summary.availableBatteryCount").value(7))
                .andExpect(jsonPath("$.bikePins[0].bikeId").value(ONLINE_BIKE_ID.toString()))
                .andExpect(jsonPath("$.bikePins[0].plateNumber").value("서울T-2001"))
                .andExpect(jsonPath("$.bikePins[0].activeRiderLabel").value("김지도"))
                .andExpect(jsonPath("$.bikePins[0].activeRiderId").doesNotExist())
                .andExpect(jsonPath("$.bikePins[0].activeRiderPhoneNumber").doesNotExist())
                .andExpect(jsonPath("$.bikePins[0].pinLabel").value("서울T-2001 · 김지도"))
                .andExpect(jsonPath("$.bikePins[0].drivingStatus").value("DRIVING"))
                .andExpect(jsonPath("$.bikePins[0].connectionStatus").value("ONLINE"))
                .andExpect(jsonPath("$.bikePins[0].batteryStatus").value("LOW"))
                .andExpect(jsonPath("$.bikePins[1].connectionStatus").value("ONLINE"))
                .andExpect(jsonPath("$.bikePins[1].batteryStatus").value("CRITICAL"))
                .andExpect(jsonPath("$.bikePins[0].wheelType").value("TWO_WHEEL"))
                .andExpect(jsonPath("$.bikePins[1].wheelType").value("FOUR_WHEEL"))
                .andExpect(jsonPath("$.stationPins[0].stationId").value(STATION_ID.toString()))
                .andExpect(jsonPath("$.stationPins[0].pinLabel").value("강남 스테이션 5/12"))
                .andExpect(jsonPath("$.stationPins[0].availableBatteryLabel").value("5/12"))
                .andExpect(jsonPath("$.stationPins[0].availableBatteryPercentage").value(42));
    }

    @Test
    void mapStateUsesTerminatedAtAsEffectiveRiderContractEnd() throws Exception {
        Instant now = Instant.now();
        UUID futureTerminatedRiderId = UUID.fromString("aaaaaaaa-1111-1111-1111-111111111111");
        UUID pastTerminatedRiderId = UUID.fromString("aaaaaaaa-2222-2222-2222-222222222222");
        UUID futureTerminatedBikeId = UUID.fromString("bbbbbbbb-1111-1111-1111-111111111111");
        UUID pastTerminatedBikeId = UUID.fromString("bbbbbbbb-2222-2222-2222-222222222222");
        UUID futureTerminatedDeviceId = UUID.fromString("cccccccc-1111-1111-1111-111111111111");
        UUID pastTerminatedDeviceId = UUID.fromString("cccccccc-2222-2222-2222-222222222222");

        seedRider(futureTerminatedRiderId, "미래종료 라이더", "010-3333-4444");
        seedRider(pastTerminatedRiderId, "과거종료 라이더", "010-5555-6666");
        seedBike(futureTerminatedBikeId, "서울T-2101", "VIN-DASH-101", "IN_SERVICE");
        seedBike(pastTerminatedBikeId, "서울T-2102", "VIN-DASH-102", "IN_SERVICE");
        seedContractWithTermination(
                UUID.fromString("dddddddd-1111-1111-1111-111111111111"),
                futureTerminatedRiderId,
                futureTerminatedBikeId,
                now.minusSeconds(3600),
                now.plusSeconds(3600)
        );
        seedContractWithTermination(
                UUID.fromString("dddddddd-2222-2222-2222-222222222222"),
                pastTerminatedRiderId,
                pastTerminatedBikeId,
                now.minusSeconds(7200),
                now.minusSeconds(3600)
        );
        insertCurrentState(futureTerminatedBikeId, futureTerminatedDeviceId, now.minusSeconds(30), "ON", "8.00", "80.00");
        insertCurrentState(pastTerminatedBikeId, pastTerminatedDeviceId, now.minusSeconds(60), "ON", "8.00", "80.00");

        mockMvc.perform(get("/api/v1/dashboard/map-state")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bikePins[0].bikeId").value(futureTerminatedBikeId.toString()))
                .andExpect(jsonPath("$.bikePins[0].activeRiderLabel").value("미래종료 라이더"))
                .andExpect(jsonPath("$.bikePins[0].pinLabel").value("서울T-2101 · 미래종료 라이더"))
                .andExpect(jsonPath("$.bikePins[1].bikeId").value(pastTerminatedBikeId.toString()))
                .andExpect(jsonPath("$.bikePins[1].activeRiderLabel").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.bikePins[1].pinLabel").value("서울T-2102"));
    }

    @Test
    void dashboardMapStateRequiresAuthentication() throws Exception {
        mockMvc.perform(get("/api/v1/dashboard/map-state"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_FAILED"));
    }

    @Test
    void mapStateIncludesRecentTrackSortedAscendingForBike() throws Exception {
        Instant now = Instant.now();
        seedBike(ONLINE_BIKE_ID, "서울T-3001", "VIN-TRACK-001", "IN_SERVICE");
        insertCurrentState(ONLINE_BIKE_ID, DEVICE_ID, now.minusSeconds(30), "ON", "10.00", "44.00");
        // 시간 역순으로 삽입 — 응답은 received_at 오름차순으로 정렬돼야 한다.
        insertRecentState(ONLINE_BIKE_ID, now.minusSeconds(30), "37.50", "127.30");
        insertRecentState(ONLINE_BIKE_ID, now.minusSeconds(50), "37.50", "127.10");
        insertRecentState(ONLINE_BIKE_ID, now.minusSeconds(40), "37.50", "127.20");
        // 윈도(120초) 밖 점은 제외돼야 한다.
        insertRecentState(ONLINE_BIKE_ID, now.minusSeconds(300), "37.50", "127.90");

        mockMvc.perform(get("/api/v1/dashboard/map-state")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bikePins[0].bikeId").value(ONLINE_BIKE_ID.toString()))
                .andExpect(jsonPath("$.bikePins[0].recentTrack.length()").value(3))
                .andExpect(jsonPath("$.bikePins[0].recentTrack[0].longitude").value(127.1))
                .andExpect(jsonPath("$.bikePins[0].recentTrack[2].longitude").value(127.3))
                .andExpect(jsonPath("$.bikePins[0].recentTrack[0].t").isNumber());
    }

    private void seedRider(UUID id, String name, String phoneNumber) {
        jdbcTemplate.update("""
                insert into riders (id, name, phone_number, app_account_linked)
                values (?, ?, ?, false)
                """, id, name, phoneNumber);
    }

    private void seedBike(UUID id, String plateNumber, String vin, String operationStatus) {
        jdbcTemplate.update("""
                insert into bikes (id, plate_number, vin, model_name, operation_status)
                values (?, ?, ?, 'Thunder M1', ?)
                """, id, plateNumber, vin, operationStatus);
    }

    private void seedBikeWithWheelType(UUID id, String plateNumber, String vin, String operationStatus, String wheelType) {
        jdbcTemplate.update("""
                insert into bikes (id, plate_number, vin, model_name, operation_status, wheel_type)
                values (?, ?, ?, 'Thunder M1', ?, ?)
                """, id, plateNumber, vin, operationStatus, wheelType);
    }

    private void seedActiveContract(UUID id, UUID riderId, UUID bikeId, Instant startAt) {
        jdbcTemplate.update("""
                insert into rider_bike_contracts (id, rider_id, bike_id, contract_template_id, start_at, memo)
                values (?, ?, ?, ?, ?::timestamptz, 'dashboard fixture')
                """, id, riderId, bikeId, CONTRACT_TEMPLATE_ID, startAt.toString());
    }

    private void seedContractWithTermination(UUID id, UUID riderId, UUID bikeId, Instant startAt, Instant terminatedAt) {
        jdbcTemplate.update("""
                insert into rider_bike_contracts (
                    id, rider_id, bike_id, contract_template_id, start_at, terminated_at, memo
                ) values (?, ?, ?, ?, ?::timestamptz, ?::timestamptz, 'dashboard termination fixture')
                """, id, riderId, bikeId, CONTRACT_TEMPLATE_ID, startAt.toString(), terminatedAt.toString());
    }

    private void insertCurrentState(
            UUID bikeId,
            UUID deviceId,
            Instant receivedAt,
            String ignitionStatus,
            String speedKph,
            String batteryPercent
    ) {
        jdbcTemplate.update("""
                insert into bike_current_states (
                    bike_id, device_id, telemetry_log_id, last_received_at,
                    latitude, longitude, speed_kph, battery_percent, ignition_status, telemetry_source
                ) values (?, ?, ?, ?::timestamptz, 37.5010000, 127.0396000, ?::numeric, ?::numeric, ?, 'POLLING')
                """, bikeId, deviceId, UUID.randomUUID(), receivedAt.toString(), speedKph, batteryPercent, ignitionStatus);
    }

    private void insertCurrentStateWithoutCoordinates(
            UUID bikeId,
            UUID deviceId,
            Instant receivedAt,
            String ignitionStatus,
            String speedKph,
            String batteryPercent
    ) {
        jdbcTemplate.update("""
                insert into bike_current_states (
                    bike_id, device_id, telemetry_log_id, last_received_at,
                    speed_kph, battery_percent, ignition_status, telemetry_source
                ) values (?, ?, ?, ?::timestamptz, ?::numeric, ?::numeric, ?, 'POLLING')
                """, bikeId, deviceId, UUID.randomUUID(), receivedAt.toString(), speedKph, batteryPercent, ignitionStatus);
    }

    private void insertRecentState(UUID bikeId, Instant receivedAt, String lat, String lng) {
        jdbcTemplate.update("""
                insert into bike_recent_states
                    (id, bike_id, received_at, latitude, longitude, ignition_status, telemetry_source)
                values (?, ?, ?::timestamptz, ?, ?, 'ON', 'WEBHOOK')
                """,
                UUID.randomUUID(), bikeId, receivedAt.toString(),
                new java.math.BigDecimal(lat), new java.math.BigDecimal(lng));
    }

    private void seedStation(
            UUID id,
            String name,
            String address,
            String status,
            int maxBatteryCapacity,
            int currentBatteryCount,
            int availableBatteryCount
    ) {
        jdbcTemplate.update("""
                insert into battery_stations (
                    id, name, address, latitude, longitude, status,
                    max_battery_capacity, current_battery_count, available_battery_count
                ) values (?, ?, ?, 37.5010000, 127.0396000, ?, ?, ?, ?)
                """, id, name, address, status, maxBatteryCapacity, currentBatteryCount, availableBatteryCount);
    }

    private String loginAndExtractToken() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"loginId":"ops-admin","password":"correct-password"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isString())
                .andReturn();

        Matcher matcher = ACCESS_TOKEN_PATTERN.matcher(result.getResponse().getContentAsString());
        assertThat(matcher.find()).isTrue();
        return matcher.group(1);
    }
}
