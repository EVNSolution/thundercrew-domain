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
 * Slice B: insurance category/coverage/period baseline. Validates the new
 * classification model + V8 seed presence + period lifecycle on rider-insurance
 * links. Existing {@code InsuranceItemCommandApiContractTests} keeps verifying
 * the legacy-create surface.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class InsuranceClassificationApiTests extends PostgresContainerSupport {

    private static final UUID ADMIN_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
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
        // Preserve V8 seed (`22222222-…`) so seed-presence tests keep working.
        jdbcTemplate.update("""
                delete from insurance_items
                where id not in (
                    '22222222-2222-2222-2222-000000000001',
                    '22222222-2222-2222-2222-000000000002',
                    '22222222-2222-2222-2222-000000000003',
                    '22222222-2222-2222-2222-000000000004'
                )
                """);
        jdbcTemplate.update("delete from riders");
        jdbcTemplate.update("delete from admin_users");
        jdbcTemplate.update("""
                insert into admin_users (id, login_id, email, password_hash, display_name, enabled)
                values (?, 'ops-admin', 'ops@example.test', ?, 'Ops Admin', true)
                """, ADMIN_ID, passwordEncoder.encode("correct-password"));
        accessToken = loginAndExtractToken();
    }

    @Test
    void migrationSeedRowsArePresent() throws Exception {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                select id, name, category, coverage_type, default_duration_unit, default_duration_value
                from insurance_items
                where deleted_at is null
                  and id like '22222222-2222-2222-2222-%'
                order by id asc
                """);

        assertThat(rows).hasSize(4);
        assertThat(rows.get(0).get("name")).isEqualTo("유상운송종합보험");
        assertThat(rows.get(0).get("category")).isEqualTo("PRIMARY");
        assertThat(rows.get(0).get("coverage_type")).isEqualTo("GENERAL_PAID_TRANSPORT");
        assertThat(rows.get(0).get("default_duration_unit")).isEqualTo("MONTH");
        assertThat(rows.get(0).get("default_duration_value")).isEqualTo(12);

        assertThat(rows.get(2).get("name")).isEqualTo("시간제보험");
        assertThat(rows.get(2).get("category")).isEqualTo("ADDON");
        assertThat(rows.get(2).get("coverage_type")).isEqualTo("HOURLY");
        assertThat(rows.get(2).get("default_duration_unit")).isEqualTo("HOUR");
    }

    @Test
    void createInsuranceItemAcceptsClassificationFields() throws Exception {
        mockMvc.perform(post("/api/v1/insurance-items")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name":"테스트 새 메인 보험",
                                  "description":"테스트",
                                  "enabled":true,
                                  "category":"PRIMARY",
                                  "coverageType":"LIABILITY_PAID_TRANSPORT",
                                  "defaultDurationUnit":"MONTH",
                                  "defaultDurationValue":12
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.category").value("PRIMARY"))
                .andExpect(jsonPath("$.coverageType").value("LIABILITY_PAID_TRANSPORT"))
                .andExpect(jsonPath("$.defaultDurationUnit").value("MONTH"))
                .andExpect(jsonPath("$.defaultDurationValue").value(12));
    }

    @Test
    void legacyCreatePayloadStillWorksAndDefaultsToPrimary() throws Exception {
        mockMvc.perform(post("/api/v1/insurance-items")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"테스트 레거시 보험","description":"기간/카테고리 미지정"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.category").value("PRIMARY"))
                .andExpect(jsonPath("$.coverageType").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.defaultDurationUnit").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.defaultDurationValue").value(org.hamcrest.Matchers.nullValue()));
    }

    @Test
    void createInsuranceItemRejectsHalfDurationField() throws Exception {
        mockMvc.perform(post("/api/v1/insurance-items")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name":"잘못된 기간 입력",
                                  "category":"ADDON",
                                  "defaultDurationUnit":"DAY"
                                }
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVALID_STATE_TRANSITION"));
    }

    @Test
    void updateChangesClassificationFields() throws Exception {
        MvcResult created = mockMvc.perform(post("/api/v1/insurance-items")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"테스트 수정 대상 보험"}
                                """))
                .andExpect(status().isCreated())
                .andReturn();
        String id = extractId(created);

        mockMvc.perform(patch("/api/v1/insurance-items/{id}", id)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "category":"ADDON",
                                  "coverageType":"ONE_DAY",
                                  "defaultDurationUnit":"DAY",
                                  "defaultDurationValue":1
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.category").value("ADDON"))
                .andExpect(jsonPath("$.coverageType").value("ONE_DAY"))
                .andExpect(jsonPath("$.defaultDurationUnit").value("DAY"))
                .andExpect(jsonPath("$.defaultDurationValue").value(1));
    }

    @Test
    void riderInsuranceLinkAcceptsPeriodAndContractPointer() throws Exception {
        UUID riderId = UUID.fromString("44444444-4444-4444-4444-444444444444");
        UUID insuranceItemId = UUID.fromString("22222222-2222-2222-2222-000000000001");
        UUID contractId = UUID.randomUUID();
        jdbcTemplate.update("""
                insert into riders (id, name, phone_number, app_account_linked)
                values (?, '테스트 라이더', '010-3000-4000', false)
                """, riderId);

        mockMvc.perform(post("/api/v1/rider-insurances")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "riderId":"%s",
                                  "insuranceItemId":"%s",
                                  "memo":"보험 발급",
                                  "startsAt":"2026-05-01T00:00:00Z",
                                  "endsAt":"2027-05-01T00:00:00Z",
                                  "riderBikeContractId":"%s"
                                }
                                """.formatted(riderId, insuranceItemId, contractId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.startsAt").value("2026-05-01T00:00:00Z"))
                .andExpect(jsonPath("$.endsAt").value("2027-05-01T00:00:00Z"))
                .andExpect(jsonPath("$.riderBikeContractId").value(contractId.toString()));
    }

    @Test
    void riderInsuranceLinkRejectsEndBeforeStart() throws Exception {
        UUID riderId = UUID.fromString("44444444-4444-4444-4444-444444444445");
        UUID insuranceItemId = UUID.fromString("22222222-2222-2222-2222-000000000003");
        jdbcTemplate.update("""
                insert into riders (id, name, phone_number, app_account_linked)
                values (?, '테스트 라이더 2', '010-3000-4001', false)
                """, riderId);

        mockMvc.perform(post("/api/v1/rider-insurances")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "riderId":"%s",
                                  "insuranceItemId":"%s",
                                  "startsAt":"2026-05-01T00:00:00Z",
                                  "endsAt":"2026-04-01T00:00:00Z"
                                }
                                """.formatted(riderId, insuranceItemId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVALID_STATE_TRANSITION"));
    }

    @Test
    void readResponseExposesNewClassificationFields() throws Exception {
        mockMvc.perform(get("/api/v1/insurance-items")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath(
                        "$.items[?(@.id=='22222222-2222-2222-2222-000000000001')].category")
                        .value(org.hamcrest.Matchers.contains("PRIMARY")))
                .andExpect(jsonPath(
                        "$.items[?(@.id=='22222222-2222-2222-2222-000000000003')].defaultDurationUnit")
                        .value(org.hamcrest.Matchers.contains("HOUR")));
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
