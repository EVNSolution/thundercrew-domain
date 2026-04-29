package com.thundercrew.opsapi;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.sql.Timestamp;
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
class RiderBikeContractCommandApiContractTests extends PostgresContainerSupport {

    private static final UUID ADMIN_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final UUID RIDER_ID = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private static final UUID BIKE_ID = UUID.fromString("cccccccc-cccc-cccc-cccc-cccccccccccc");
    private static final UUID TEMPLATE_ID = UUID.fromString("dddddddd-dddd-dddd-dddd-dddddddddddd");
    private static final UUID SYSTEM_TEMPLATE_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final Instant CONTRACT_START = Instant.parse("2030-01-01T00:00:00Z");
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
        jdbcTemplate.update("delete from rider_bike_contracts");
        jdbcTemplate.update("delete from riders");
        jdbcTemplate.update("delete from bikes");
        jdbcTemplate.update("delete from contract_templates where system_template = false");
        jdbcTemplate.update("delete from admin_users");
        jdbcTemplate.update("""
                insert into admin_users (id, login_id, email, password_hash, display_name, enabled)
                values (?, 'ops-admin', 'ops@example.test', ?, 'Ops Admin', true)
                """, ADMIN_ID, passwordEncoder.encode("correct-password"));
        seedRider(RIDER_ID, "계약 라이더", "010-1000-2000", null);
        seedBike(BIKE_ID, "서울A-1001", "VIN-CONTRACT-001", null);
        seedTemplate(TEMPLATE_ID, "12일 계약", 17280, true, null);
        accessToken = loginAndExtractToken();
    }

    @Test
    void createFiniteContractGeneratesIdentifiersComputesEndAtAndIgnoresClientSystemFields() throws Exception {
        String clientSuppliedId = "99999999-9999-9999-9999-999999999999";

        MvcResult result = mockMvc.perform(post("/api/v1/rider-bike-contracts")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "id":"%s",
                                  "idx":999,
                                  "riderId":"%s",
                                  "bikeId":"%s",
                                  "contractTemplateId":"%s",
                                  "startAt":"%s",
                                  "endAt":"2099-01-01T00:00:00Z",
                                  "terminatedAt":"2030-01-01T01:00:00Z",
                                  "terminatedReason":"client ignored",
                                  "deletedAt":"2030-01-02T00:00:00Z",
                                  "memo":"강남 구역 12일 배정"
                                }
                                """.formatted(clientSuppliedId, RIDER_ID, BIKE_ID, TEMPLATE_ID, CONTRACT_START)))
                .andExpect(status().isCreated())
                .andExpect(header().string(HttpHeaders.LOCATION, org.hamcrest.Matchers.startsWith("/api/v1/rider-bike-contracts/")))
                .andExpect(jsonPath("$.id").isString())
                .andExpect(jsonPath("$.id").value(org.hamcrest.Matchers.not(clientSuppliedId)))
                .andExpect(jsonPath("$.idx").isNumber())
                .andExpect(jsonPath("$.riderId").value(RIDER_ID.toString()))
                .andExpect(jsonPath("$.bikeId").value(BIKE_ID.toString()))
                .andExpect(jsonPath("$.contractTemplateId").value(TEMPLATE_ID.toString()))
                .andExpect(jsonPath("$.startAt").value(CONTRACT_START.toString()))
                .andExpect(jsonPath("$.endAt").value("2030-01-13T00:00:00Z"))
                .andExpect(jsonPath("$.terminatedAt").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.terminatedReason").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.memo").value("강남 구역 12일 배정"))
                .andReturn();

        UUID createdId = UUID.fromString(extractId(result));
        Integer createdRows = jdbcTemplate.queryForObject("""
                select count(*) from rider_bike_contracts
                where id = ? and end_at = '2030-01-13T00:00:00Z'::timestamptz
                  and terminated_at is null and deleted_at is null
                """, Integer.class, createdId);
        assertThat(createdRows).isEqualTo(1);
    }

    @Test
    void createUnlimitedContractKeepsEndAtNull() throws Exception {
        mockMvc.perform(postContract(RIDER_ID, BIKE_ID, SYSTEM_TEMPLATE_ID, CONTRACT_START))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.endAt").value(org.hamcrest.Matchers.nullValue()));
    }

    @Test
    void createContractRejectsMissingRequiredReferencesAndStartAt() throws Exception {
        mockMvc.perform(post("/api/v1/rider-bike-contracts")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.path").value("/api/v1/rider-bike-contracts"))
                .andExpect(jsonPath("$.fieldViolations").isArray());
    }

    @Test
    void createContractRejectsMissingDeletedOrDisabledReferences() throws Exception {
        UUID missingRiderId = UUID.fromString("11111111-1111-1111-1111-111111111111");
        mockMvc.perform(postContract(missingRiderId, BIKE_ID, TEMPLATE_ID, CONTRACT_START))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("REFERENCE_NOT_FOUND"));

        jdbcTemplate.update("update bikes set deleted_at = now() where id = ?", BIKE_ID);
        mockMvc.perform(postContract(RIDER_ID, BIKE_ID, TEMPLATE_ID, CONTRACT_START))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("REFERENCE_DELETED"));
        jdbcTemplate.update("update bikes set deleted_at = null where id = ?", BIKE_ID);

        jdbcTemplate.update("update contract_templates set enabled = false where id = ?", TEMPLATE_ID);
        mockMvc.perform(postContract(RIDER_ID, BIKE_ID, TEMPLATE_ID, CONTRACT_START))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVALID_STATE_TRANSITION"));
    }

    @Test
    void createContractRejectsOverlappingRiderOrBikeIntervals() throws Exception {
        UUID otherRiderId = UUID.fromString("11111111-1111-1111-1111-111111111111");
        UUID otherBikeId = UUID.fromString("22222222-2222-2222-2222-222222222222");
        seedRider(otherRiderId, "다른 라이더", "010-2000-3000", null);
        seedBike(otherBikeId, "서울B-2002", "VIN-CONTRACT-002", null);

        seedContract(UUID.fromString("33333333-3333-3333-3333-333333333333"), RIDER_ID, otherBikeId,
                TEMPLATE_ID, CONTRACT_START, Instant.parse("2030-01-13T00:00:00Z"), null, null);
        mockMvc.perform(postContract(RIDER_ID, BIKE_ID, TEMPLATE_ID, Instant.parse("2030-01-12T00:00:00Z")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PERIOD_OVERLAP"));

        jdbcTemplate.update("delete from rider_bike_contracts");
        seedContract(UUID.fromString("44444444-4444-4444-4444-444444444444"), otherRiderId, BIKE_ID,
                TEMPLATE_ID, CONTRACT_START, Instant.parse("2030-01-13T00:00:00Z"), null, null);
        mockMvc.perform(postContract(RIDER_ID, BIKE_ID, TEMPLATE_ID, Instant.parse("2030-01-12T00:00:00Z")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PERIOD_OVERLAP"));
    }

    @Test
    void createContractAllowsBackToBackFutureReservationAndIgnoresTerminatedOrSoftDeletedRows() throws Exception {
        seedContract(UUID.fromString("11111111-1111-1111-1111-111111111111"), RIDER_ID, BIKE_ID,
                TEMPLATE_ID, CONTRACT_START, Instant.parse("2030-01-13T00:00:00Z"), null, null);
        seedContract(UUID.fromString("22222222-2222-2222-2222-222222222222"), RIDER_ID, BIKE_ID,
                TEMPLATE_ID, Instant.parse("2030-01-05T00:00:00Z"), Instant.parse("2030-01-17T00:00:00Z"),
                Instant.parse("2030-01-06T00:00:00Z"), null);
        seedContract(UUID.fromString("33333333-3333-3333-3333-333333333333"), RIDER_ID, BIKE_ID,
                TEMPLATE_ID, Instant.parse("2030-01-07T00:00:00Z"), Instant.parse("2030-01-19T00:00:00Z"),
                null, "now()");

        mockMvc.perform(postContract(RIDER_ID, BIKE_ID, TEMPLATE_ID, Instant.parse("2030-01-13T00:00:00Z")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.startAt").value("2030-01-13T00:00:00Z"))
                .andExpect(jsonPath("$.endAt").value("2030-01-25T00:00:00Z"));
    }

    @Test
    void createContractRejectsLaterAssignmentWhenExistingUnlimitedContractIsOpen() throws Exception {
        UUID otherBikeId = UUID.fromString("22222222-2222-2222-2222-222222222222");
        seedBike(otherBikeId, "서울B-2002", "VIN-CONTRACT-002", null);
        seedContract(UUID.fromString("33333333-3333-3333-3333-333333333333"), RIDER_ID, otherBikeId,
                SYSTEM_TEMPLATE_ID, CONTRACT_START, null, null, null);

        mockMvc.perform(postContract(RIDER_ID, BIKE_ID, TEMPLATE_ID, Instant.parse("2030-02-01T00:00:00Z")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PERIOD_OVERLAP"));
    }

    @Test
    void commandRequestsRequireBearerAuthenticationAndOnlyCreateIsInThisBaseline() throws Exception {
        mockMvc.perform(post("/api/v1/rider-bike-contracts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "riderId":"%s",
                                  "bikeId":"%s",
                                  "contractTemplateId":"%s",
                                  "startAt":"%s"
                                }
                                """.formatted(RIDER_ID, BIKE_ID, TEMPLATE_ID, CONTRACT_START)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_FAILED"));

        mockMvc.perform(put("/api/v1/rider-bike-contracts/{id}", UUID.fromString("11111111-1111-1111-1111-111111111111"))
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isMethodNotAllowed());
        mockMvc.perform(patch("/api/v1/rider-bike-contracts/{id}", UUID.fromString("11111111-1111-1111-1111-111111111111"))
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isMethodNotAllowed());
        mockMvc.perform(delete("/api/v1/rider-bike-contracts/{id}", UUID.fromString("11111111-1111-1111-1111-111111111111"))
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isMethodNotAllowed());
    }

    private org.springframework.test.web.servlet.RequestBuilder postContract(
            UUID riderId,
            UUID bikeId,
            UUID contractTemplateId,
            Instant startAt
    ) {
        return post("/api/v1/rider-bike-contracts")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {
                          "riderId":"%s",
                          "bikeId":"%s",
                          "contractTemplateId":"%s",
                          "startAt":"%s"
                        }
                        """.formatted(riderId, bikeId, contractTemplateId, startAt));
    }

    private void seedRider(UUID id, String name, String phoneNumber, String deletedAtSql) {
        String deletedAtExpression = deletedAtSql == null ? "null" : deletedAtSql;
        jdbcTemplate.update("""
                insert into riders (id, name, phone_number, app_account_linked, deleted_at)
                values (?, ?, ?, false, %s)
                """.formatted(deletedAtExpression), id, name, phoneNumber);
    }

    private void seedBike(UUID id, String plateNumber, String vin, String deletedAtSql) {
        String deletedAtExpression = deletedAtSql == null ? "null" : deletedAtSql;
        jdbcTemplate.update("""
                insert into bikes (id, plate_number, vin, operation_status, deleted_at)
                values (?, ?, ?, 'READY', %s)
                """.formatted(deletedAtExpression), id, plateNumber, vin);
    }

    private void seedTemplate(UUID id, String name, Integer durationMinutes, boolean enabled, String deletedAtSql) {
        String deletedAtExpression = deletedAtSql == null ? "null" : deletedAtSql;
        jdbcTemplate.update("""
                insert into contract_templates (id, name, duration_minutes, description, enabled, system_template, deleted_at)
                values (?, ?, ?, 'fixture template', ?, false, %s)
                """.formatted(deletedAtExpression), id, name, durationMinutes, enabled);
    }

    private void seedContract(
            UUID id,
            UUID riderId,
            UUID bikeId,
            UUID templateId,
            Instant startAt,
            Instant endAt,
            Instant terminatedAt,
            String deletedAtSql
    ) {
        String deletedAtExpression = deletedAtSql == null ? "null" : deletedAtSql;
        jdbcTemplate.update("""
                insert into rider_bike_contracts (
                    id, rider_id, bike_id, contract_template_id, start_at, end_at, terminated_at, deleted_at
                ) values (?, ?, ?, ?, ?, ?, ?, %s)
                """.formatted(deletedAtExpression),
                id,
                riderId,
                bikeId,
                templateId,
                Timestamp.from(startAt),
                endAt == null ? null : Timestamp.from(endAt),
                terminatedAt == null ? null : Timestamp.from(terminatedAt)
        );
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
