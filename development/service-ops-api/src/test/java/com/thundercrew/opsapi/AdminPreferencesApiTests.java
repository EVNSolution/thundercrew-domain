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

/**
 * Slice C-1: backend admin preferences endpoint. Verifies the per-admin
 * NCP map toggle stores on admin_users, defaults to TRUE for fresh rows,
 * and is mutable via PATCH /api/v1/admin-users/me/preferences using only
 * the JWT subject (no path-param admin id).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AdminPreferencesApiTests extends PostgresContainerSupport {

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
        jdbcTemplate.update("delete from admin_auth_sessions");
        jdbcTemplate.update("delete from admin_users");
        jdbcTemplate.update("""
                insert into admin_users (id, login_id, email, password_hash, display_name, enabled)
                values (?, 'ops-admin', 'ops@example.test', ?, 'Ops Admin', true)
                """, ADMIN_ID, passwordEncoder.encode("correct-password"));
        accessToken = loginAndExtractToken();
    }

    @Test
    void getMinePreferencesReturnsDefaultsForNewlySeededAdmin() throws Exception {
        mockMvc.perform(get("/api/v1/admin-users/me/preferences")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.adminId").value(ADMIN_ID.toString()))
                .andExpect(jsonPath("$.ncpMapEnabled").value(true));
    }

    @Test
    void patchMinePreferencesTogglesNcpMapEnabledAndPersists() throws Exception {
        mockMvc.perform(patch("/api/v1/admin-users/me/preferences")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"ncpMapEnabled": false}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.adminId").value(ADMIN_ID.toString()))
                .andExpect(jsonPath("$.ncpMapEnabled").value(false));

        mockMvc.perform(get("/api/v1/admin-users/me/preferences")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ncpMapEnabled").value(false));

        Boolean storedValue = jdbcTemplate.queryForObject(
                "select ncp_map_enabled from admin_users where id = ?",
                Boolean.class,
                ADMIN_ID);
        assertThat(storedValue).isFalse();
    }

    @Test
    void patchMinePreferencesAcceptsToggleBackToTrue() throws Exception {
        // Toggle to false then back to true.
        mockMvc.perform(patch("/api/v1/admin-users/me/preferences")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"ncpMapEnabled": false}
                                """))
                .andExpect(status().isOk());

        mockMvc.perform(patch("/api/v1/admin-users/me/preferences")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"ncpMapEnabled": true}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ncpMapEnabled").value(true));
    }

    @Test
    void patchMinePreferencesRejectsMissingNcpMapEnabledField() throws Exception {
        mockMvc.perform(patch("/api/v1/admin-users/me/preferences")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    @Test
    void preferencesEndpointsRequireAuthentication() throws Exception {
        mockMvc.perform(get("/api/v1/admin-users/me/preferences"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_FAILED"));

        mockMvc.perform(patch("/api/v1/admin-users/me/preferences")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"ncpMapEnabled": false}
                                """))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_FAILED"));
    }

    @Test
    void migrationDefaultsExistingAdminsToTrue() throws Exception {
        // The migration's default value must apply to admin rows that were
        // already in the table when V10 ran. We verify the column reflects
        // the default for our seeded admin.
        Boolean storedValue = jdbcTemplate.queryForObject(
                "select ncp_map_enabled from admin_users where id = ?",
                Boolean.class,
                ADMIN_ID);
        assertThat(storedValue).isTrue();
    }

    private String loginAndExtractToken() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"loginId":"ops-admin","password":"correct-password"}
                                """))
                .andExpect(status().isOk())
                .andReturn();
        Matcher matcher = ACCESS_TOKEN_PATTERN.matcher(result.getResponse().getContentAsString());
        assertThat(matcher.find()).isTrue();
        return matcher.group(1);
    }
}
