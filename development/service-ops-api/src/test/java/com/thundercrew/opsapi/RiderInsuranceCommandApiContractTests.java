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
import org.springframework.test.web.servlet.RequestBuilder;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class RiderInsuranceCommandApiContractTests extends PostgresContainerSupport {

    private static final UUID ADMIN_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final UUID RIDER_ID = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private static final UUID OTHER_RIDER_ID = UUID.fromString("cccccccc-cccc-cccc-cccc-cccccccccccc");
    private static final UUID INSURANCE_ITEM_ID = UUID.fromString("dddddddd-dddd-dddd-dddd-dddddddddddd");
    private static final UUID OTHER_INSURANCE_ITEM_ID = UUID.fromString("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee");
    private static final UUID RIDER_INSURANCE_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
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
        jdbcTemplate.update("delete from rider_insurances");
        jdbcTemplate.update("delete from insurance_items");
        jdbcTemplate.update("delete from riders");
        jdbcTemplate.update("delete from admin_users");
        jdbcTemplate.update("""
                insert into admin_users (id, login_id, email, password_hash, display_name, enabled)
                values (?, 'ops-admin', 'ops@example.test', ?, 'Ops Admin', true)
                """, ADMIN_ID, passwordEncoder.encode("correct-password"));
        accessToken = loginAndExtractToken();
    }

    @Test
    void createRiderInsuranceGeneratesIdentifiersIgnoresSystemFieldsAndUsesSelectorReferences() throws Exception {
        seedRider(RIDER_ID, false);
        seedInsuranceItem(INSURANCE_ITEM_ID, "기본 보험", true, null);
        String clientSuppliedId = "99999999-9999-9999-9999-999999999999";

        MvcResult result = mockMvc.perform(post("/api/v1/rider-insurances")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "id":"%s",
                                  "idx":999,
                                  "riderId":"%s",
                                  "insuranceItemId":"%s",
                                  "memo":"상담 후 연결",
                                  "enabled":true,
                                  "deletedAt":"2026-01-01T00:00:00Z"
                                }
                                """.formatted(clientSuppliedId, RIDER_ID, INSURANCE_ITEM_ID)))
                .andExpect(status().isCreated())
                .andExpect(header().string(HttpHeaders.LOCATION, org.hamcrest.Matchers.startsWith("/api/v1/rider-insurances/")))
                .andExpect(jsonPath("$.id").isString())
                .andExpect(jsonPath("$.id").value(org.hamcrest.Matchers.not(clientSuppliedId)))
                .andExpect(jsonPath("$.idx").isNumber())
                .andExpect(jsonPath("$.riderId").value(RIDER_ID.toString()))
                .andExpect(jsonPath("$.insuranceItemId").value(INSURANCE_ITEM_ID.toString()))
                .andExpect(jsonPath("$.memo").value("상담 후 연결"))
                .andExpect(jsonPath("$.enabled").value(true))
                .andReturn();

        mockMvc.perform(get("/api/v1/rider-insurances/{id}", extractId(result))
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.riderId").value(RIDER_ID.toString()))
                .andExpect(jsonPath("$.insuranceItemId").value(INSURANCE_ITEM_ID.toString()));
    }

    @Test
    void createRiderInsuranceValidatesRequiredFieldsAndReferences() throws Exception {
        seedRider(RIDER_ID, false);
        seedRider(OTHER_RIDER_ID, true);
        seedInsuranceItem(INSURANCE_ITEM_ID, "기본 보험", true, null);
        seedInsuranceItem(OTHER_INSURANCE_ITEM_ID, "삭제 보험", true, "now()");
        UUID disabledItemId = UUID.fromString("33333333-3333-3333-3333-333333333333");
        seedInsuranceItem(disabledItemId, "비활성 보험", false, null);

        mockMvc.perform(post("/api/v1/rider-insurances")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));

        mockMvc.perform(postCreateRequest(UUID.fromString("44444444-4444-4444-4444-444444444444"), INSURANCE_ITEM_ID, "missing rider"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("REFERENCE_NOT_FOUND"));
        mockMvc.perform(postCreateRequest(OTHER_RIDER_ID, INSURANCE_ITEM_ID, "deleted rider"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("REFERENCE_DELETED"));
        mockMvc.perform(postCreateRequest(RIDER_ID, UUID.fromString("55555555-5555-5555-5555-555555555555"), "missing item"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("REFERENCE_NOT_FOUND"));
        mockMvc.perform(postCreateRequest(RIDER_ID, OTHER_INSURANCE_ITEM_ID, "deleted item"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("REFERENCE_DELETED"));
        mockMvc.perform(postCreateRequest(RIDER_ID, disabledItemId, "disabled item"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVALID_STATE_TRANSITION"));
    }

    @Test
    void createRiderInsuranceRejectsDuplicatePairUntilDeleted() throws Exception {
        seedRider(RIDER_ID, false);
        seedInsuranceItem(INSURANCE_ITEM_ID, "기본 보험", true, null);
        seedRiderInsurance(RIDER_INSURANCE_ID, RIDER_ID, INSURANCE_ITEM_ID, true, null);

        mockMvc.perform(postCreateRequest(RIDER_ID, INSURANCE_ITEM_ID, "duplicate"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DUPLICATE_ACTIVE_RESOURCE"));

        mockMvc.perform(delete("/api/v1/rider-insurances/{id}", RIDER_INSURANCE_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isNoContent());

        mockMvc.perform(postCreateRequest(RIDER_ID, INSURANCE_ITEM_ID, "relinked"))
                .andExpect(status().isCreated());
    }

    @Test
    void updateRiderInsuranceChangesMemoAndEnabledWithoutMovingSelectedReferences() throws Exception {
        seedRider(RIDER_ID, false);
        seedRider(OTHER_RIDER_ID, false);
        seedInsuranceItem(INSURANCE_ITEM_ID, "기본 보험", true, null);
        seedInsuranceItem(OTHER_INSURANCE_ITEM_ID, "다른 보험", true, null);
        seedRiderInsurance(RIDER_INSURANCE_ID, RIDER_ID, INSURANCE_ITEM_ID, true, null);
        Long originalIdx = jdbcTemplate.queryForObject("select idx from rider_insurances where id = ?", Long.class, RIDER_INSURANCE_ID);

        mockMvc.perform(patch("/api/v1/rider-insurances/{id}", RIDER_INSURANCE_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "id":"99999999-9999-9999-9999-999999999999",
                                  "idx":999,
                                  "riderId":"%s",
                                  "insuranceItemId":"%s",
                                  "memo":"갱신된 메모",
                                  "enabled":false,
                                  "deletedAt":"2026-01-01T00:00:00Z"
                                }
                                """.formatted(OTHER_RIDER_ID, OTHER_INSURANCE_ITEM_ID)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(RIDER_INSURANCE_ID.toString()))
                .andExpect(jsonPath("$.idx").value(originalIdx))
                .andExpect(jsonPath("$.riderId").value(RIDER_ID.toString()))
                .andExpect(jsonPath("$.insuranceItemId").value(INSURANCE_ITEM_ID.toString()))
                .andExpect(jsonPath("$.memo").value("갱신된 메모"))
                .andExpect(jsonPath("$.enabled").value(false));

        Boolean stillNotDeleted = jdbcTemplate.queryForObject("select deleted_at is null from rider_insurances where id = ?", Boolean.class, RIDER_INSURANCE_ID);
        assertThat(stillNotDeleted).isTrue();

        mockMvc.perform(patch("/api/v1/rider-insurances/{id}", UUID.fromString("66666666-6666-6666-6666-666666666666"))
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"memo":"missing"}
                                """))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"));
    }

    @Test
    void updateRiderInsuranceReenableRevalidatesExistingReferences() throws Exception {
        seedRider(RIDER_ID, false);
        seedInsuranceItem(INSURANCE_ITEM_ID, "기본 보험", true, null);
        seedRiderInsurance(RIDER_INSURANCE_ID, RIDER_ID, INSURANCE_ITEM_ID, false, null);

        jdbcTemplate.update("update riders set deleted_at = now() where id = ?", RIDER_ID);
        mockMvc.perform(patch("/api/v1/rider-insurances/{id}", RIDER_INSURANCE_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"enabled":true}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("REFERENCE_DELETED"));

        jdbcTemplate.update("update riders set deleted_at = null where id = ?", RIDER_ID);
        jdbcTemplate.update("update insurance_items set deleted_at = now() where id = ?", INSURANCE_ITEM_ID);
        mockMvc.perform(patch("/api/v1/rider-insurances/{id}", RIDER_INSURANCE_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"enabled":true}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("REFERENCE_DELETED"));

        jdbcTemplate.update("update insurance_items set deleted_at = null, enabled = false where id = ?", INSURANCE_ITEM_ID);
        mockMvc.perform(patch("/api/v1/rider-insurances/{id}", RIDER_INSURANCE_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"enabled":true}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVALID_STATE_TRANSITION"));

        jdbcTemplate.update("update insurance_items set enabled = true where id = ?", INSURANCE_ITEM_ID);
        mockMvc.perform(patch("/api/v1/rider-insurances/{id}", RIDER_INSURANCE_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"enabled":true}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(true));
    }

    @Test
    void deleteRiderInsuranceSoftDeletesDisablesPreservesHistoryAndAllowsPairReuse() throws Exception {
        seedRider(RIDER_ID, false);
        seedInsuranceItem(INSURANCE_ITEM_ID, "기본 보험", true, null);
        seedRiderInsurance(RIDER_INSURANCE_ID, RIDER_ID, INSURANCE_ITEM_ID, true, null);

        mockMvc.perform(delete("/api/v1/rider-insurances/{id}", RIDER_INSURANCE_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isNoContent());

        Boolean enabled = jdbcTemplate.queryForObject("select enabled from rider_insurances where id = ?", Boolean.class, RIDER_INSURANCE_ID);
        Boolean deleted = jdbcTemplate.queryForObject("select deleted_at is not null from rider_insurances where id = ?", Boolean.class, RIDER_INSURANCE_ID);
        assertThat(enabled).isFalse();
        assertThat(deleted).isTrue();

        mockMvc.perform(get("/api/v1/rider-insurances/{id}", RIDER_INSURANCE_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isNotFound());
        mockMvc.perform(postCreateRequest(RIDER_ID, INSURANCE_ITEM_ID, "recreated"))
                .andExpect(status().isCreated());
    }

    @Test
    void commandRequestsRequireBearerAuthentication() throws Exception {
        mockMvc.perform(post("/api/v1/rider-insurances").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("AUTHENTICATION_FAILED"));
        mockMvc.perform(patch("/api/v1/rider-insurances/{id}", RIDER_INSURANCE_ID).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("AUTHENTICATION_FAILED"));
        mockMvc.perform(delete("/api/v1/rider-insurances/{id}", RIDER_INSURANCE_ID))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("AUTHENTICATION_FAILED"));
    }

    private RequestBuilder postCreateRequest(UUID riderId, UUID insuranceItemId, String memo) {
        return post("/api/v1/rider-insurances")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {
                          "riderId":"%s",
                          "insuranceItemId":"%s",
                          "memo":"%s",
                          "enabled":true
                        }
                        """.formatted(riderId, insuranceItemId, memo));
    }

    private void seedRider(UUID id, boolean deleted) {
        jdbcTemplate.update("""
                insert into riders (id, name, phone_number, app_account_linked, deleted_at)
                values (?, '보험 라이더', ?, false, %s)
                """.formatted(deleted ? "now()" : "null"), id, "010-" + id.toString().substring(0, 4) + "-0000");
    }

    private void seedInsuranceItem(UUID id, String name, boolean enabled, String deletedAtSql) {
        String deletedAtExpression = deletedAtSql == null ? "null" : deletedAtSql;
        jdbcTemplate.update("""
                insert into insurance_items (id, name, description, enabled, deleted_at)
                values (?, ?, 'fixture insurance', ?, %s)
                """.formatted(deletedAtExpression), id, name, enabled);
    }

    private void seedRiderInsurance(UUID id, UUID riderId, UUID insuranceItemId, boolean enabled, String deletedAtSql) {
        String deletedAtExpression = deletedAtSql == null ? "null" : deletedAtSql;
        jdbcTemplate.update("""
                insert into rider_insurances (id, rider_id, insurance_item_id, memo, enabled, deleted_at)
                values (?, ?, ?, 'fixture rider insurance', ?, %s)
                """.formatted(deletedAtExpression), id, riderId, insuranceItemId, enabled);
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
        Matcher matcher = Pattern.compile("\"id\"\\s*:\\s*\"([^\"]+)\"").matcher(result.getResponse().getContentAsString());
        assertThat(matcher.find()).isTrue();
        return matcher.group(1);
    }
}
