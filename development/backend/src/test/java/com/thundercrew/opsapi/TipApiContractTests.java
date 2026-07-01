package com.thundercrew.opsapi;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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
class TipApiContractTests extends PostgresContainerSupport {

    private static final UUID ADMIN_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final Pattern ACCESS_TOKEN_PATTERN = Pattern.compile("\\\"accessToken\\\"\\s*:\\s*\\\"([^\\\"]+)\\\"");
    private static final Pattern ID_PATTERN = Pattern.compile("\\\"id\\\"\\s*:\\s*\\\"([^\\\"]+)\\\"");

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
        jdbcTemplate.update("delete from notifications");
        jdbcTemplate.update("delete from tips");
        jdbcTemplate.update("delete from admin_users");
        jdbcTemplate.update("""
                insert into admin_users (id, login_id, email, password_hash, display_name, enabled)
                values (?, 'ops-admin', 'ops@example.test', ?, 'Ops Admin', true)
                """, ADMIN_ID, passwordEncoder.encode("correct-password"));
        accessToken = loginAndExtractToken();
    }

    @Test
    void createTipReturns201WithGeneratedIdentifiers() throws Exception {
        mockMvc.perform(post("/api/v1/tips")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "address": "서울 강남구 역삼동 123",
                                  "content": "공사 중 우회 필요",
                                  "latitude": 37.4987,
                                  "longitude": 127.0276
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isString())
                .andExpect(jsonPath("$.idx").isNumber())
                .andExpect(jsonPath("$.address").value("서울 강남구 역삼동 123"))
                .andExpect(jsonPath("$.content").value("공사 중 우회 필요"))
                .andExpect(jsonPath("$.latitude").value(37.4987))
                .andExpect(jsonPath("$.longitude").value(127.0276));
    }

    @Test
    void getReturnsCreatedTip() throws Exception {
        MvcResult created = mockMvc.perform(post("/api/v1/tips")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"address":"서울 종로구 세종대로 1","content":"도로 파손 주의",
                                 "latitude":37.5762,"longitude":126.9769}
                                """))
                .andExpect(status().isCreated())
                .andReturn();

        String id = extractId(created.getResponse().getContentAsString());

        mockMvc.perform(get("/api/v1/tips/{id}", id)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id))
                .andExpect(jsonPath("$.address").value("서울 종로구 세종대로 1"))
                .andExpect(jsonPath("$.content").value("도로 파손 주의"));
    }

    @Test
    void updateChangesTipFields() throws Exception {
        MvcResult created = mockMvc.perform(post("/api/v1/tips")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"address":"서울 마포구 1","content":"원래 내용",
                                 "latitude":37.555,"longitude":126.920}
                                """))
                .andExpect(status().isCreated())
                .andReturn();

        String id = extractId(created.getResponse().getContentAsString());

        mockMvc.perform(put("/api/v1/tips/{id}", id)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"address":"서울 마포구 수정됨","content":"수정된 내용",
                                 "latitude":37.556,"longitude":126.921}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id))
                .andExpect(jsonPath("$.address").value("서울 마포구 수정됨"))
                .andExpect(jsonPath("$.content").value("수정된 내용"))
                .andExpect(jsonPath("$.latitude").value(37.556))
                .andExpect(jsonPath("$.longitude").value(126.921));
    }

    @Test
    void deleteSoftDeletesTipSoSubsequentGetReturns404() throws Exception {
        MvcResult created = mockMvc.perform(post("/api/v1/tips")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"address":"삭제 대상","content":"삭제할 내용",
                                 "latitude":37.5,"longitude":126.9}
                                """))
                .andExpect(status().isCreated())
                .andReturn();

        String id = extractId(created.getResponse().getContentAsString());

        mockMvc.perform(delete("/api/v1/tips/{id}", id)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/tips/{id}", id)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isNotFound());
    }

    @Test
    void createRejectsBlankAddressWith400() throws Exception {
        mockMvc.perform(post("/api/v1/tips")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"address":"","content":"내용","latitude":37.5,"longitude":126.9}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldViolations").isArray());
    }

    @Test
    void listReturnsPaginatedTipsWithTotalItems() throws Exception {
        for (int i = 0; i < 3; i++) {
            mockMvc.perform(post("/api/v1/tips")
                            .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(String.format("""
                                    {"address":"주소 %d","content":"내용 %d","latitude":37.5,"longitude":126.9}
                                    """, i, i)))
                    .andExpect(status().isCreated());
        }

        mockMvc.perform(get("/api/v1/tips")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isArray())
                .andExpect(jsonPath("$.items.length()").value(3))
                .andExpect(jsonPath("$.page.totalItems").value(3));
    }

    @Test
    void submitCreatesPendingTipAndRecordsNotification() throws Exception {
        UUID riderId = UUID.randomUUID();

        MvcResult result = mockMvc.perform(post("/api/v1/tips/submissions")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format("""
                                {
                                  "address": "서울 강남구 제출 주소",
                                  "content": "제출된 팁 내용",
                                  "latitude": 37.4987,
                                  "longitude": 127.0276,
                                  "riderId": "%s"
                                }
                                """, riderId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isString())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.submittedByRiderId").value(riderId.toString()))
                .andReturn();

        String tipId = extractId(result.getResponse().getContentAsString());

        int notificationCount = jdbcTemplate.queryForObject(
                "select count(*) from notifications where type = 'TIP_SUBMISSION' and ref_entity_id = ?",
                Integer.class, UUID.fromString(tipId));
        assert notificationCount == 1 : "Expected 1 TIP_SUBMISSION notification but got " + notificationCount;
    }

    @Test
    void publishChangesStatusToPublished() throws Exception {
        MvcResult submitted = mockMvc.perform(post("/api/v1/tips/submissions")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "address": "서울 송파구 퍼블리시 주소",
                                  "content": "퍼블리시할 팁 내용",
                                  "latitude": 37.514,
                                  "longitude": 127.106
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andReturn();

        String tipId = extractId(submitted.getResponse().getContentAsString());

        mockMvc.perform(post("/api/v1/tips/{id}/publish", tipId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(tipId))
                .andExpect(jsonPath("$.status").value("PUBLISHED"));
    }

    @Test
    void dashboardMapStateIncludesTipPins() throws Exception {
        mockMvc.perform(post("/api/v1/tips")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"address":"대시보드 팁","content":"내용","latitude":37.5,"longitude":126.9}
                                """))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/v1/dashboard/map-state")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tipPins").isArray())
                .andExpect(jsonPath("$.tipPins[0].address").value("대시보드 팁"))
                .andExpect(jsonPath("$.tipPins[0].content").value("내용"));
    }

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
        if (!matcher.find()) {
            throw new IllegalStateException("No access token in login response");
        }
        return matcher.group(1);
    }

    private String extractId(String json) {
        Matcher matcher = ID_PATTERN.matcher(json);
        if (!matcher.find()) {
            throw new IllegalStateException("No id in response: " + json);
        }
        return matcher.group(1);
    }
}
