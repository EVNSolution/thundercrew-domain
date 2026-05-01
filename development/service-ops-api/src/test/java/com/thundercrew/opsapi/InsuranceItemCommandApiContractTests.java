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
class InsuranceItemCommandApiContractTests extends PostgresContainerSupport {

    private static final UUID ADMIN_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final UUID INSURANCE_ITEM_ID = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private static final UUID RIDER_ID = UUID.fromString("cccccccc-cccc-cccc-cccc-cccccccccccc");
    private static final UUID RIDER_INSURANCE_ID = UUID.fromString("dddddddd-dddd-dddd-dddd-dddddddddddd");
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
    void createInsuranceItemGeneratesIdentifiersAndIgnoresClientSuppliedSystemFields() throws Exception {
        String clientSuppliedId = "99999999-9999-9999-9999-999999999999";

        MvcResult result = mockMvc.perform(post("/api/v1/insurance-items")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "id":"%s",
                                  "idx":999,
                                  "name":"기본 보험",
                                  "description":"운영자 관리 보험명",
                                  "enabled":true,
                                  "deletedAt":"2026-01-01T00:00:00Z",
                                  "riderId":"11111111-1111-1111-1111-111111111111"
                                }
                                """.formatted(clientSuppliedId)))
                .andExpect(status().isCreated())
                .andExpect(header().string(HttpHeaders.LOCATION, org.hamcrest.Matchers.startsWith("/api/v1/insurance-items/")))
                .andExpect(jsonPath("$.id").isString())
                .andExpect(jsonPath("$.id").value(org.hamcrest.Matchers.not(clientSuppliedId)))
                .andExpect(jsonPath("$.idx").isNumber())
                .andExpect(jsonPath("$.name").value("기본 보험"))
                .andExpect(jsonPath("$.description").value("운영자 관리 보험명"))
                .andExpect(jsonPath("$.enabled").value(true))
                .andReturn();

        mockMvc.perform(get("/api/v1/insurance-items/{id}", extractId(result))
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("기본 보험"));
    }

    @Test
    void createInsuranceItemRejectsMissingNameAndDuplicateActiveName() throws Exception {
        mockMvc.perform(post("/api/v1/insurance-items")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":""}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldViolations").isArray());

        seedInsuranceItem(INSURANCE_ITEM_ID, "화재 보험", true, null);
        mockMvc.perform(post("/api/v1/insurance-items")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"화재 보험"}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DUPLICATE_ACTIVE_RESOURCE"));
    }

    @Test
    void updateInsuranceItemChangesOperatorFieldsAndRejectsMissingOrDuplicateTargets() throws Exception {
        seedInsuranceItem(INSURANCE_ITEM_ID, "유상운송 보험", true, null);
        UUID otherId = UUID.fromString("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee");
        seedInsuranceItem(otherId, "책임 보험", true, null);
        Long originalIdx = jdbcTemplate.queryForObject("select idx from insurance_items where id = ?", Long.class, INSURANCE_ITEM_ID);

        mockMvc.perform(patch("/api/v1/insurance-items/{id}", INSURANCE_ITEM_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "id":"11111111-1111-1111-1111-111111111111",
                                  "idx":999,
                                  "name":"유상운송 종합보험",
                                  "description":"수정된 보험 설명",
                                  "enabled":false,
                                  "deletedAt":"2026-01-01T00:00:00Z"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(INSURANCE_ITEM_ID.toString()))
                .andExpect(jsonPath("$.idx").value(originalIdx))
                .andExpect(jsonPath("$.name").value("유상운송 종합보험"))
                .andExpect(jsonPath("$.description").value("수정된 보험 설명"))
                .andExpect(jsonPath("$.enabled").value(false));

        Boolean stillNotDeleted = jdbcTemplate.queryForObject("select deleted_at is null from insurance_items where id = ?", Boolean.class, INSURANCE_ITEM_ID);
        assertThat(stillNotDeleted).isTrue();

        UUID missingId = UUID.fromString("11111111-1111-1111-1111-111111111111");
        mockMvc.perform(patch("/api/v1/insurance-items/{id}", missingId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"없는 보험"}
                                """))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"));

        mockMvc.perform(patch("/api/v1/insurance-items/{id}", INSURANCE_ITEM_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"책임 보험"}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DUPLICATE_ACTIVE_RESOURCE"));
    }

    @Test
    void deleteInsuranceItemSoftDeletesDisablesAllowsNameReuseAndBlocksEnabledLinksOnly() throws Exception {
        seedInsuranceItem(INSURANCE_ITEM_ID, "라이더 보험", true, null);
        seedRider(RIDER_ID);
        seedRiderInsurance(RIDER_INSURANCE_ID, RIDER_ID, INSURANCE_ITEM_ID, true, null);

        mockMvc.perform(delete("/api/v1/insurance-items/{id}", INSURANCE_ITEM_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVALID_STATE_TRANSITION"));

        jdbcTemplate.update("update rider_insurances set enabled = false where id = ?", RIDER_INSURANCE_ID);
        mockMvc.perform(delete("/api/v1/insurance-items/{id}", INSURANCE_ITEM_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isNoContent());

        Boolean enabled = jdbcTemplate.queryForObject("select enabled from insurance_items where id = ?", Boolean.class, INSURANCE_ITEM_ID);
        Boolean deleted = jdbcTemplate.queryForObject("select deleted_at is not null from insurance_items where id = ?", Boolean.class, INSURANCE_ITEM_ID);
        assertThat(enabled).isFalse();
        assertThat(deleted).isTrue();

        mockMvc.perform(get("/api/v1/insurance-items/{id}", INSURANCE_ITEM_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isNotFound());

        mockMvc.perform(post("/api/v1/insurance-items")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"라이더 보험"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("라이더 보험"));
    }

    @Test
    void commandRequestsRequireBearerAuthentication() throws Exception {
        mockMvc.perform(post("/api/v1/insurance-items").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_FAILED"));
        mockMvc.perform(patch("/api/v1/insurance-items/{id}", INSURANCE_ITEM_ID).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_FAILED"));
        mockMvc.perform(delete("/api/v1/insurance-items/{id}", INSURANCE_ITEM_ID))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_FAILED"));
    }

    private void seedInsuranceItem(UUID id, String name, boolean enabled, String deletedAtSql) {
        String deletedAtExpression = deletedAtSql == null ? "null" : deletedAtSql;
        jdbcTemplate.update("""
                insert into insurance_items (id, name, description, enabled, deleted_at)
                values (?, ?, 'fixture insurance', ?, %s)
                """.formatted(deletedAtExpression), id, name, enabled);
    }

    private void seedRider(UUID id) {
        jdbcTemplate.update("""
                insert into riders (id, name, phone_number, app_account_linked)
                values (?, '보험 라이더', ?, false)
                """, id, "010-" + id.toString().substring(0, 4) + "-0000");
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
