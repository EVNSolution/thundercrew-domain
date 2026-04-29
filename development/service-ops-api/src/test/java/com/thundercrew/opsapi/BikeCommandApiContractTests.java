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
class BikeCommandApiContractTests extends PostgresContainerSupport {

    private static final UUID ADMIN_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final UUID BIKE_ID = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
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
        jdbcTemplate.update("delete from bike_equipments");
        jdbcTemplate.update("delete from equipment_types");
        jdbcTemplate.update("delete from rider_bike_contracts");
        jdbcTemplate.update("delete from riders");
        jdbcTemplate.update("delete from bike_operation_status_histories");
        jdbcTemplate.update("delete from bikes");
        jdbcTemplate.update("delete from admin_users");
        jdbcTemplate.update("""
                insert into admin_users (id, login_id, email, password_hash, display_name, enabled)
                values (?, 'ops-admin', 'ops@example.test', ?, 'Ops Admin', true)
                """, ADMIN_ID, passwordEncoder.encode("correct-password"));
        accessToken = loginAndExtractToken();
    }

    @Test
    void createBikeGeneratesIdentifiersIgnoresSystemFieldsAndCreatesInitialOpenHistory() throws Exception {
        String clientSuppliedId = "99999999-9999-9999-9999-999999999999";

        MvcResult result = mockMvc.perform(post("/api/v1/bikes")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "id":"%s",
                                  "idx":999,
                                  "plateNumber":"서울A-1001",
                                  "vin":"VIN-BIKE-CREATE-001",
                                  "modelName":"Thunder M1",
                                  "operationStatus":"READY",
                                  "memo":"초기 등록",
                                  "riderId":"11111111-1111-1111-1111-111111111111",
                                  "deviceId":"22222222-2222-2222-2222-222222222222",
                                  "contractId":"33333333-3333-3333-3333-333333333333",
                                  "telemetryStatus":"ONLINE",
                                  "deletedAt":"2026-01-01T00:00:00Z"
                                }
                                """.formatted(clientSuppliedId)))
                .andExpect(status().isCreated())
                .andExpect(header().string(HttpHeaders.LOCATION, org.hamcrest.Matchers.startsWith("/api/v1/bikes/")))
                .andExpect(jsonPath("$.id").isString())
                .andExpect(jsonPath("$.id").value(org.hamcrest.Matchers.not(clientSuppliedId)))
                .andExpect(jsonPath("$.idx").isNumber())
                .andExpect(jsonPath("$.plateNumber").value("서울A-1001"))
                .andExpect(jsonPath("$.vin").value("VIN-BIKE-CREATE-001"))
                .andExpect(jsonPath("$.modelName").value("Thunder M1"))
                .andExpect(jsonPath("$.operationStatus").value("READY"))
                .andExpect(jsonPath("$.memo").value("초기 등록"))
                .andReturn();

        UUID createdId = UUID.fromString(extractId(result));
        Integer openHistoryCount = jdbcTemplate.queryForObject("""
                select count(*) from bike_operation_status_histories
                where bike_id = ? and operation_status = 'READY' and ended_at is null and deleted_at is null
                """, Integer.class, createdId);
        assertThat(openHistoryCount).isEqualTo(1);
    }

    @Test
    void createBikeRejectsMissingHumanRequiredFields() throws Exception {
        mockMvc.perform(post("/api/v1/bikes")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"plateNumber":"","vin":"","operationStatus":null}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldViolations").isArray());
    }


    @Test
    void createBikeRejectsUnknownOperationStatusAsValidationError() throws Exception {
        mockMvc.perform(post("/api/v1/bikes")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"plateNumber":"서울Z-9999","vin":"VIN-INVALID-STATUS-001","operationStatus":"BROKEN"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.path").value("/api/v1/bikes"));
    }

    @Test
    void createBikeRejectsDuplicateActivePlateNumberOrVin() throws Exception {
        seedBike(BIKE_ID, "서울A-1001", "VIN-DUP-001", "READY", null);

        mockMvc.perform(post("/api/v1/bikes")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"plateNumber":"서울A-1001","vin":"VIN-NEW-001","operationStatus":"READY"}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DUPLICATE_ACTIVE_RESOURCE"));

        mockMvc.perform(post("/api/v1/bikes")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"plateNumber":"서울A-2002","vin":"VIN-DUP-001","operationStatus":"READY"}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DUPLICATE_ACTIVE_RESOURCE"));
    }

    @Test
    void updateBikeChangesOnlyBasicProfileAndDoesNotChangeOperationStatus() throws Exception {
        seedBike(BIKE_ID, "서울A-1001", "VIN-BIKE-UPDATE-001", "READY", null);

        mockMvc.perform(patch("/api/v1/bikes/{id}", BIKE_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "plateNumber":"서울B-2002",
                                  "vin":"VIN-BIKE-UPDATE-002",
                                  "modelName":"Thunder M2",
                                  "memo":"기본 정보 수정",
                                  "operationStatus":"IN_SERVICE",
                                  "riderId":"11111111-1111-1111-1111-111111111111",
                                  "deviceId":"22222222-2222-2222-2222-222222222222"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(BIKE_ID.toString()))
                .andExpect(jsonPath("$.plateNumber").value("서울B-2002"))
                .andExpect(jsonPath("$.vin").value("VIN-BIKE-UPDATE-002"))
                .andExpect(jsonPath("$.modelName").value("Thunder M2"))
                .andExpect(jsonPath("$.memo").value("기본 정보 수정"))
                .andExpect(jsonPath("$.operationStatus").value("READY"));
    }

    @Test
    void updateBikeRejectsMissingOrDuplicateTargets() throws Exception {
        seedBike(BIKE_ID, "서울A-1001", "VIN-BIKE-UPDATE-001", "READY", null);
        UUID otherId = UUID.fromString("cccccccc-cccc-cccc-cccc-cccccccccccc");
        seedBike(otherId, "서울C-3003", "VIN-BIKE-UPDATE-003", "READY", null);

        UUID missingId = UUID.fromString("dddddddd-dddd-dddd-dddd-dddddddddddd");
        mockMvc.perform(patch("/api/v1/bikes/{id}", missingId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"plateNumber":"서울X-9999"}
                                """))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"));

        mockMvc.perform(patch("/api/v1/bikes/{id}", BIKE_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"plateNumber":"서울C-3003"}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DUPLICATE_ACTIVE_RESOURCE"));

        mockMvc.perform(patch("/api/v1/bikes/{id}", BIKE_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"vin":"VIN-BIKE-UPDATE-003"}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DUPLICATE_ACTIVE_RESOURCE"));
    }

    @Test
    void changeOperationStatusUpdatesBikeAndClosesPreviousOpenHistory() throws Exception {
        seedBike(BIKE_ID, "서울A-1001", "VIN-BIKE-STATUS-001", "READY", null);
        seedOpenStatusHistory(BIKE_ID, "READY");

        mockMvc.perform(patch("/api/v1/bikes/{id}/operation-status", BIKE_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "operationStatus":"IN_SERVICE",
                                  "reason":"운영 투입",
                                  "memo":"강남 구역",
                                  "plateNumber":"무시-9999",
                                  "deviceId":"22222222-2222-2222-2222-222222222222"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.operationStatus").value("IN_SERVICE"))
                .andExpect(jsonPath("$.plateNumber").value("서울A-1001"));

        Integer closedReadyCount = jdbcTemplate.queryForObject("""
                select count(*) from bike_operation_status_histories
                where bike_id = ? and operation_status = 'READY' and ended_at is not null and deleted_at is null
                """, Integer.class, BIKE_ID);
        Integer openInServiceCount = jdbcTemplate.queryForObject("""
                select count(*) from bike_operation_status_histories
                where bike_id = ? and operation_status = 'IN_SERVICE' and ended_at is null
                  and reason = '운영 투입' and memo = '강남 구역' and deleted_at is null
                """, Integer.class, BIKE_ID);

        assertThat(closedReadyCount).isEqualTo(1);
        assertThat(openInServiceCount).isEqualTo(1);
    }

    @Test
    void deleteBikeSoftDeletesAndAllowsPlateAndVinReuse() throws Exception {
        seedBike(BIKE_ID, "서울A-1001", "VIN-BIKE-DELETE-001", "READY", null);

        mockMvc.perform(delete("/api/v1/bikes/{id}", BIKE_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/bikes/{id}", BIKE_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isNotFound());

        mockMvc.perform(post("/api/v1/bikes")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"plateNumber":"서울A-1001","vin":"VIN-BIKE-DELETE-001","operationStatus":"READY"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.plateNumber").value("서울A-1001"))
                .andExpect(jsonPath("$.vin").value("VIN-BIKE-DELETE-001"));
    }

    @Test
    void deleteBikeRejectsActiveContractEquipmentOrDeviceReferences() throws Exception {
        seedBike(BIKE_ID, "서울A-1001", "VIN-BIKE-REF-001", "READY", null);
        UUID riderId = UUID.fromString("11111111-1111-1111-1111-111111111111");
        jdbcTemplate.update("""
                insert into riders (id, name, phone_number, app_account_linked)
                values (?, '참조 라이더', '010-1000-2000', false)
                """, riderId);
        jdbcTemplate.update("""
                insert into rider_bike_contracts (id, rider_id, bike_id, contract_template_id, start_at)
                values (?, ?, ?, '00000000-0000-0000-0000-000000000001', now())
                """, UUID.fromString("22222222-2222-2222-2222-222222222222"), riderId, BIKE_ID);

        mockMvc.perform(delete("/api/v1/bikes/{id}", BIKE_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVALID_STATE_TRANSITION"));

        jdbcTemplate.update("delete from rider_bike_contracts");
        UUID equipmentTypeId = UUID.fromString("33333333-3333-3333-3333-333333333333");
        jdbcTemplate.update("""
                insert into equipment_types (id, name, enabled)
                values (?, '브레이크 패드', true)
                """, equipmentTypeId);
        jdbcTemplate.update("""
                insert into bike_equipments (id, bike_id, equipment_type_id, installed_at, management_due_date)
                values (?, ?, ?, now(), current_date + interval '30 day')
                """, UUID.fromString("44444444-4444-4444-4444-444444444444"), BIKE_ID, equipmentTypeId);

        mockMvc.perform(delete("/api/v1/bikes/{id}", BIKE_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVALID_STATE_TRANSITION"));

        jdbcTemplate.update("delete from bike_equipments");
        UUID deviceId = UUID.fromString("55555555-5555-5555-5555-555555555555");
        jdbcTemplate.update("""
                insert into devices (id, device_uid, enabled)
                values (?, 'DEVICE-REF-001', true)
                """, deviceId);
        jdbcTemplate.update("""
                insert into bike_device_installations (id, bike_id, device_id, installed_at)
                values (?, ?, ?, now())
                """, UUID.fromString("66666666-6666-6666-6666-666666666666"), BIKE_ID, deviceId);

        mockMvc.perform(delete("/api/v1/bikes/{id}", BIKE_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVALID_STATE_TRANSITION"));
    }

    @Test
    void commandRequestsRequireBearerAuthentication() throws Exception {
        mockMvc.perform(post("/api/v1/bikes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"plateNumber":"무인증-1","vin":"VIN-NO-AUTH-001","operationStatus":"READY"}
                                """))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_FAILED"));
    }

    private void seedBike(UUID id, String plateNumber, String vin, String operationStatus, String deletedAtSql) {
        String deletedAtExpression = deletedAtSql == null ? "null" : deletedAtSql;
        jdbcTemplate.update("""
                insert into bikes (id, plate_number, vin, model_name, operation_status, memo, deleted_at)
                values (?, ?, ?, 'Thunder M1', ?, 'fixture bike', %s)
                """.formatted(deletedAtExpression), id, plateNumber, vin, operationStatus);
    }

    private void seedOpenStatusHistory(UUID bikeId, String operationStatus) {
        jdbcTemplate.update("""
                insert into bike_operation_status_histories (id, bike_id, operation_status, started_at, reason, memo)
                values (?, ?, ?, now() - interval '1 hour', 'fixture', 'fixture history')
                """, UUID.randomUUID(), bikeId, operationStatus);
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
