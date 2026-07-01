package com.thundercrew.opsapi;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Map;
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

/**
 * Slice A: contract template category, return type, duration unit, and the
 * package-with-insurance flag. Validates the new business rules layered on
 * top of the existing legacy API surface (which is still verified by
 * {@code ContractTemplateCommandApiContractTests}).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ContractTemplateClassificationApiTests extends PostgresContainerSupport {

    private static final UUID ADMIN_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final UUID DEFAULT_INSURANCE_ITEM_ID = UUID.fromString("dddddddd-dddd-dddd-dddd-aaaaaaaaaaaa");
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
        // V7 seed rows live with system_template = false; preserve them for
        // tests that assert on seed presence and reset only operator-created
        // rows by using a non-overlapping name predicate.
        jdbcTemplate.update("""
                delete from contract_templates
                where system_template = false
                  and id not in (
                      '11111111-1111-1111-1111-000000000001',
                      '11111111-1111-1111-1111-000000000002',
                      '11111111-1111-1111-1111-000000000003',
                      '11111111-1111-1111-1111-000000000004',
                      '11111111-1111-1111-1111-000000000005',
                      '11111111-1111-1111-1111-000000000006',
                      '11111111-1111-1111-1111-000000000007',
                      '11111111-1111-1111-1111-000000000008'
                  )
                """);
        jdbcTemplate.update("delete from admin_users");
        jdbcTemplate.update("""
                insert into admin_users (id, login_id, email, password_hash, display_name, enabled)
                values (?, 'ops-admin', 'ops@example.test', ?, 'Ops Admin', true)
                """, ADMIN_ID, passwordEncoder.encode("correct-password"));
        accessToken = loginAndExtractToken();
    }

    @Test
    void subscriptionTemplateAcceptsMonth12WithReturnTypeAndInsurance() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/contract-templates")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name":"테스트 12개월 구독·인수형·보험포함",
                                  "category":"SUBSCRIPTION",
                                  "returnType":"TAKEOVER",
                                  "durationUnit":"MONTH",
                                  "durationValue":12,
                                  "includesInsurance":true,
                                  "defaultInsuranceItemId":"%s"
                                }
                                """.formatted(DEFAULT_INSURANCE_ITEM_ID)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.category").value("SUBSCRIPTION"))
                .andExpect(jsonPath("$.returnType").value("TAKEOVER"))
                .andExpect(jsonPath("$.durationUnit").value("MONTH"))
                .andExpect(jsonPath("$.durationValue").value(12))
                .andExpect(jsonPath("$.includesInsurance").value(true))
                .andExpect(jsonPath("$.defaultInsuranceItemId").value(DEFAULT_INSURANCE_ITEM_ID.toString()))
                .andExpect(jsonPath("$.durationMinutes").value(12 * 30 * 1440))
                .andReturn();
        assertThat(result.getResponse().getStatus()).isEqualTo(201);
    }

    @Test
    void subscriptionTemplateRejectsNonMonth12Combinations() throws Exception {
        mockMvc.perform(post("/api/v1/contract-templates")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name":"잘못된 구독·일단위",
                                  "category":"SUBSCRIPTION",
                                  "returnType":"TAKEOVER",
                                  "durationUnit":"DAY",
                                  "durationValue":30
                                }
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVALID_STATE_TRANSITION"));

        mockMvc.perform(post("/api/v1/contract-templates")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name":"잘못된 구독·6개월",
                                  "category":"SUBSCRIPTION",
                                  "returnType":"RETURN",
                                  "durationUnit":"MONTH",
                                  "durationValue":6
                                }
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVALID_STATE_TRANSITION"));
    }

    @Test
    void subscriptionTemplateRejectsMissingReturnType() throws Exception {
        mockMvc.perform(post("/api/v1/contract-templates")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name":"잘못된 구독·반환유형 누락",
                                  "category":"SUBSCRIPTION",
                                  "durationUnit":"MONTH",
                                  "durationValue":12
                                }
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVALID_STATE_TRANSITION"));
    }

    @Test
    void rentalTemplateAcceptsAllowedUnitsAndRejectsYear() throws Exception {
        mockMvc.perform(post("/api/v1/contract-templates")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name":"테스트 일단위 렌탈",
                                  "category":"RENTAL",
                                  "returnType":"RETURN",
                                  "durationUnit":"DAY",
                                  "durationValue":7
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.category").value("RENTAL"))
                .andExpect(jsonPath("$.durationUnit").value("DAY"))
                .andExpect(jsonPath("$.durationValue").value(7))
                .andExpect(jsonPath("$.includesInsurance").value(false));

        mockMvc.perform(post("/api/v1/contract-templates")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name":"잘못된 렌탈·년단위",
                                  "category":"RENTAL",
                                  "returnType":"TAKEOVER",
                                  "durationUnit":"YEAR",
                                  "durationValue":1
                                }
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVALID_STATE_TRANSITION"));

        mockMvc.perform(post("/api/v1/contract-templates")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name":"잘못된 렌탈·기간없음",
                                  "category":"RENTAL",
                                  "returnType":"RETURN",
                                  "durationUnit":"WEEK"
                                }
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVALID_STATE_TRANSITION"));
    }

    @Test
    void includesInsuranceRequiresDefaultInsuranceItemId() throws Exception {
        mockMvc.perform(post("/api/v1/contract-templates")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name":"잘못된 구독·보험포함·보험없음",
                                  "category":"SUBSCRIPTION",
                                  "returnType":"TAKEOVER",
                                  "durationUnit":"MONTH",
                                  "durationValue":12,
                                  "includesInsurance":true
                                }
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVALID_STATE_TRANSITION"));
    }

    @Test
    void migrationSeedRowsArePresent() throws Exception {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                select id, name, category, return_type, duration_unit, duration_value, includes_insurance
                from contract_templates
                where deleted_at is null and system_template = false
                  and id like '11111111-1111-1111-1111-%'
                order by id asc
                """);

        assertThat(rows).hasSize(8);
        assertThat(rows.get(0).get("category")).isEqualTo("SUBSCRIPTION");
        assertThat(rows.get(0).get("return_type")).isEqualTo("TAKEOVER");
        assertThat(rows.get(0).get("duration_unit")).isEqualTo("MONTH");
        assertThat(rows.get(0).get("duration_value")).isEqualTo(12);
        assertThat(rows.get(0).get("includes_insurance")).isEqualTo(true);

        assertThat(rows.get(4).get("category")).isEqualTo("RENTAL");
        assertThat(rows.get(4).get("duration_unit")).isEqualTo("DAY");
        assertThat(rows.get(4).get("includes_insurance")).isEqualTo(false);
    }

    @Test
    void legacyDurationMinutesPayloadStillCreatesCustomTemplate() throws Exception {
        mockMvc.perform(post("/api/v1/contract-templates")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"테스트 레거시 17280분","durationMinutes":17280}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.category").value("CUSTOM"))
                .andExpect(jsonPath("$.returnType").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.durationUnit").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.durationValue").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.durationMinutes").value(17280))
                .andExpect(jsonPath("$.includesInsurance").value(false));
    }

    @Test
    void updateChangesCategoryAndStructuredDuration() throws Exception {
        // Create RENTAL first.
        MvcResult created = mockMvc.perform(post("/api/v1/contract-templates")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name":"테스트 일단위 렌탈 (수정 대상)",
                                  "category":"RENTAL",
                                  "returnType":"RETURN",
                                  "durationUnit":"DAY",
                                  "durationValue":3
                                }
                                """))
                .andExpect(status().isCreated())
                .andReturn();

        String id = extractId(created);

        // Promote to SUBSCRIPTION with valid MONTH/12.
        mockMvc.perform(patch("/api/v1/contract-templates/{id}", id)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "category":"SUBSCRIPTION",
                                  "returnType":"TAKEOVER",
                                  "durationUnit":"MONTH",
                                  "durationValue":12
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.category").value("SUBSCRIPTION"))
                .andExpect(jsonPath("$.returnType").value("TAKEOVER"))
                .andExpect(jsonPath("$.durationUnit").value("MONTH"))
                .andExpect(jsonPath("$.durationValue").value(12));

        // Try inconsistent SUBSCRIPTION change — must reject.
        mockMvc.perform(patch("/api/v1/contract-templates/{id}", id)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"durationUnit":"DAY","durationValue":30}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVALID_STATE_TRANSITION"));
    }

    @Test
    void readResponseExposesNewClassificationFields() throws Exception {
        mockMvc.perform(get("/api/v1/contract-templates")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[?(@.id=='11111111-1111-1111-1111-000000000001')].category").value(
                        org.hamcrest.Matchers.contains("SUBSCRIPTION")))
                .andExpect(jsonPath("$.items[?(@.id=='11111111-1111-1111-1111-000000000005')].durationUnit").value(
                        org.hamcrest.Matchers.contains("DAY")));
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
