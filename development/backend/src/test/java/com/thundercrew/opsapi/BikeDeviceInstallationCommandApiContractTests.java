package com.thundercrew.opsapi;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
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

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class BikeDeviceInstallationCommandApiContractTests extends PostgresContainerSupport {

    private static final UUID ADMIN_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final UUID BIKE_ID = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private static final UUID DEVICE_ID = UUID.fromString("cccccccc-cccc-cccc-cccc-cccccccccccc");
    private static final UUID INSTALLATION_ID = UUID.fromString("dddddddd-dddd-dddd-dddd-dddddddddddd");
    private static final String INSTALLED_AT = "2026-04-30T00:00:00Z";
    private static final Pattern ACCESS_TOKEN_PATTERN = Pattern.compile("\"accessToken\"\\s*:\\s*\"([^\"]+)\"");

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
        jdbcTemplate.update("delete from bike_device_installations");
        jdbcTemplate.update("delete from devices");
        jdbcTemplate.update("delete from bikes");
        jdbcTemplate.update("delete from admin_users");
        jdbcTemplate.update("""
                insert into admin_users (id, login_id, email, password_hash, display_name, enabled)
                values (?, 'ops-admin', 'ops@example.test', ?, 'Ops Admin', true)
                """, ADMIN_ID, passwordEncoder.encode("correct-password"));
        accessToken = loginAndExtractToken();
    }

    @Test
    void installDeviceGeneratesIdentifiersAndIgnoresClientSuppliedSystemFields() throws Exception {
        seedBike(BIKE_ID, "서울I-1001", "VIN-INSTALL-001", null);
        seedDevice(DEVICE_ID, "DEV-INSTALL-001", true, null);
        String clientSuppliedId = "99999999-9999-9999-9999-999999999999";

        MvcResult result = mockMvc.perform(post("/api/v1/bike-device-installations")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "id":"%s",
                                  "idx":999,
                                  "bikeId":"%s",
                                  "deviceId":"%s",
                                  "installedAt":"%s",
                                  "removedAt":"2026-05-01T00:00:00Z",
                                  "memo":"차량 단말 설치",
                                  "deviceUid":"IGNORED-UID",
                                  "telemetryStatus":"ONLINE",
                                  "deletedAt":"2026-01-01T00:00:00Z"
                                }
                                """.formatted(clientSuppliedId, BIKE_ID, DEVICE_ID, INSTALLED_AT)))
                .andExpect(status().isCreated())
                .andExpect(header().string(HttpHeaders.LOCATION, org.hamcrest.Matchers.startsWith("/api/v1/bike-device-installations/")))
                .andExpect(jsonPath("$.id").isString())
                .andExpect(jsonPath("$.id").value(org.hamcrest.Matchers.not(clientSuppliedId)))
                .andExpect(jsonPath("$.idx").isNumber())
                .andExpect(jsonPath("$.bikeId").value(BIKE_ID.toString()))
                .andExpect(jsonPath("$.deviceId").value(DEVICE_ID.toString()))
                .andExpect(jsonPath("$.installedAt").value(INSTALLED_AT))
                .andExpect(jsonPath("$.removedAt").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.memo").value("차량 단말 설치"))
                .andReturn();

        String createdId = extractId(result);
        mockMvc.perform(get("/api/v1/bike-device-installations/{id}", createdId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bikeId").value(BIKE_ID.toString()));
    }

    @Test
    void installDeviceRejectsMissingRequiredFields() throws Exception {
        mockMvc.perform(post("/api/v1/bike-device-installations")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldViolations").isArray());
    }

    @Test
    void installDeviceRejectsMissingDeletedOrDisabledReferences() throws Exception {
        seedBike(BIKE_ID, "서울I-1001", "VIN-INSTALL-001", null);
        seedDevice(DEVICE_ID, "DEV-INSTALL-001", true, null);

        UUID missingBikeId = UUID.fromString("11111111-1111-1111-1111-111111111111");
        mockMvc.perform(postInstall(missingBikeId, DEVICE_ID, INSTALLED_AT))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("REFERENCE_NOT_FOUND"));

        UUID deletedBikeId = UUID.fromString("22222222-2222-2222-2222-222222222222");
        seedBike(deletedBikeId, "서울I-2002", "VIN-INSTALL-002", "now()");
        mockMvc.perform(postInstall(deletedBikeId, DEVICE_ID, INSTALLED_AT))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("REFERENCE_DELETED"));

        UUID missingDeviceId = UUID.fromString("33333333-3333-3333-3333-333333333333");
        mockMvc.perform(postInstall(BIKE_ID, missingDeviceId, INSTALLED_AT))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("REFERENCE_NOT_FOUND"));

        UUID deletedDeviceId = UUID.fromString("44444444-4444-4444-4444-444444444444");
        seedDevice(deletedDeviceId, "DEV-INSTALL-DELETED", true, "now()");
        mockMvc.perform(postInstall(BIKE_ID, deletedDeviceId, INSTALLED_AT))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("REFERENCE_DELETED"));

        UUID disabledDeviceId = UUID.fromString("55555555-5555-5555-5555-555555555555");
        seedDevice(disabledDeviceId, "DEV-INSTALL-DISABLED", false, null);
        mockMvc.perform(postInstall(BIKE_ID, disabledDeviceId, INSTALLED_AT))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVALID_STATE_TRANSITION"));
    }

    @Test
    void installDeviceReplacesActiveBikeAndDeviceInstallationsTransactionally() throws Exception {
        UUID bikeA = BIKE_ID;
        UUID bikeB = UUID.fromString("11111111-1111-1111-1111-111111111111");
        UUID oldDevice = UUID.fromString("22222222-2222-2222-2222-222222222222");
        UUID newDevice = DEVICE_ID;
        seedBike(bikeA, "서울I-1001", "VIN-INSTALL-001", null);
        seedBike(bikeB, "서울I-2002", "VIN-INSTALL-002", null);
        seedDevice(oldDevice, "DEV-OLD-001", true, null);
        seedDevice(newDevice, "DEV-NEW-001", true, null);
        seedInstallation(UUID.fromString("33333333-3333-3333-3333-333333333333"), bikeA, oldDevice, "2026-04-29T00:00:00Z", null, "old bike device", null);
        seedInstallation(UUID.fromString("44444444-4444-4444-4444-444444444444"), bikeB, newDevice, "2026-04-29T00:00:00Z", null, "old device bike", null);

        mockMvc.perform(postInstall(bikeA, newDevice, INSTALLED_AT))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.bikeId").value(bikeA.toString()))
                .andExpect(jsonPath("$.deviceId").value(newDevice.toString()))
                .andExpect(jsonPath("$.removedAt").value(org.hamcrest.Matchers.nullValue()));

        Integer activeBikeACount = jdbcTemplate.queryForObject("""
                select count(*) from bike_device_installations
                where bike_id = ? and removed_at is null and deleted_at is null
                """, Integer.class, bikeA);
        Integer activeNewDeviceCount = jdbcTemplate.queryForObject("""
                select count(*) from bike_device_installations
                where device_id = ? and removed_at is null and deleted_at is null
                """, Integer.class, newDevice);
        Integer closedOldRows = jdbcTemplate.queryForObject("""
                select count(*) from bike_device_installations
                where id in ('33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444')
                  and removed_at = ?::timestamptz
                  and deleted_at is null
                """, Integer.class, INSTALLED_AT);

        assertThat(activeBikeACount).isEqualTo(1);
        assertThat(activeNewDeviceCount).isEqualTo(1);
        assertThat(closedOldRows).isEqualTo(2);
    }

    @Test
    void installDeviceLeavesExistingInstallationOpenWhenReplacementDeviceIsDisabled() throws Exception {
        UUID oldDevice = UUID.fromString("22222222-2222-2222-2222-222222222222");
        UUID disabledDevice = DEVICE_ID;
        seedBike(BIKE_ID, "서울I-1001", "VIN-INSTALL-001", null);
        seedDevice(oldDevice, "DEV-OLD-001", true, null);
        seedDevice(disabledDevice, "DEV-DISABLED-001", false, null);
        seedInstallation(INSTALLATION_ID, BIKE_ID, oldDevice, "2026-04-29T00:00:00Z", null, "old active", null);

        mockMvc.perform(postInstall(BIKE_ID, disabledDevice, INSTALLED_AT))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVALID_STATE_TRANSITION"));

        Integer oldActiveCount = jdbcTemplate.queryForObject("""
                select count(*) from bike_device_installations
                where id = ? and removed_at is null and deleted_at is null
                """, Integer.class, INSTALLATION_ID);
        Integer disabledInsertedCount = jdbcTemplate.queryForObject("""
                select count(*) from bike_device_installations
                where bike_id = ? and device_id = ?
                """, Integer.class, BIKE_ID, disabledDevice);

        assertThat(oldActiveCount).isEqualTo(1);
        assertThat(disabledInsertedCount).isZero();
    }

    @Test
    void removeInstallationSetsRemovedAtPreservesHistoryAndAllowsReinstall() throws Exception {
        seedBike(BIKE_ID, "서울I-1001", "VIN-INSTALL-001", null);
        seedDevice(DEVICE_ID, "DEV-INSTALL-001", true, null);
        seedInstallation(INSTALLATION_ID, BIKE_ID, DEVICE_ID, INSTALLED_AT, null, "installed", null);
        String removedAt = "2026-05-01T00:00:00Z";

        mockMvc.perform(patch("/api/v1/bike-device-installations/{id}/remove", INSTALLATION_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"removedAt":"%s","memo":"현장 탈거"}
                                """.formatted(removedAt)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(INSTALLATION_ID.toString()))
                .andExpect(jsonPath("$.removedAt").value(removedAt))
                .andExpect(jsonPath("$.memo").value("현장 탈거"));

        mockMvc.perform(get("/api/v1/bike-device-installations/{id}", INSTALLATION_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.removedAt").value(removedAt));

        mockMvc.perform(postInstall(BIKE_ID, DEVICE_ID, "2026-05-02T00:00:00Z"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.bikeId").value(BIKE_ID.toString()))
                .andExpect(jsonPath("$.deviceId").value(DEVICE_ID.toString()))
                .andExpect(jsonPath("$.removedAt").value(org.hamcrest.Matchers.nullValue()));
    }

    @Test
    void removeInstallationRejectsAlreadyRemovedOrDeletedRows() throws Exception {
        seedBike(BIKE_ID, "서울I-1001", "VIN-INSTALL-001", null);
        seedDevice(DEVICE_ID, "DEV-INSTALL-001", true, null);
        seedInstallation(INSTALLATION_ID, BIKE_ID, DEVICE_ID, INSTALLED_AT, "2026-05-01T00:00:00Z", "removed", null);

        mockMvc.perform(patch("/api/v1/bike-device-installations/{id}/remove", INSTALLATION_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVALID_STATE_TRANSITION"));

        UUID deletedInstallationId = UUID.fromString("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee");
        seedInstallation(deletedInstallationId, BIKE_ID, DEVICE_ID, "2026-05-02T00:00:00Z", "2026-05-03T00:00:00Z", "deleted", "now()");
        mockMvc.perform(patch("/api/v1/bike-device-installations/{id}/remove", deletedInstallationId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"));
    }

    @Test
    void removeInstallationRejectsMissingAndBeforeInstallRemovalTime() throws Exception {
        UUID missingInstallationId = UUID.fromString("11111111-1111-1111-1111-111111111111");
        mockMvc.perform(patch("/api/v1/bike-device-installations/{id}/remove", missingInstallationId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"));

        seedBike(BIKE_ID, "서울I-1001", "VIN-INSTALL-001", null);
        seedDevice(DEVICE_ID, "DEV-INSTALL-001", true, null);
        seedInstallation(INSTALLATION_ID, BIKE_ID, DEVICE_ID, "2026-04-30T00:00:00Z", null, "installed", null);

        mockMvc.perform(patch("/api/v1/bike-device-installations/{id}/remove", INSTALLATION_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"removedAt":"2026-04-29T00:00:00Z"}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVALID_STATE_TRANSITION"));
    }

    @Test
    void commandRequestsRequireBearerAuthentication() throws Exception {
        mockMvc.perform(post("/api/v1/bike-device-installations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_FAILED"));

        mockMvc.perform(patch("/api/v1/bike-device-installations/{id}/remove", INSTALLATION_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_FAILED"));
    }

    private org.springframework.test.web.servlet.RequestBuilder postInstall(
            UUID bikeId,
            UUID deviceId,
            String installedAt
    ) {
        return post("/api/v1/bike-device-installations")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"bikeId":"%s","deviceId":"%s","installedAt":"%s","memo":"install"}
                        """.formatted(bikeId, deviceId, installedAt));
    }

    private void seedBike(UUID id, String plateNumber, String vin, String deletedAtSql) {
        String deletedAtExpression = deletedAtSql == null ? "null" : deletedAtSql;
        jdbcTemplate.update("""
                insert into bikes (id, plate_number, vin, model_name, operation_status, deleted_at)
                values (?, ?, ?, 'Thunder M1', 'READY', %s)
                """.formatted(deletedAtExpression), id, plateNumber, vin);
    }

    private void seedDevice(UUID id, String deviceUid, boolean enabled, String deletedAtSql) {
        String deletedAtExpression = deletedAtSql == null ? "null" : deletedAtSql;
        jdbcTemplate.update("""
                insert into devices (id, device_uid, manufacturer, model_name, enabled, deleted_at)
                values (?, ?, 'ThunderDevice', 'TD-100', ?, %s)
                """.formatted(deletedAtExpression), id, deviceUid, enabled);
    }

    private void seedInstallation(
            UUID id,
            UUID bikeId,
            UUID deviceId,
            String installedAt,
            String removedAt,
            String memo,
            String deletedAtSql
    ) {
        String removedAtExpression = removedAt == null ? "null" : "'%s'::timestamptz".formatted(removedAt);
        String deletedAtExpression = deletedAtSql == null ? "null" : deletedAtSql;
        jdbcTemplate.update("""
                insert into bike_device_installations (id, bike_id, device_id, installed_at, removed_at, memo, deleted_at)
                values (?, ?, ?, ?::timestamptz, %s, ?, %s)
                """.formatted(removedAtExpression, deletedAtExpression), id, bikeId, deviceId, installedAt, memo);
    }

    private String loginAndExtractToken() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"loginId":"ops-admin","password":"correct-password"}
                                """))
                .andExpect(status().isOk())
                .andReturn();
        return extractAccessToken(result);
    }

    private String extractAccessToken(MvcResult result) throws Exception {
        Matcher matcher = ACCESS_TOKEN_PATTERN.matcher(result.getResponse().getContentAsString());
        assertThat(matcher.find()).isTrue();
        return matcher.group(1);
    }

    private String extractId(MvcResult result) throws Exception {
        Matcher matcher = Pattern.compile("\"id\"\\s*:\\s*\"([^\"]+)\"")
                .matcher(result.getResponse().getContentAsString());
        assertThat(matcher.find()).isTrue();
        return matcher.group(1);
    }
}
