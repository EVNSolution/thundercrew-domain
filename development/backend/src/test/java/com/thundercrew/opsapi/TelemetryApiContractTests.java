package com.thundercrew.opsapi;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class TelemetryApiContractTests extends PostgresContainerSupport {

    private static final UUID ADMIN_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final UUID BIKE_ID = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private static final UUID DEVICE_ID = UUID.fromString("cccccccc-cccc-cccc-cccc-cccccccccccc");
    private static final UUID INSTALLATION_ID = UUID.fromString("dddddddd-dddd-dddd-dddd-dddddddddddd");
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
                "telemetry_ingestion_error_logs",
                "bike_current_states",
                "bike_recent_states",
                "device_telemetry_logs",
                "bike_device_installations",
                "devices",
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
    void ingestTelemetryCreatesRawRecentAndCurrentStateForActiveDeviceInstallation() throws Exception {
        Instant receivedAt = Instant.now().minusSeconds(60);
        seedBike(BIKE_ID, "서울T-1001", "VIN-TELEMETRY-001");
        seedDevice(DEVICE_ID, "DEV-TEL-001", true);
        seedInstallation(INSTALLATION_ID, BIKE_ID, DEVICE_ID, receivedAt.minusSeconds(3600), null);

        mockMvc.perform(postTelemetry("DEV-TEL-001", "evt-001", receivedAt, "12.30", 1))
                .andExpect(status().isCreated())
                .andExpect(header().string(HttpHeaders.LOCATION, org.hamcrest.Matchers.startsWith("/api/v1/telemetry/device-events/")))
                .andExpect(jsonPath("$.telemetryLogId").isString())
                .andExpect(jsonPath("$.deviceId").value(DEVICE_ID.toString()))
                .andExpect(jsonPath("$.deviceUid").value("DEV-TEL-001"))
                .andExpect(jsonPath("$.bikeId").value(BIKE_ID.toString()))
                .andExpect(jsonPath("$.duplicate").value(false))
                .andExpect(jsonPath("$.recentStateCreated").value(true))
                .andExpect(jsonPath("$.currentStateUpdated").value(true))
                .andExpect(jsonPath("$.ingestionStatus").value("ACCEPTED"));

        assertThat(countRows("device_telemetry_logs")).isEqualTo(1);
        assertThat(countRows("bike_recent_states")).isEqualTo(1);
        assertThat(countRows("bike_current_states")).isEqualTo(1);
        assertThat(countRows("telemetry_ingestion_error_logs")).isZero();

        mockMvc.perform(get("/api/v1/telemetry/bikes/{bikeId}/current-state", BIKE_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bikeId").value(BIKE_ID.toString()))
                .andExpect(jsonPath("$.deviceId").value(DEVICE_ID.toString()))
                .andExpect(jsonPath("$.latitude").value(37.501))
                .andExpect(jsonPath("$.longitude").value(127.0396))
                // 시동은 명시 accStatus 로만 정해진다 (payload 가 accStatus=1 을 실었다).
                .andExpect(jsonPath("$.ignitionStatus").value("ON"))
                .andExpect(jsonPath("$.drivingStatus").value("DRIVING"))
                .andExpect(jsonPath("$.connectionStatus").value("ONLINE"))
                .andExpect(jsonPath("$.batteryStatus").value("NORMAL"));

        mockMvc.perform(get("/api/v1/telemetry/bike-current-states")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .param("size", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].bikeId").value(BIKE_ID.toString()))
                .andExpect(jsonPath("$.page.size").value(5))
                .andExpect(jsonPath("$.page.totalItems").value(1));
    }

    @Test
    void duplicateVendorEventIsIdempotentAndDoesNotCreateSecondStateRow() throws Exception {
        Instant receivedAt = Instant.now().minusSeconds(60);
        seedBike(BIKE_ID, "서울T-1002", "VIN-TELEMETRY-002");
        seedDevice(DEVICE_ID, "DEV-TEL-002", true);
        seedInstallation(INSTALLATION_ID, BIKE_ID, DEVICE_ID, receivedAt.minusSeconds(3600), null);

        mockMvc.perform(postTelemetry("DEV-TEL-002", "evt-dup", receivedAt, "6.00"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.duplicate").value(false))
                .andExpect(jsonPath("$.ingestionStatus").value("ACCEPTED"));

        mockMvc.perform(postTelemetry("DEV-TEL-002", "evt-dup", receivedAt, "6.00"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.duplicate").value(true))
                .andExpect(jsonPath("$.recentStateCreated").value(false))
                .andExpect(jsonPath("$.currentStateUpdated").value(false))
                .andExpect(jsonPath("$.ingestionStatus").value("IDEMPOTENT_REPLAY"));

        assertThat(countRows("device_telemetry_logs")).isEqualTo(1);
        assertThat(countRows("bike_recent_states")).isEqualTo(1);
        assertThat(countRows("bike_current_states")).isEqualTo(1);
    }

    @Test
    void outOfOrderTelemetryKeepsRecentHistoryButDoesNotRegressCurrentState() throws Exception {
        Instant newerAt = Instant.now().minusSeconds(30);
        Instant olderAt = newerAt.minusSeconds(300);
        seedBike(BIKE_ID, "서울T-1003", "VIN-TELEMETRY-003");
        seedDevice(DEVICE_ID, "DEV-TEL-003", true);
        seedInstallation(INSTALLATION_ID, BIKE_ID, DEVICE_ID, olderAt.minusSeconds(3600), null);

        mockMvc.perform(postTelemetry("DEV-TEL-003", "evt-newer", newerAt, "18.00", 1))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.currentStateUpdated").value(true))
                .andExpect(jsonPath("$.ingestionStatus").value("ACCEPTED"));

        mockMvc.perform(postTelemetry("DEV-TEL-003", "evt-older", olderAt, "0.00"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.recentStateCreated").value(true))
                .andExpect(jsonPath("$.currentStateUpdated").value(false))
                .andExpect(jsonPath("$.ingestionStatus").value("STALE_TELEMETRY_IGNORED"));

        assertThat(countRows("device_telemetry_logs")).isEqualTo(2);
        assertThat(countRows("bike_recent_states")).isEqualTo(2);
        assertThat(countRows("bike_current_states")).isEqualTo(1);

        mockMvc.perform(get("/api/v1/telemetry/bikes/{bikeId}/current-state", BIKE_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.speedKph").value(18.0))
                // 시동은 명시 accStatus 로만 정해진다 (payload 가 accStatus=1 을 실었다).
                .andExpect(jsonPath("$.ignitionStatus").value("ON"))
                .andExpect(jsonPath("$.drivingStatus").value("DRIVING"));
    }

    @Test
    void unknownOrUnassignedDeviceStillStoresRawLogAndErrorButNoBikeState() throws Exception {
        Instant receivedAt = Instant.now().minusSeconds(60);

        mockMvc.perform(postTelemetry("DEV-UNKNOWN", "evt-unknown", receivedAt, "0.00"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.deviceId").doesNotExist())
                .andExpect(jsonPath("$.bikeId").doesNotExist())
                .andExpect(jsonPath("$.recentStateCreated").value(false))
                .andExpect(jsonPath("$.currentStateUpdated").value(false))
                .andExpect(jsonPath("$.ingestionStatus").value("DEVICE_UNRESOLVED"));

        assertThat(countRows("device_telemetry_logs")).isEqualTo(1);
        assertThat(countRows("telemetry_ingestion_error_logs")).isEqualTo(1);
        assertThat(countRows("bike_recent_states")).isZero();
        assertThat(countRows("bike_current_states")).isZero();

        seedDevice(DEVICE_ID, "DEV-NO-INSTALL", true);
        mockMvc.perform(postTelemetry("DEV-NO-INSTALL", "evt-no-install", receivedAt.plusSeconds(1), "0.00"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.deviceId").value(DEVICE_ID.toString()))
                .andExpect(jsonPath("$.bikeId").doesNotExist())
                .andExpect(jsonPath("$.ingestionStatus").value("BIKE_UNRESOLVED"));

        assertThat(countRows("device_telemetry_logs")).isEqualTo(2);
        assertThat(countRows("telemetry_ingestion_error_logs")).isEqualTo(2);
        assertThat(countRows("bike_current_states")).isZero();
    }

    @Test
    void ingestResolvesBikeByImeiWhenNoDeviceIsRegistered() throws Exception {
        // OTOPLUG vehicles are imported with bikes.imei set but no devices/installation row.
        // The receiver sends deviceUid = imei, so ingest must map telemetry to the bike via imei.
        Instant receivedAt = Instant.now().minusSeconds(60);
        String imei = "867953065266555";
        seedBikeWithImei(BIKE_ID, "서울T-1004", "VIN-TELEMETRY-004", imei);

        mockMvc.perform(postTelemetry(imei, "evt-imei", receivedAt, "9.00"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.deviceId").doesNotExist())
                .andExpect(jsonPath("$.deviceUid").value(imei))
                .andExpect(jsonPath("$.bikeId").value(BIKE_ID.toString()))
                .andExpect(jsonPath("$.recentStateCreated").value(true))
                .andExpect(jsonPath("$.currentStateUpdated").value(true))
                .andExpect(jsonPath("$.ingestionStatus").value("ACCEPTED"));

        assertThat(countRows("device_telemetry_logs")).isEqualTo(1);
        assertThat(countRows("bike_recent_states")).isEqualTo(1);
        assertThat(countRows("bike_current_states")).isEqualTo(1);
        assertThat(countRows("telemetry_ingestion_error_logs")).isZero();

        mockMvc.perform(get("/api/v1/telemetry/bikes/{bikeId}/current-state", BIKE_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bikeId").value(BIKE_ID.toString()))
                .andExpect(jsonPath("$.connectionStatus").value("ONLINE"));
    }

    @Test
    void staleConnectionStatusIsOfflineAfter120Minutes() throws Exception {
        // Within 120 min → ONLINE; beyond 120 min → OFFLINE regardless of ignition
        Instant recentReceivedAt = Instant.now().minusSeconds(60);
        Instant staleReceivedAt = Instant.now().minusSeconds(121 * 60);
        UUID staleBikeId = UUID.fromString("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee");

        insertCurrentState(BIKE_ID, DEVICE_ID, recentReceivedAt, "ON");
        insertCurrentState(staleBikeId, UUID.fromString("ffffffff-ffff-ffff-ffff-ffffffffffff"), staleReceivedAt, "OFF");

        mockMvc.perform(get("/api/v1/telemetry/bikes/{bikeId}/current-state", BIKE_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.connectionStatus").value("ONLINE"));

        mockMvc.perform(get("/api/v1/telemetry/bikes/{bikeId}/current-state", staleBikeId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.connectionStatus").value("OFFLINE"));
    }

    /**
     * 조회 엔드포인트는 인증을 요구하고, **수집(POST)은 의도적으로 공개**다.
     *
     * 공개 콜백은 Next.js 가 채널토큰으로 검증하고 localhost 로만 이 엔드포인트를
     * 부르는 구조라 SecurityConfig 가 POST 만 permitAll 로 둔다
     * (docs/superpowers/plans/2026-06-23-otoplug-device-integration.md).
     * 전에는 이 테스트가 POST 에도 401 을 기대했는데, 그건 permitAll 이전의 계약이다.
     *
     * "localhost 로만" 전제는 nginx 가 지켜야 한다. 프리뷰 server block 이 `/api/` 를
     * 프록시해서 그 전제를 깼던 적이 있다 (PR #555 에서 프록시 제거).
     */
    @Test
    void telemetryReadEndpointsRequireAuthenticationButIngestIsPublic() throws Exception {
        Instant receivedAt = Instant.now().minusSeconds(60);

        // 인증 헤더 없이도 통과한다. 등록되지 않은 deviceUid 라 차량에는 연결되지 않는다.
        mockMvc.perform(post("/api/v1/telemetry/device-events")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(telemetryJson("DEV-AUTH", "evt-auth", receivedAt, "1.00")))
                .andExpect(status().isCreated());
        mockMvc.perform(get("/api/v1/telemetry/bike-current-states"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/telemetry/bikes/{bikeId}/current-state", BIKE_ID))
                .andExpect(status().isUnauthorized());
    }

    /**
     * 시동은 명시 accStatus 로 정해지고, accStatus 가 없으면 **직전 상태를 이어받는다**.
     *
     * 전에는 수신 간격으로 파생했고(2026-06-12, 컷오프 5분) 이 테스트도 그걸 검증했다.
     * 2026-07-01 에 OTOPLUG accStatus 명시 신호로 전환되면서 간격 기반 파생은 사라졌다
     * (docs/superpowers/plans/2026-07-01-ignition-accstatus-connection.md).
     * 그래서 이름과 내용을 현재 계약으로 바꿨다 — 간격을 벌려도 시동이 저절로 OFF 가
     * 되지 않는다는 것이 지금의 동작이고, 그게 이 테스트가 지켜야 할 계약이다.
     */
    @Test
    void ignitionFollowsAccStatusAndCarriesForwardWhenAbsent() throws Exception {
        UUID deriveBikeId = UUID.fromString("11111111-1111-1111-1111-111111111111");
        UUID deriveDeviceId = UUID.fromString("22222222-2222-2222-2222-222222222222");
        UUID deriveInstallId = UUID.fromString("33333333-3333-3333-3333-333333333333");
        Instant base = Instant.now().minusSeconds(30 * 60);

        seedBike(deriveBikeId, "서울T-9001", "VIN-DERIVE-001");
        seedDevice(deriveDeviceId, "DEV-DERIVE-001", true);
        seedInstallation(deriveInstallId, deriveBikeId, deriveDeviceId, base.minusSeconds(3600), null);

        // (a) 첫 이벤트에 accStatus=1 → ON
        mockMvc.perform(postTelemetry("DEV-DERIVE-001", "evt-derive-1", base, "5.00", 1))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.ingestionStatus").value("ACCEPTED"));

        mockMvc.perform(get("/api/v1/telemetry/bikes/{bikeId}/current-state", deriveBikeId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ignitionStatus").value("ON"));

        // (b) accStatus 를 싣지 않은 이벤트 → 직전 상태(ON) 를 이어받는다
        Instant within5min = base.plusSeconds(3 * 60);
        mockMvc.perform(postTelemetry("DEV-DERIVE-001", "evt-derive-2", within5min, "10.00"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.ingestionStatus").value("ACCEPTED"));

        mockMvc.perform(get("/api/v1/telemetry/bikes/{bikeId}/current-state", deriveBikeId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ignitionStatus").value("ON"));

        // (c) 간격이 벌어져도 저절로 OFF 가 되지 않는다. accStatus=0 을 실어야 OFF 다.
        Instant beyond5min = within5min.plusSeconds(10 * 60);
        mockMvc.perform(postTelemetry("DEV-DERIVE-001", "evt-derive-3", beyond5min, "0.00", 0))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.ingestionStatus").value("ACCEPTED"));

        mockMvc.perform(get("/api/v1/telemetry/bikes/{bikeId}/current-state", deriveBikeId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ignitionStatus").value("OFF"));
    }

    private MockHttpServletRequestBuilder postTelemetry(
            String deviceUid,
            String vendorEventId,
            Instant receivedAt,
            String speedKph
    ) {
        return postTelemetry(deviceUid, vendorEventId, receivedAt, speedKph, null);
    }

    private MockHttpServletRequestBuilder postTelemetry(
            String deviceUid,
            String vendorEventId,
            Instant receivedAt,
            String speedKph,
            Integer accStatus
    ) {
        return post("/api/v1/telemetry/device-events")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(telemetryJson(deviceUid, vendorEventId, receivedAt, speedKph, accStatus));
    }

    /** accStatus 없는 payload. 시동은 직전 상태 carry-forward, 없으면 UNKNOWN 이 된다. */
    private String telemetryJson(
            String deviceUid,
            String vendorEventId,
            Instant receivedAt,
            String speedKph
    ) {
        return telemetryJson(deviceUid, vendorEventId, receivedAt, speedKph, null);
    }

    /**
     * accStatus 를 실은 payload.
     *
     * 시동은 **명시 ACC 신호로만** 정해진다 (0=OFF, 그 외=ON). 예전에는 수신 간격으로
     * 파생했지만 2026-07-01 에 OTOPLUG accStatus 로 전환됐다
     * (docs/superpowers/plans/2026-07-01-ignition-accstatus-connection.md).
     * 그래서 ON/OFF 를 기대하는 테스트는 accStatus 를 반드시 실어야 한다.
     */
    private String telemetryJson(
            String deviceUid,
            String vendorEventId,
            Instant receivedAt,
            String speedKph,
            Integer accStatus
    ) {
        // 개행을 넣지 않는다. JSON 은 공백을 신경 쓰지 않으므로 한 줄에 이어 붙이면
        // 플랫폼별 줄바꿈 문자를 다룰 필요가 없다.
        String accLine = accStatus == null ? "" : "\"accStatus\":" + accStatus + ",";
        return """
                {
                  "deviceUid":"%s",
                  "vendorEventId":"%s",
                  "receivedAt":"%s",
                  "deviceReportedAt":"%s",
                  "latitude":37.5010000,
                  "longitude":127.0396000,
                  "speedKph":%s,
                %s  "telemetrySource":"POLLING",
                  "rawPayload":{"vendor":"test-device","seq":"%s"}
                }
                """.formatted(deviceUid, vendorEventId, receivedAt, receivedAt.minusSeconds(2),
                        speedKph, accLine, vendorEventId);
    }

    private void seedBike(UUID id, String plateNumber, String vin) {
        jdbcTemplate.update("""
                insert into bikes (id, plate_number, vin, model_name, operation_status)
                values (?, ?, ?, 'Thunder M1', 'IN_SERVICE')
                """, id, plateNumber, vin);
    }

    private void seedBikeWithImei(UUID id, String plateNumber, String vin, String imei) {
        jdbcTemplate.update("""
                insert into bikes (id, plate_number, vin, model_name, operation_status, imei)
                values (?, ?, ?, 'Thunder M1', 'IN_SERVICE', ?)
                """, id, plateNumber, vin, imei);
    }

    private void seedDevice(UUID id, String deviceUid, boolean enabled) {
        jdbcTemplate.update("""
                insert into devices (id, device_uid, manufacturer, model_name, enabled)
                values (?, ?, 'ThunderDevice', 'TD-100', ?)
                """, id, deviceUid, enabled);
    }

    private void seedInstallation(UUID id, UUID bikeId, UUID deviceId, Instant installedAt, Instant removedAt) {
        jdbcTemplate.update("""
                insert into bike_device_installations (id, bike_id, device_id, installed_at, removed_at)
                values (?, ?, ?, ?::timestamptz, ?::timestamptz)
                """, id, bikeId, deviceId, installedAt.toString(), removedAt == null ? null : removedAt.toString());
    }

    private void insertCurrentState(UUID bikeId, UUID deviceId, Instant receivedAt, String ignitionStatus) {
        jdbcTemplate.update("""
                insert into bike_current_states (
                    bike_id, device_id, telemetry_log_id, last_received_at,
                    latitude, longitude, speed_kph, battery_percent, ignition_status, telemetry_source
                ) values (?, ?, ?, ?::timestamptz, 37.5010000, 127.0396000, 0.00, 70.00, ?, 'POLLING')
                """, bikeId, deviceId, UUID.randomUUID(), receivedAt.toString(), ignitionStatus);
    }

    private int countRows(String tableName) {
        return jdbcTemplate.queryForObject("select count(*) from " + tableName, Integer.class);
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
