package com.thundercrew.opsapi;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
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
 * Slice C: rider education records baseline. Verifies the new
 * {@code rider_education_records} table + command/read endpoints + the four
 * derived columns layered onto {@code GET /riders/{id}}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class RiderEducationRecordApiTests extends PostgresContainerSupport {

    private static final UUID ADMIN_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final UUID RIDER_ID = UUID.fromString("ccccdddd-eeee-ffff-aaaa-000000000001");
    private static final UUID OTHER_RIDER_ID = UUID.fromString("ccccdddd-eeee-ffff-aaaa-000000000002");
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
        jdbcTemplate.update("delete from rider_education_records");
        jdbcTemplate.update("delete from rider_insurances");
        jdbcTemplate.update("delete from rider_bike_contracts");
        jdbcTemplate.update("delete from riders");
        jdbcTemplate.update("delete from admin_users");
        jdbcTemplate.update("""
                insert into admin_users (id, login_id, email, password_hash, display_name, enabled)
                values (?, 'ops-admin', 'ops@example.test', ?, 'Ops Admin', true)
                """, ADMIN_ID, passwordEncoder.encode("correct-password"));
        jdbcTemplate.update("""
                insert into riders (id, name, phone_number, app_account_linked)
                values (?, '테스트 라이더 1', '010-3000-1001', false)
                """, RIDER_ID);
        jdbcTemplate.update("""
                insert into riders (id, name, phone_number, app_account_linked)
                values (?, '테스트 라이더 2', '010-3000-1002', false)
                """, OTHER_RIDER_ID);
        accessToken = loginAndExtractToken();
    }

    @Test
    void createEducationRecordSucceedsWithFullPayload() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/rider-education-records")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "riderId":"%s",
                                  "educationType":"ONLINE",
                                  "courseName":"전기이륜차 안전 운행 교육 2026",
                                  "completedAt":"2026-04-01T00:00:00Z",
                                  "expiresAt":"2027-04-01T00:00:00Z",
                                  "certificateNo":"CRT-001",
                                  "issuingAuthority":"교통안전공단",
                                  "evidenceUrl":"https://evidence.example.com/CRT-001.pdf"
                                }
                                """.formatted(RIDER_ID)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.riderId").value(RIDER_ID.toString()))
                .andExpect(jsonPath("$.educationType").value("ONLINE"))
                .andExpect(jsonPath("$.courseName").value("전기이륜차 안전 운행 교육 2026"))
                .andExpect(jsonPath("$.certificateNo").value("CRT-001"))
                .andExpect(jsonPath("$.issuingAuthority").value("교통안전공단"))
                .andReturn();

        assertThat(result.getResponse().getStatus()).isEqualTo(201);
    }

    @Test
    void createEducationRecordRejectsExpiryBeforeCompletion() throws Exception {
        mockMvc.perform(post("/api/v1/rider-education-records")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "riderId":"%s",
                                  "educationType":"OFFLINE",
                                  "completedAt":"2026-04-01T00:00:00Z",
                                  "expiresAt":"2026-03-01T00:00:00Z"
                                }
                                """.formatted(RIDER_ID)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVALID_STATE_TRANSITION"));
    }

    @Test
    void createEducationRecordRejectsDuplicateActiveCertificateNo() throws Exception {
        seedRecord(UUID.randomUUID(), RIDER_ID, "ONLINE", "2026-03-01T00:00:00Z", null, "CRT-DUP");

        mockMvc.perform(post("/api/v1/rider-education-records")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "riderId":"%s",
                                  "educationType":"OFFLINE",
                                  "completedAt":"2026-04-01T00:00:00Z",
                                  "certificateNo":"CRT-DUP"
                                }
                                """.formatted(RIDER_ID)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DUPLICATE_ACTIVE_RESOURCE"));
    }

    @Test
    void createEducationRecordRejectsMissingRider() throws Exception {
        UUID missing = UUID.fromString("99999999-9999-9999-9999-999999999999");
        mockMvc.perform(post("/api/v1/rider-education-records")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "riderId":"%s",
                                  "educationType":"ONLINE",
                                  "completedAt":"2026-04-01T00:00:00Z"
                                }
                                """.formatted(missing)))
                .andExpect(status().isNotFound());
    }

    @Test
    void listByRiderReturnsRecordsInDescOrder() throws Exception {
        UUID first = UUID.randomUUID();
        UUID second = UUID.randomUUID();
        seedRecord(first, RIDER_ID, "ONLINE", "2026-01-15T00:00:00Z", null, null);
        seedRecord(second, RIDER_ID, "OFFLINE", "2026-04-01T00:00:00Z", null, null);
        seedRecord(UUID.randomUUID(), OTHER_RIDER_ID, "ONLINE", "2026-04-01T00:00:00Z", null, null);

        mockMvc.perform(get("/api/v1/riders/{riderId}/education-records", RIDER_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.items[0].id").value(second.toString()))
                .andExpect(jsonPath("$.items[1].id").value(first.toString()));
    }

    @Test
    void softDeleteHidesFromActiveList() throws Exception {
        UUID recordId = UUID.randomUUID();
        seedRecord(recordId, RIDER_ID, "ONLINE", "2026-04-01T00:00:00Z", null, "CRT-DEL");

        mockMvc.perform(delete("/api/v1/rider-education-records/{id}", recordId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/rider-education-records/{id}", recordId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isNotFound());

        // 같은 certificate_no 로 새 record 발급 가능 (active unique 만 enforced).
        mockMvc.perform(post("/api/v1/rider-education-records")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "riderId":"%s",
                                  "educationType":"OFFLINE",
                                  "completedAt":"2026-05-01T00:00:00Z",
                                  "certificateNo":"CRT-DEL"
                                }
                                """.formatted(RIDER_ID)))
                .andExpect(status().isCreated());
    }

    @Test
    void updateEducationRecordChangesProvidedFields() throws Exception {
        UUID recordId = UUID.randomUUID();
        seedRecord(recordId, RIDER_ID, "ONLINE", "2026-04-01T00:00:00Z", null, null);

        mockMvc.perform(patch("/api/v1/rider-education-records/{id}", recordId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "educationType":"OFFLINE",
                                  "courseName":"보강 교육",
                                  "expiresAt":"2027-04-01T00:00:00Z",
                                  "certificateNo":"CRT-200"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.educationType").value("OFFLINE"))
                .andExpect(jsonPath("$.courseName").value("보강 교육"))
                .andExpect(jsonPath("$.expiresAt").value("2027-04-01T00:00:00Z"))
                .andExpect(jsonPath("$.certificateNo").value("CRT-200"));
    }

    @Test
    void riderReadResponseExposesEducationSummary() throws Exception {
        Instant now = Instant.now();
        Instant completedAt = now.minus(30, ChronoUnit.DAYS);
        Instant expiresAt = now.plus(335, ChronoUnit.DAYS);
        seedRecord(UUID.randomUUID(), RIDER_ID, "ONLINE", completedAt.toString(), expiresAt.toString(), null);

        mockMvc.perform(get("/api/v1/riders/{id}", RIDER_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.educationCompleted").value(true))
                .andExpect(jsonPath("$.latestEducationType").value("ONLINE"))
                .andExpect(jsonPath("$.educationExpired").value(false));
    }

    @Test
    void riderReadResponseShowsExpiredWhenLatestRecordExpired() throws Exception {
        Instant now = Instant.now();
        Instant completedAt = now.minus(400, ChronoUnit.DAYS);
        Instant expiresAt = now.minus(35, ChronoUnit.DAYS);
        seedRecord(UUID.randomUUID(), RIDER_ID, "OFFLINE", completedAt.toString(), expiresAt.toString(), null);

        mockMvc.perform(get("/api/v1/riders/{id}", RIDER_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.educationCompleted").value(true))
                .andExpect(jsonPath("$.latestEducationType").value("OFFLINE"))
                .andExpect(jsonPath("$.educationExpired").value(true));
    }

    @Test
    void riderWithoutRecordsReportsNotCompleted() throws Exception {
        mockMvc.perform(get("/api/v1/riders/{id}", RIDER_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.educationCompleted").value(false))
                .andExpect(jsonPath("$.latestEducationType").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.educationExpired").value(false));
    }

    private void seedRecord(
            UUID id,
            UUID riderId,
            String type,
            String completedAtIso,
            String expiresAtIso,
            String certificateNo
    ) {
        String expires = expiresAtIso == null ? null : expiresAtIso;
        jdbcTemplate.update("""
                insert into rider_education_records (
                    id, rider_id, education_type, completed_at, expires_at, certificate_no
                ) values (?, ?, ?, ?::timestamptz, ?::timestamptz, ?)
                """, id, riderId, type, completedAtIso, expires, certificateNo);
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
}
