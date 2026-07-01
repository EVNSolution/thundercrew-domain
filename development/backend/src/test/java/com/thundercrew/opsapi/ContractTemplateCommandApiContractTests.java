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
class ContractTemplateCommandApiContractTests extends PostgresContainerSupport {

    private static final UUID ADMIN_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final UUID SYSTEM_TEMPLATE_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID TEMPLATE_ID = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
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
        jdbcTemplate.update("delete from contract_templates where system_template = false");
        jdbcTemplate.update("delete from admin_users");
        jdbcTemplate.update("""
                insert into admin_users (id, login_id, email, password_hash, display_name, enabled)
                values (?, 'ops-admin', 'ops@example.test', ?, 'Ops Admin', true)
                """, ADMIN_ID, passwordEncoder.encode("correct-password"));
        accessToken = loginAndExtractToken();
    }

    @Test
    void createTemplateGeneratesIdentifiersAndIgnoresClientSuppliedSystemFields() throws Exception {
        String clientSuppliedId = "99999999-9999-9999-9999-999999999999";

        MvcResult result = mockMvc.perform(post("/api/v1/contract-templates")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "id":"%s",
                                  "idx":999,
                                  "name":"12일 계약",
                                  "durationMinutes":17280,
                                  "description":"12일 운영 계약",
                                  "enabled":true,
                                  "systemTemplate":true,
                                  "deletedAt":"2026-01-01T00:00:00Z"
                                }
                                """.formatted(clientSuppliedId)))
                .andExpect(status().isCreated())
                .andExpect(header().string(HttpHeaders.LOCATION, org.hamcrest.Matchers.startsWith("/api/v1/contract-templates/")))
                .andExpect(jsonPath("$.id").isString())
                .andExpect(jsonPath("$.id").value(org.hamcrest.Matchers.not(clientSuppliedId)))
                .andExpect(jsonPath("$.idx").isNumber())
                .andExpect(jsonPath("$.name").value("12일 계약"))
                .andExpect(jsonPath("$.durationMinutes").value(17280))
                .andExpect(jsonPath("$.unlimited").value(false))
                .andExpect(jsonPath("$.description").value("12일 운영 계약"))
                .andExpect(jsonPath("$.enabled").value(true))
                .andExpect(jsonPath("$.systemTemplate").value(false))
                .andReturn();

        String createdId = extractId(result);
        mockMvc.perform(get("/api/v1/contract-templates/{id}", createdId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("12일 계약"));
    }

    @Test
    void createTemplateAllowsUnlimitedDurationWhenDurationMinutesIsNull() throws Exception {
        mockMvc.perform(post("/api/v1/contract-templates")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"무제한 현장 계약","durationMinutes":null,"description":"기간 제한 없음"}
                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.durationMinutes").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.unlimited").value(true))
                .andExpect(jsonPath("$.enabled").value(true))
                .andExpect(jsonPath("$.systemTemplate").value(false));
    }

    @Test
    void createTemplateRejectsMissingNameOrInvalidDuration() throws Exception {
        mockMvc.perform(post("/api/v1/contract-templates")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"","durationMinutes":0}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldViolations").isArray());
    }

    @Test
    void createTemplateRejectsDuplicateActiveName() throws Exception {
        seedTemplate(TEMPLATE_ID, "표준 12일", 17280, false, true, null);

        mockMvc.perform(post("/api/v1/contract-templates")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"표준 12일","durationMinutes":17280}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DUPLICATE_ACTIVE_RESOURCE"));
    }

    @Test
    void updateTemplateChangesHumanManagedFieldsAndIgnoresSystemFields() throws Exception {
        seedTemplate(TEMPLATE_ID, "표준 12일", 17280, false, true, null);

        mockMvc.perform(patch("/api/v1/contract-templates/{id}", TEMPLATE_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "id":"99999999-9999-9999-9999-999999999999",
                                  "idx":999,
                                  "name":"표준 13일",
                                  "durationMinutes":18720,
                                  "description":"13일 계약",
                                  "enabled":false,
                                  "systemTemplate":true,
                                  "deletedAt":"2026-01-01T00:00:00Z"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(TEMPLATE_ID.toString()))
                .andExpect(jsonPath("$.name").value("표준 13일"))
                .andExpect(jsonPath("$.durationMinutes").value(18720))
                .andExpect(jsonPath("$.description").value("13일 계약"))
                .andExpect(jsonPath("$.enabled").value(false))
                .andExpect(jsonPath("$.systemTemplate").value(false));
    }

    @Test
    void updateTemplateCanExplicitlySetDurationToUnlimited() throws Exception {
        seedTemplate(TEMPLATE_ID, "표준 12일", 17280, false, true, null);

        mockMvc.perform(patch("/api/v1/contract-templates/{id}", TEMPLATE_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"durationMinutes":null}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(TEMPLATE_ID.toString()))
                .andExpect(jsonPath("$.name").value("표준 12일"))
                .andExpect(jsonPath("$.durationMinutes").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.unlimited").value(true));
    }

    @Test
    void updateTemplateRejectsMissingOrDuplicateTargets() throws Exception {
        seedTemplate(TEMPLATE_ID, "표준 12일", 17280, false, true, null);
        UUID otherId = UUID.fromString("cccccccc-cccc-cccc-cccc-cccccccccccc");
        seedTemplate(otherId, "표준 13일", 18720, false, true, null);

        mockMvc.perform(patch("/api/v1/contract-templates/{id}", UUID.fromString("dddddddd-dddd-dddd-dddd-dddddddddddd"))
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"없음"}
                                """))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"));

        mockMvc.perform(patch("/api/v1/contract-templates/{id}", TEMPLATE_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"표준 13일"}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DUPLICATE_ACTIVE_RESOURCE"));
    }

    @Test
    void systemTemplateCannotBeUpdatedOrDeleted() throws Exception {
        mockMvc.perform(patch("/api/v1/contract-templates/{id}", SYSTEM_TEMPLATE_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"시스템 변경 시도","enabled":false}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVALID_STATE_TRANSITION"));

        mockMvc.perform(delete("/api/v1/contract-templates/{id}", SYSTEM_TEMPLATE_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVALID_STATE_TRANSITION"));
    }

    @Test
    void deleteTemplateSoftDeletesAndAllowsNameReuse() throws Exception {
        seedTemplate(TEMPLATE_ID, "표준 12일", 17280, false, true, null);

        mockMvc.perform(delete("/api/v1/contract-templates/{id}", TEMPLATE_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/contract-templates/{id}", TEMPLATE_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isNotFound());

        mockMvc.perform(post("/api/v1/contract-templates")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"표준 12일","durationMinutes":17280}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("표준 12일"));
    }

    @Test
    void commandRequestsRequireBearerAuthentication() throws Exception {
        mockMvc.perform(post("/api/v1/contract-templates")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"무인증 계약","durationMinutes":1440}
                                """))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_FAILED"));

        mockMvc.perform(patch("/api/v1/contract-templates/{id}", TEMPLATE_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"무인증 수정"}
                                """))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_FAILED"));

        mockMvc.perform(delete("/api/v1/contract-templates/{id}", TEMPLATE_ID))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_FAILED"));
    }

    private void seedTemplate(
            UUID id,
            String name,
            Integer durationMinutes,
            boolean systemTemplate,
            boolean enabled,
            String deletedAtSql
    ) {
        String deletedAtExpression = deletedAtSql == null ? "null" : deletedAtSql;
        jdbcTemplate.update("""
                insert into contract_templates (id, name, duration_minutes, description, enabled, system_template, deleted_at)
                values (?, ?, ?, 'fixture template', ?, ?, %s)
                """.formatted(deletedAtExpression), id, name, durationMinutes, enabled, systemTemplate);
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
