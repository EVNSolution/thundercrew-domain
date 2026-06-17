package com.thundercrew.opsapi;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
import org.springframework.test.web.servlet.ResultActions;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class RiderAuthApiContractTests extends PostgresContainerSupport {

    private static final UUID ADMIN_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final UUID RIDER_ID = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private static final String RIDER_PHONE = "010-1234-5678";
    private static final String RIDER_PASSWORD = "rider-secret-1";
    private static final Pattern ACCESS_TOKEN_PATTERN = Pattern.compile("\"accessToken\"\\s*:\\s*\"([^\"]+)\"");
    private static final Pattern REFRESH_TOKEN_PATTERN = Pattern.compile("\"refreshToken\"\\s*:\\s*\"([^\"]+)\"");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private String adminToken;

    @DynamicPropertySource
    static void postgresProperties(DynamicPropertyRegistry registry) {
        registerPostgresProperties(registry);
    }

    @BeforeEach
    void resetRows() throws Exception {
        jdbcTemplate.update("delete from rider_credentials");
        jdbcTemplate.update("delete from rider_bike_contracts");
        jdbcTemplate.update("delete from bikes");
        jdbcTemplate.update("delete from riders");
        jdbcTemplate.update("delete from admin_users");
        jdbcTemplate.update("""
                insert into admin_users (id, login_id, email, password_hash, display_name, enabled)
                values (?, 'ops-admin', 'ops@example.test', ?, 'Ops Admin', true)
                """, ADMIN_ID, passwordEncoder.encode("correct-password"));
        jdbcTemplate.update("""
                insert into riders (id, name, phone_number, team_name, area_name, app_account_linked, memo, deleted_at)
                values (?, '라이더1', ?, '강남팀', '서울 강남', false, 'fixture', null)
                """, RIDER_ID, RIDER_PHONE);
        adminToken = loginAdminAndExtractAccessToken();
    }

    @Test
    void adminIssuesCredentialThenRiderLogsInAndReadsOwnProfile() throws Exception {
        issueRiderCredential(RIDER_ID, RIDER_PASSWORD);

        MvcResult loginResult = riderLogin(RIDER_PHONE, RIDER_PASSWORD)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tokenType").value("Bearer"))
                .andExpect(jsonPath("$.rider.id").value(RIDER_ID.toString()))
                .andReturn();
        String riderToken = extract(ACCESS_TOKEN_PATTERN, loginResult);

        mockMvc.perform(get("/api/v1/rider/me")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + riderToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(RIDER_ID.toString()))
                .andExpect(jsonPath("$.phoneNumber").value(RIDER_PHONE))
                .andExpect(jsonPath("$.activeBikeId").doesNotExist());
    }

    @Test
    void riderLoginWithWrongPasswordIsUnauthorized() throws Exception {
        issueRiderCredential(RIDER_ID, RIDER_PASSWORD);

        riderLogin(RIDER_PHONE, "wrong-password")
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_FAILED"));
    }

    @Test
    void riderLoginWithUnknownPhoneIsUnauthorized() throws Exception {
        riderLogin("010-0000-0000", RIDER_PASSWORD)
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_FAILED"));
    }

    @Test
    void riderSelfEndpointRequiresAuthentication() throws Exception {
        mockMvc.perform(get("/api/v1/rider/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_FAILED"));
    }

    @Test
    void adminTokenCannotAccessRiderSelfEndpoint() throws Exception {
        mockMvc.perform(get("/api/v1/rider/me")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void riderTokenCannotAccessAdminEndpoint() throws Exception {
        issueRiderCredential(RIDER_ID, RIDER_PASSWORD);
        String riderToken = extract(ACCESS_TOKEN_PATTERN, riderLogin(RIDER_PHONE, RIDER_PASSWORD).andReturn());

        mockMvc.perform(get("/api/v1/riders")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + riderToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void riderRefreshRotatesAccessTokenAndNewTokenWorks() throws Exception {
        issueRiderCredential(RIDER_ID, RIDER_PASSWORD);
        MvcResult loginResult = riderLogin(RIDER_PHONE, RIDER_PASSWORD).andReturn();
        String refreshToken = extract(REFRESH_TOKEN_PATTERN, loginResult);

        MvcResult refreshResult = mockMvc.perform(post("/api/v1/rider-auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\":\"%s\"}".formatted(refreshToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rider.id").value(RIDER_ID.toString()))
                .andReturn();
        String rotatedAccessToken = extract(ACCESS_TOKEN_PATTERN, refreshResult);

        mockMvc.perform(get("/api/v1/rider/me")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + rotatedAccessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(RIDER_ID.toString()));
    }

    @Test
    void refreshRejectsAccessTokenUsedAsRefreshToken() throws Exception {
        issueRiderCredential(RIDER_ID, RIDER_PASSWORD);
        String accessToken = extract(ACCESS_TOKEN_PATTERN, riderLogin(RIDER_PHONE, RIDER_PASSWORD).andReturn());

        mockMvc.perform(post("/api/v1/rider-auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\":\"%s\"}".formatted(accessToken)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_FAILED"));
    }

    @Test
    void riderCredentialIssuanceRequiresAdminAuthentication() throws Exception {
        mockMvc.perform(patch("/api/v1/riders/{id}/credential", RIDER_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"newPassword\":\"%s\"}".formatted(RIDER_PASSWORD)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_FAILED"));
    }

    @Test
    void issuingCredentialForUnknownRiderReturnsNotFound() throws Exception {
        UUID unknownRiderId = UUID.fromString("dddddddd-dddd-dddd-dddd-dddddddddddd");
        mockMvc.perform(patch("/api/v1/riders/{id}/credential", unknownRiderId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"newPassword\":\"%s\"}".formatted(RIDER_PASSWORD)))
                .andExpect(status().isNotFound());
    }

    private void issueRiderCredential(UUID riderId, String password) throws Exception {
        mockMvc.perform(patch("/api/v1/riders/{id}/credential", riderId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"newPassword\":\"%s\"}".formatted(password)))
                .andExpect(status().isNoContent());
    }

    private ResultActions riderLogin(String phone, String password) throws Exception {
        return mockMvc.perform(post("/api/v1/rider-auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"phoneNumber\":\"%s\",\"password\":\"%s\"}".formatted(phone, password)));
    }

    private String loginAdminAndExtractAccessToken() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"loginId\":\"ops-admin\",\"password\":\"correct-password\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return extract(ACCESS_TOKEN_PATTERN, result);
    }

    private String extract(Pattern pattern, MvcResult result) throws Exception {
        Matcher matcher = pattern.matcher(result.getResponse().getContentAsString());
        assertThat(matcher.find()).isTrue();
        return matcher.group(1);
    }
}
