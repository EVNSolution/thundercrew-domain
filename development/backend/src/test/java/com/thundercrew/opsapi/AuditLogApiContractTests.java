package com.thundercrew.opsapi;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.assertj.core.api.Assertions;
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
class AuditLogApiContractTests extends PostgresContainerSupport {

    private static final UUID ADMIN_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final UUID ENTITY_ID = UUID.fromString("cccccccc-cccc-cccc-cccc-cccccccccccc");
    private static final UUID OTHER_ENTITY_ID = UUID.fromString("dddddddd-dddd-dddd-dddd-dddddddddddd");

    private static final Pattern ACCESS_TOKEN_PATTERN =
            Pattern.compile("\\\"accessToken\\\"\\s*:\\s*\\\"([^\\\"]+)\\\"");

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
        jdbcTemplate.update("delete from audit_logs");
        jdbcTemplate.update("delete from admin_users");

        jdbcTemplate.update("""
                insert into admin_users (id, login_id, email, password_hash, display_name, enabled)
                values (?, 'ops-admin', 'ops@example.test', ?, 'Ops Admin', true)
                """, ADMIN_ID, passwordEncoder.encode("correct-password"));

        accessToken = loginAndExtractToken();
    }

    // ① POST /api/v1/audit-logs → 201, fields persisted
    @Test
    void postReturns201WithAllFields() throws Exception {
        mockMvc.perform(post("/api/v1/audit-logs")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "entityType": "bike",
                                  "entityId": "%s",
                                  "field": "operationStatus",
                                  "oldValue": "IDLE",
                                  "newValue": "IN_USE"
                                }
                                """.formatted(ENTITY_ID)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isString())
                .andExpect(jsonPath("$.idx").isNumber())
                .andExpect(jsonPath("$.entityType").value("bike"))
                .andExpect(jsonPath("$.entityId").value(ENTITY_ID.toString()))
                .andExpect(jsonPath("$.field").value("operationStatus"))
                .andExpect(jsonPath("$.oldValue").value("IDLE"))
                .andExpect(jsonPath("$.newValue").value("IN_USE"))
                .andExpect(jsonPath("$.occurredAt").isString())
                .andExpect(jsonPath("$.createdAt").isString());
    }

    // ② POST then GET returns it in list
    @Test
    void getListReturnsPostedEntry() throws Exception {
        mockMvc.perform(post("/api/v1/audit-logs")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "entityType": "bike",
                                  "entityId": "%s",
                                  "field": "insuranceStatus",
                                  "oldValue": "ACTIVE",
                                  "newValue": "EXPIRED"
                                }
                                """.formatted(ENTITY_ID)))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/v1/audit-logs")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].entityType").value("bike"))
                .andExpect(jsonPath("$[0].entityId").value(ENTITY_ID.toString()))
                .andExpect(jsonPath("$[0].field").value("insuranceStatus"))
                .andExpect(jsonPath("$[0].oldValue").value("ACTIVE"))
                .andExpect(jsonPath("$[0].newValue").value("EXPIRED"));
    }

    // ③ GET with entityId param filters correctly
    @Test
    void getByEntityIdFiltersCorrectly() throws Exception {
        mockMvc.perform(post("/api/v1/audit-logs")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"entityType":"bike","entityId":"%s","field":"operationStatus","oldValue":"IDLE","newValue":"IN_USE"}
                                """.formatted(ENTITY_ID)))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/v1/audit-logs")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"entityType":"bike","entityId":"%s","field":"operationStatus","oldValue":"IN_USE","newValue":"IDLE"}
                                """.formatted(OTHER_ENTITY_ID)))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/v1/audit-logs")
                        .param("entityId", ENTITY_ID.toString())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].entityId").value(ENTITY_ID.toString()));
    }

    // ④ POST then GET: actor is populated from authenticated admin's UUID
    @Test
    void postThenGetPopulatesActorWithAdminId() throws Exception {
        mockMvc.perform(post("/api/v1/audit-logs")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"entityType":"BIKE","entityId":"%s","field":"operationStatus","oldValue":"IDLE","newValue":"IN_USE"}
                                """.formatted(ENTITY_ID)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.actor").value(ADMIN_ID.toString()));

        mockMvc.perform(get("/api/v1/audit-logs")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].actor").value(ADMIN_ID.toString()));
    }

    // ⑤ GET with entityType param filters correctly
    @Test
    void getByEntityTypeFiltersCorrectly() throws Exception {
        mockMvc.perform(post("/api/v1/audit-logs")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"entityType":"BIKE","entityId":"%s","field":"operationStatus","oldValue":"IDLE","newValue":"IN_USE"}
                                """.formatted(ENTITY_ID)))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/v1/audit-logs")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"entityType":"RIDER","entityId":"%s","field":"status","oldValue":"ACTIVE","newValue":"INACTIVE"}
                                """.formatted(OTHER_ENTITY_ID)))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/v1/audit-logs")
                        .param("entityType", "BIKE")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].entityType").value("BIKE"));
    }

    // ⑥ GET with limit param respects the cap
    @Test
    void getRespectsLimitParam() throws Exception {
        mockMvc.perform(post("/api/v1/audit-logs")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"entityType":"BIKE","entityId":"%s","field":"operationStatus","oldValue":"IDLE","newValue":"IN_USE"}
                                """.formatted(ENTITY_ID)))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/v1/audit-logs")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"entityType":"BIKE","entityId":"%s","field":"operationStatus","oldValue":"IN_USE","newValue":"IDLE"}
                                """.formatted(ENTITY_ID)))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/v1/audit-logs")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"entityType":"BIKE","entityId":"%s","field":"insuranceStatus","oldValue":"ACTIVE","newValue":"EXPIRED"}
                                """.formatted(ENTITY_ID)))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/v1/audit-logs")
                        .param("limit", "2")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));
    }

    // --- helpers ---------------------------------------------------------

    private String loginAndExtractToken() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"loginId":"ops-admin","password":"correct-password"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isString())
                .andReturn();

        Matcher matcher = ACCESS_TOKEN_PATTERN.matcher(result.getResponse().getContentAsString());
        Assertions.assertThat(matcher.find()).isTrue();
        return matcher.group(1);
    }
}
