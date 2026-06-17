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
class NotificationApiContractTests extends PostgresContainerSupport {

    private static final UUID ADMIN_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final Pattern ACCESS_TOKEN_PATTERN =
            Pattern.compile("\"accessToken\"\\s*:\\s*\"([^\"]+)\"");

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
        jdbcTemplate.update("delete from admin_users");
        jdbcTemplate.update("""
                insert into admin_users (id, login_id, email, password_hash, display_name, enabled)
                values (?, 'ops-admin', 'ops@example.test', ?, 'Ops Admin', true)
                """, ADMIN_ID, passwordEncoder.encode("correct-password"));
        accessToken = loginAndExtractToken();
    }

    // ① GET /api/v1/notifications returns empty list initially
    @Test
    void getListReturnsEmptyInitially() throws Exception {
        mockMvc.perform(get("/api/v1/notifications")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    // ② Seed a notification and GET list returns it
    @Test
    void getListReturnsSeedNotification() throws Exception {
        UUID notifId = UUID.randomUUID();
        UUID bikeId = UUID.randomUUID();
        UUID entityId = UUID.randomUUID();
        jdbcTemplate.update("""
                insert into notifications (id, type, title, body, ref_bike_id, ref_entity_id, occurred_at)
                values (?, 'MAINTENANCE_ALARM', '정비 임박: 서울A-0001 엔진오일', '엔진오일 85% 소진 (임계 80%)', ?, ?, now())
                """, notifId, bikeId, entityId);

        mockMvc.perform(get("/api/v1/notifications")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(notifId.toString()))
                .andExpect(jsonPath("$[0].type").value("MAINTENANCE_ALARM"))
                .andExpect(jsonPath("$[0].title").value("정비 임박: 서울A-0001 엔진오일"))
                .andExpect(jsonPath("$[0].acknowledgedAt").isEmpty());
    }

    // ③ POST acknowledge → 200 with acknowledgedAt set
    @Test
    void acknowledgeNotificationSetsAcknowledgedAt() throws Exception {
        UUID notifId = UUID.randomUUID();
        jdbcTemplate.update("""
                insert into notifications (id, type, title, occurred_at)
                values (?, 'MAINTENANCE_ALARM', '정비 임박: 테스트', now())
                """, notifId);

        mockMvc.perform(post("/api/v1/notifications/{id}/acknowledge", notifId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(notifId.toString()))
                .andExpect(jsonPath("$.acknowledgedAt").isString());
    }

    // ④ unacknowledgedOnly filter
    @Test
    void unacknowledgedOnlyFilterWorks() throws Exception {
        UUID notifA = UUID.randomUUID();
        UUID notifB = UUID.randomUUID();
        jdbcTemplate.update("""
                insert into notifications (id, type, title, occurred_at)
                values (?, 'MAINTENANCE_ALARM', 'A 알람', now() - interval '2 minutes')
                """, notifA);
        jdbcTemplate.update("""
                insert into notifications (id, type, title, occurred_at, acknowledged_at)
                values (?, 'MAINTENANCE_ALARM', 'B 알람', now() - interval '1 minute', now())
                """, notifB);

        mockMvc.perform(get("/api/v1/notifications")
                        .param("unacknowledgedOnly", "true")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(notifA.toString()));
    }

    // ⑤ type filter
    @Test
    void typeFilterWorks() throws Exception {
        UUID notifA = UUID.randomUUID();
        UUID notifB = UUID.randomUUID();
        jdbcTemplate.update("""
                insert into notifications (id, type, title, occurred_at)
                values (?, 'MAINTENANCE_ALARM', 'A 정비', now() - interval '2 minutes')
                """, notifA);
        jdbcTemplate.update("""
                insert into notifications (id, type, title, occurred_at)
                values (?, 'OTHER_TYPE', 'B 기타', now() - interval '1 minute')
                """, notifB);

        mockMvc.perform(get("/api/v1/notifications")
                        .param("type", "MAINTENANCE_ALARM")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(notifA.toString()));
    }

    // --- helpers ---

    private String loginAndExtractToken() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"loginId":"ops-admin","password":"correct-password"}
                                """))
                .andExpect(status().isOk())
                .andReturn();
        Matcher matcher = ACCESS_TOKEN_PATTERN.matcher(result.getResponse().getContentAsString());
        Assertions.assertThat(matcher.find()).isTrue();
        return matcher.group(1);
    }
}
