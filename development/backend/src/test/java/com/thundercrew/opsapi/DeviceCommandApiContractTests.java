package com.thundercrew.opsapi;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
class DeviceCommandApiContractTests extends PostgresContainerSupport {

    private static final UUID ADMIN_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final UUID DEVICE_ID = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
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
    void createDeviceGeneratesIdentifiersAndIgnoresClientSuppliedSystemAndRelationshipFields() throws Exception {
        String clientSuppliedId = "99999999-9999-9999-9999-999999999999";

        MvcResult result = mockMvc.perform(post("/api/v1/devices")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "id":"%s",
                                  "idx":999,
                                  "deviceUid":"DEV-CREATE-001",
                                  "manufacturer":"ThunderDevice",
                                  "modelName":"TD-100",
                                  "enabled":true,
                                  "memo":"초기 단말 등록",
                                  "bikeId":"11111111-1111-1111-1111-111111111111",
                                  "installationId":"22222222-2222-2222-2222-222222222222",
                                  "telemetryStatus":"ONLINE",
                                  "deletedAt":"2026-01-01T00:00:00Z"
                                }
                                """.formatted(clientSuppliedId)))
                .andExpect(status().isCreated())
                .andExpect(header().string(HttpHeaders.LOCATION, org.hamcrest.Matchers.startsWith("/api/v1/devices/")))
                .andExpect(jsonPath("$.id").isString())
                .andExpect(jsonPath("$.id").value(org.hamcrest.Matchers.not(clientSuppliedId)))
                .andExpect(jsonPath("$.idx").isNumber())
                .andExpect(jsonPath("$.deviceUid").value("DEV-CREATE-001"))
                .andExpect(jsonPath("$.manufacturer").value("ThunderDevice"))
                .andExpect(jsonPath("$.modelName").value("TD-100"))
                .andExpect(jsonPath("$.enabled").value(true))
                .andExpect(jsonPath("$.memo").value("초기 단말 등록"))
                .andReturn();

        String createdId = extractId(result);
        mockMvc.perform(get("/api/v1/devices/{id}", createdId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deviceUid").value("DEV-CREATE-001"));
    }

    @Test
    void createDeviceRejectsMissingHumanRequiredFields() throws Exception {
        mockMvc.perform(post("/api/v1/devices")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"deviceUid":""}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldViolations").isArray());
    }

    @Test
    void createDeviceRejectsDuplicateActiveDeviceUid() throws Exception {
        seedDevice(DEVICE_ID, "DEV-DUP-001", "ThunderDevice", "TD-100", true, null);

        mockMvc.perform(post("/api/v1/devices")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"deviceUid":"DEV-DUP-001","manufacturer":"Other"}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DUPLICATE_ACTIVE_RESOURCE"));
    }

    @Test
    void updateDeviceChangesOnlyOperatorManagedFieldsAndIgnoresRelationshipFields() throws Exception {
        seedDevice(DEVICE_ID, "DEV-UPDATE-001", "ThunderDevice", "TD-100", true, null);

        mockMvc.perform(patch("/api/v1/devices/{id}", DEVICE_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "id":"99999999-9999-9999-9999-999999999999",
                                  "idx":999,
                                  "deviceUid":"DEV-UPDATE-002",
                                  "manufacturer":"UpdatedMaker",
                                  "modelName":"TD-200",
                                  "enabled":false,
                                  "memo":"단말 정보 수정",
                                  "bikeId":"11111111-1111-1111-1111-111111111111",
                                  "deletedAt":"2026-01-01T00:00:00Z"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(DEVICE_ID.toString()))
                .andExpect(jsonPath("$.deviceUid").value("DEV-UPDATE-002"))
                .andExpect(jsonPath("$.manufacturer").value("UpdatedMaker"))
                .andExpect(jsonPath("$.modelName").value("TD-200"))
                .andExpect(jsonPath("$.enabled").value(false))
                .andExpect(jsonPath("$.memo").value("단말 정보 수정"));
    }

    @Test
    void updateDeviceRejectsMissingOrDuplicateTargets() throws Exception {
        seedDevice(DEVICE_ID, "DEV-UPDATE-001", "ThunderDevice", "TD-100", true, null);
        UUID otherId = UUID.fromString("cccccccc-cccc-cccc-cccc-cccccccccccc");
        seedDevice(otherId, "DEV-UPDATE-002", "ThunderDevice", "TD-100", true, null);

        UUID missingId = UUID.fromString("dddddddd-dddd-dddd-dddd-dddddddddddd");
        mockMvc.perform(patch("/api/v1/devices/{id}", missingId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"deviceUid":"DEV-MISSING-001"}
                                """))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"));

        mockMvc.perform(patch("/api/v1/devices/{id}", DEVICE_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"deviceUid":"DEV-UPDATE-002"}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DUPLICATE_ACTIVE_RESOURCE"));
    }

    @Test
    void deleteDeviceSoftDeletesAndAllowsDeviceUidReuse() throws Exception {
        seedDevice(DEVICE_ID, "DEV-DELETE-001", "ThunderDevice", "TD-100", true, null);

        mockMvc.perform(delete("/api/v1/devices/{id}", DEVICE_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isNoContent());

        Boolean enabled = jdbcTemplate.queryForObject(
                "select enabled from devices where id = ?",
                Boolean.class,
                DEVICE_ID
        );
        assertThat(enabled).isFalse();

        mockMvc.perform(get("/api/v1/devices/{id}", DEVICE_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isNotFound());

        mockMvc.perform(post("/api/v1/devices")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"deviceUid":"DEV-DELETE-001","manufacturer":"ReusedMaker"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.deviceUid").value("DEV-DELETE-001"))
                .andExpect(jsonPath("$.manufacturer").value("ReusedMaker"));
    }

    @Test
    void deleteDeviceAllowsRemovedInstallationHistory() throws Exception {
        seedDevice(DEVICE_ID, "DEV-REMOVED-INSTALL-001", "ThunderDevice", "TD-100", true, null);
        UUID bikeId = UUID.fromString("11111111-1111-1111-1111-111111111111");
        jdbcTemplate.update("""
                insert into bikes (id, plate_number, vin, model_name, operation_status)
                values (?, '서울D-2002', 'VIN-DEVICE-REMOVED-001', 'Thunder M1', 'READY')
                """, bikeId);
        jdbcTemplate.update("""
                insert into bike_device_installations (id, bike_id, device_id, installed_at, removed_at)
                values (?, ?, ?, now() - interval '1 day', now())
                """, UUID.fromString("22222222-2222-2222-2222-222222222222"), bikeId, DEVICE_ID);

        mockMvc.perform(delete("/api/v1/devices/{id}", DEVICE_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/devices/{id}", DEVICE_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isNotFound());
    }

    @Test
    void deleteDeviceRejectsActiveBikeInstallationReferences() throws Exception {
        seedDevice(DEVICE_ID, "DEV-INSTALLED-001", "ThunderDevice", "TD-100", true, null);
        UUID bikeId = UUID.fromString("11111111-1111-1111-1111-111111111111");
        jdbcTemplate.update("""
                insert into bikes (id, plate_number, vin, model_name, operation_status)
                values (?, '서울D-1001', 'VIN-DEVICE-REF-001', 'Thunder M1', 'READY')
                """, bikeId);
        jdbcTemplate.update("""
                insert into bike_device_installations (id, bike_id, device_id, installed_at)
                values (?, ?, ?, now())
                """, UUID.fromString("22222222-2222-2222-2222-222222222222"), bikeId, DEVICE_ID);

        mockMvc.perform(delete("/api/v1/devices/{id}", DEVICE_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVALID_STATE_TRANSITION"));

        Integer activeDeviceCount = jdbcTemplate.queryForObject("""
                select count(*) from devices where id = ? and deleted_at is null
                """, Integer.class, DEVICE_ID);
        assertThat(activeDeviceCount).isEqualTo(1);
    }

    @Test
    void commandRequestsRequireBearerAuthentication() throws Exception {
        mockMvc.perform(post("/api/v1/devices")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"deviceUid":"DEV-NO-AUTH-001"}
                                """))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_FAILED"));

        mockMvc.perform(patch("/api/v1/devices/{id}", DEVICE_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"manufacturer":"NoAuth"}
                                """))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_FAILED"));

        mockMvc.perform(delete("/api/v1/devices/{id}", DEVICE_ID))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_FAILED"));
    }

    private void seedDevice(
            UUID id,
            String deviceUid,
            String manufacturer,
            String modelName,
            boolean enabled,
            String deletedAtSql
    ) {
        String deletedAtExpression = deletedAtSql == null ? "null" : deletedAtSql;
        jdbcTemplate.update("""
                insert into devices (id, device_uid, manufacturer, model_name, enabled, memo, deleted_at)
                values (?, ?, ?, ?, ?, 'fixture device', %s)
                """.formatted(deletedAtExpression), id, deviceUid, manufacturer, modelName, enabled);
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
