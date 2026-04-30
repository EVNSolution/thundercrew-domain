package com.thundercrew.opsapi;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
class DeviceApiSyncContractTests extends PostgresContainerSupport {

    private static final UUID ADMIN_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final UUID ACTIVE_DEVICE_ID = UUID.fromString("10000000-0000-0000-0000-000000000001");
    private static final UUID DISABLED_DEVICE_ID = UUID.fromString("10000000-0000-0000-0000-000000000002");
    private static final Pattern ACCESS_TOKEN_PATTERN = Pattern.compile("\\\"accessToken\\\"\\s*:\\s*\\\"([^\\\"]+)\\\"");
    private static final Pattern ID_PATTERN = Pattern.compile("\\\"id\\\"\\s*:\\s*\\\"([^\\\"]+)\\\"");

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
        deleteIfExists("device_api_sync_results");
        deleteIfExists("device_api_sync_runs");
        List.of(
                "admin_auth_sessions",
                "bike_device_installations",
                "devices",
                "admin_users"
        ).forEach(table -> jdbcTemplate.update("delete from " + table));

        jdbcTemplate.update("""
                insert into admin_users (id, login_id, email, password_hash, display_name, enabled)
                values (?, 'ops-admin', 'ops@example.test', ?, 'Ops Admin', true)
                """, ADMIN_ID, passwordEncoder.encode("correct-password"));
        accessToken = loginAndExtractToken();
    }

    @Test
    void deviceApiSyncTablesExistWithoutForeignKeysAndExposeOperationalIndexes() {
        List<String> tables = jdbcTemplate.queryForList("""
                select table_name
                from information_schema.tables
                where table_schema = current_schema()
                  and table_name in ('device_api_sync_runs', 'device_api_sync_results')
                order by table_name
                """, String.class);
        Integer foreignKeyCount = jdbcTemplate.queryForObject("""
                select count(*)
                from information_schema.table_constraints
                where table_schema = current_schema()
                  and constraint_type = 'FOREIGN KEY'
                  and table_name in ('device_api_sync_runs', 'device_api_sync_results')
                """, Integer.class);
        List<String> indexNames = jdbcTemplate.queryForList("""
                select indexname
                from pg_indexes
                where schemaname = current_schema()
                  and tablename in ('device_api_sync_runs', 'device_api_sync_results')
                order by indexname
                """, String.class);

        assertThat(tables).containsExactly("device_api_sync_results", "device_api_sync_runs");
        assertThat(foreignKeyCount).isZero();
        assertThat(indexNames).contains(
                "ix_device_api_sync_runs_status_started",
                "ix_device_api_sync_runs_external_trace",
                "ix_device_api_sync_results_run_idx",
                "ix_device_api_sync_results_device_uid");
    }

    @Test
    void deviceApiSyncEndpointsRequireAdminAuthentication() throws Exception {
        mockMvc.perform(post("/api/v1/device-api-sync-runs")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createRunJson()))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/device-api-sync-runs"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void deviceApiSyncRunRecordsDeviceOutcomesAndCompletesWithSummaryCounts() throws Exception {
        seedDevice(ACTIVE_DEVICE_ID, "DEV-SYNC-001", true);
        seedDevice(DISABLED_DEVICE_ID, "DEV-SYNC-002", false);

        UUID runId = createRun();

        mockMvc.perform(post("/api/v1/device-api-sync-runs/{runId}/results", runId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(resultJson("DEV-SYNC-001", "SUCCESS", 200, "evt-success")))
                .andExpect(status().isCreated())
                .andExpect(header().string(HttpHeaders.LOCATION, "/api/v1/device-api-sync-runs/" + runId))
                .andExpect(jsonPath("$.runId").value(runId.toString()))
                .andExpect(jsonPath("$.deviceUid").value("DEV-SYNC-001"))
                .andExpect(jsonPath("$.deviceId").value(ACTIVE_DEVICE_ID.toString()))
                .andExpect(jsonPath("$.status").value("SUCCESS"));

        mockMvc.perform(post("/api/v1/device-api-sync-runs/{runId}/results", runId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(resultJson("DEV-SYNC-002", "SUCCESS", 200, "evt-disabled")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.deviceId").value(DISABLED_DEVICE_ID.toString()))
                .andExpect(jsonPath("$.status").value("DEVICE_DISABLED"));

        mockMvc.perform(post("/api/v1/device-api-sync-runs/{runId}/results", runId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(resultJson("DEV-SYNC-UNKNOWN", "SUCCESS", 404, "evt-unknown")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.deviceId").doesNotExist())
                .andExpect(jsonPath("$.status").value("DEVICE_UNKNOWN"));

        mockMvc.perform(patch("/api/v1/device-api-sync-runs/{runId}/complete", runId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(completeJson()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(runId.toString()))
                .andExpect(jsonPath("$.status").value("PARTIAL_FAILURE"))
                .andExpect(jsonPath("$.totalCount").value(3))
                .andExpect(jsonPath("$.successCount").value(1))
                .andExpect(jsonPath("$.failureCount").value(2))
                .andExpect(jsonPath("$.results").isArray());

        mockMvc.perform(get("/api/v1/device-api-sync-runs/{runId}", runId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.length()").value(3));

        mockMvc.perform(get("/api/v1/device-api-sync-runs")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(runId.toString()))
                .andExpect(jsonPath("$.items[0].status").value("PARTIAL_FAILURE"));
    }

    @Test
    void deviceApiSyncSummariesAreRedactedBeforePersistence() throws Exception {
        seedDevice(ACTIVE_DEVICE_ID, "DEV-SYNC-SECRET", true);
        UUID runId = createRun();

        mockMvc.perform(post("/api/v1/device-api-sync-runs/{runId}/results", runId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(resultJson("DEV-SYNC-SECRET", "FAILED", 502, "evt-secret")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.requestSummary.Authorization").doesNotExist())
                .andExpect(jsonPath("$.requestSummary.apiKey").doesNotExist())
                .andExpect(jsonPath("$.requestSummary.Cookie").doesNotExist())
                .andExpect(jsonPath("$.requestSummary.sessionId").doesNotExist())
                .andExpect(jsonPath("$.requestSummary.nested.password").doesNotExist())
                .andExpect(jsonPath("$.requestSummary.message").value(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("messagebearer123"))))
                .andExpect(jsonPath("$.requestSummary.message").value(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("json-fragment-secret"))))
                .andExpect(jsonPath("$.requestSummary.message").value(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("json-fragment-token"))))
                .andExpect(jsonPath("$.requestSummary.message").value(org.hamcrest.Matchers.containsString("[REDACTED]")))
                .andExpect(jsonPath("$.responseSummary.refreshToken").doesNotExist())
                .andExpect(jsonPath("$.responseSummary.setCookie").doesNotExist())
                .andExpect(jsonPath("$.responseSummary.detail").value(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("detailaccess123"))))
                .andExpect(jsonPath("$.responseSummary.detail").value(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("detailrefresh123"))))
                .andExpect(jsonPath("$.responseSummary.detail").value(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("detailkey123"))))
                .andExpect(jsonPath("$.responseSummary.detail").value(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("detailcookie123"))))
                .andExpect(jsonPath("$.responseSummary.detail").value(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("json-detail-secret"))))
                .andExpect(jsonPath("$.responseSummary.detail").value(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("json-detail-cookie"))))
                .andExpect(jsonPath("$.responseSummary.detail").value(org.hamcrest.Matchers.containsString("[REDACTED]")))
                .andExpect(jsonPath("$.status").value("FAILED"));

        String persisted = jdbcTemplate.queryForObject("""
                select coalesce(request_summary::text, '') || coalesce(response_summary::text, '')
                from device_api_sync_results
                where device_uid = 'DEV-SYNC-SECRET'
                """, String.class);
        assertThat(persisted)
                .doesNotContain(
                        "Bearer vendor-secret-token",
                        "plain-password",
                        "super-secret-api-key",
                        "refresh-secret-value",
                        "messagebearer123",
                        "messagepass123",
                        "detailaccess123",
                        "detailrefresh123",
                        "detailkey123",
                        "detailcookie123",
                        "json-fragment-secret",
                        "json-fragment-token",
                        "json-detail-secret",
                        "json-detail-cookie",
                        "cookie-secret",
                        "session-id-secret",
                        "set-cookie-secret")
                .contains("safe-request", "safe-response", "[REDACTED]");
    }


    @Test
    void deviceApiSyncErrorMessagesAreRedactedBeforePersistence() throws Exception {
        seedDevice(ACTIVE_DEVICE_ID, "DEV-SYNC-ERROR-SECRET", true);
        UUID runId = createRun();

        MvcResult result = mockMvc.perform(post("/api/v1/device-api-sync-runs/{runId}/results", runId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "deviceUid":"DEV-SYNC-ERROR-SECRET",
                                  "externalEventId":"evt-error-secret",
                                  "status":"FAILED",
                                  "httpStatus":502,
                                  "errorCode":"VENDOR_FAILURE",
                                  "errorMessage":"Authorization: Basic result-basic-secret-token; Authorization: Bearer result-secret-token; api_key=result-api-secret; password=plain-password; Cookie=session-secret; {\\"apiKey\\":\\"result-json-secret\\",\\"Cookie\\":\\"result-json-cookie\\"}"
                                }
                                """))
                .andExpect(status().isCreated())
                .andReturn();
        assertThat(result.getResponse().getContentAsString())
                .doesNotContain("result-basic-secret-token", "result-secret-token", "result-api-secret", "plain-password", "session-secret", "result-json-secret", "result-json-cookie")
                .contains("[REDACTED]");

        MvcResult completed = mockMvc.perform(patch("/api/v1/device-api-sync-runs/{runId}/complete", runId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "errorCode":"VENDOR_COMPLETE_FAILURE",
                                  "errorMessage":"Bearer completion-secret-token access_token=completion-access-token refresh_token=completion-refresh-token secret=completion-secret {\\"token\\":\\"completion-json-token\\"}"
                                }
                                """))
                .andExpect(status().isOk())
                .andReturn();
        assertThat(completed.getResponse().getContentAsString())
                .doesNotContain("completion-secret-token", "completion-access-token", "completion-refresh-token", "completion-secret")
                .contains("[REDACTED]");

        String persisted = jdbcTemplate.queryForObject("""
                select coalesce((select error_message from device_api_sync_results where device_uid = 'DEV-SYNC-ERROR-SECRET'), '')
                    || ' ' ||
                    coalesce((select error_message from device_api_sync_runs where id = ?), '')
                """, String.class, runId);
        assertThat(persisted)
                .doesNotContain(
                        "result-basic-secret-token",
                        "result-secret-token",
                        "result-api-secret",
                        "plain-password",
                        "session-secret",
                        "completion-secret-token",
                        "completion-access-token",
                        "completion-refresh-token",
                        "completion-secret",
                        "result-json-secret",
                        "result-json-cookie",
                        "completion-json-token")
                .contains("[REDACTED]");
    }

    @Test
    void deviceApiSyncReservedResolutionStatusesCannotBeClientSubmittedForActiveDevices() throws Exception {
        seedDevice(ACTIVE_DEVICE_ID, "DEV-SYNC-RESERVED", true);
        UUID runId = createRun();

        mockMvc.perform(post("/api/v1/device-api-sync-runs/{runId}/results", runId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(resultJson("DEV-SYNC-RESERVED", "DEVICE_UNKNOWN", 200, "evt-reserved")))
                .andExpect(status().isBadRequest());

        Integer rows = jdbcTemplate.queryForObject(
                "select count(*) from device_api_sync_results where device_uid = 'DEV-SYNC-RESERVED'",
                Integer.class);
        assertThat(rows).isZero();
    }

    private UUID createRun() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/device-api-sync-runs")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createRunJson()))
                .andExpect(status().isCreated())
                .andExpect(header().string(HttpHeaders.LOCATION, org.hamcrest.Matchers.startsWith("/api/v1/device-api-sync-runs/")))
                .andExpect(jsonPath("$.syncType").value("POLLING"))
                .andExpect(jsonPath("$.status").value("RUNNING"))
                .andExpect(jsonPath("$.totalCount").value(0))
                .andReturn();
        return extractId(result);
    }

    private String createRunJson() {
        return """
                {
                  "syncType":"POLLING",
                  "externalTraceId":"poll-run-001",
                  "requestSummary":{
                    "endpoint":"/vendor/devices",
                    "Authorization":"Bearer vendor-secret-token",
                    "safe":"safe-request"
                  }
                }
                """;
    }

    private String resultJson(String deviceUid, String status, int httpStatus, String externalEventId) {
        return """
                {
                  "deviceUid":"%s",
                  "externalEventId":"%s",
                  "status":"%s",
                  "httpStatus":%d,
                  "errorCode":"VENDOR_%s",
                  "errorMessage":"sync fixture",
                  "requestSummary":{
                    "safe":"safe-request",
                    "Authorization":"Bearer vendor-secret-token",
                    "apiKey":"super-secret-api-key",
                    "Cookie":"session=cookie-secret",
                    "sessionId":"session-id-secret",
                    "nested":{"password":"plain-password"},
                    "message":"Authorization: Bearer messagebearer123 password=messagepass123 {\\"apiKey\\":\\"json-fragment-secret\\",\\"accessToken\\":\\"json-fragment-token\\"}"
                  },
                  "responseSummary":{
                    "safe":"safe-response",
                    "refreshToken":"refresh-secret-value",
                    "setCookie":"session=set-cookie-secret",
                    "detail":"access_token=detailaccess123 refresh_token=detailrefresh123 api_key=detailkey123 Cookie=detailcookie123 {\\"secret\\":\\"json-detail-secret\\",\\"setCookie\\":\\"json-detail-cookie\\"}"
                  }
                }
                """.formatted(deviceUid, externalEventId, status, httpStatus, status);
    }

    private String completeJson() {
        return """
                {
                  "responseSummary":{"safe":"safe-response","token":"completion-token"},
                  "errorCode":"PARTIAL_VENDOR_FAILURE",
                  "errorMessage":"some devices failed"
                }
                """;
    }

    private UUID extractId(MvcResult result) throws Exception {
        Matcher matcher = ID_PATTERN.matcher(result.getResponse().getContentAsString());
        assertThat(matcher.find()).isTrue();
        return UUID.fromString(matcher.group(1));
    }

    private void seedDevice(UUID id, String deviceUid, boolean enabled) {
        jdbcTemplate.update("""
                insert into devices (id, device_uid, manufacturer, model_name, enabled)
                values (?, ?, 'ThunderDevice', 'TD-100', ?)
                """, id, deviceUid, enabled);
    }

    private void deleteIfExists(String tableName) {
        Boolean exists = jdbcTemplate.queryForObject("select to_regclass(?) is not null", Boolean.class, tableName);
        if (Boolean.TRUE.equals(exists)) {
            jdbcTemplate.update("delete from " + tableName);
        }
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
