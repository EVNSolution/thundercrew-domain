package com.thundercrew.opsapi;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
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
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthApiContractTests extends PostgresContainerSupport {

    private static final UUID ADMIN_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final UUID RIDER_ID = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private static final Pattern ACCESS_TOKEN_PATTERN = Pattern.compile("\"accessToken\"\\s*:\\s*\"([^\"]+)\"");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtDecoder jwtDecoder;

    @Autowired
    private JwtEncoder jwtEncoder;

    @DynamicPropertySource
    static void postgresProperties(DynamicPropertyRegistry registry) {
        registerPostgresProperties(registry);
    }

    @BeforeEach
    void resetRows() {
        jdbcTemplate.update("delete from riders");
        jdbcTemplate.update("delete from admin_users");
        jdbcTemplate.update("""
                insert into admin_users (id, login_id, email, password_hash, display_name, enabled)
                values (?, 'ops-admin', 'ops@example.test', ?, 'Ops Admin', true)
                """, ADMIN_ID, passwordEncoder.encode("correct-password"));
        jdbcTemplate.update("""
                insert into riders (id, name, phone_number, team_name, area_name, app_account_linked, memo)
                values (?, '김라이더', '010-1000-2000', '강남팀', '서울 강남', false, 'auth api fixture')
                """, RIDER_ID);
    }

    @Test
    void adminLoginReturnsBearerAccessTokenAndAdminSummary() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"loginId":"ops-admin","password":"correct-password"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tokenType").value("Bearer"))
                .andExpect(jsonPath("$.accessToken").isString())
                .andExpect(jsonPath("$.expiresAt").isString())
                .andExpect(jsonPath("$.admin.id").value(ADMIN_ID.toString()))
                .andExpect(jsonPath("$.admin.loginId").value("ops-admin"))
                .andExpect(jsonPath("$.admin.displayName").value("Ops Admin"))
                .andExpect(jsonPath("$.admin.role").value("ADMIN"))
                .andReturn();

        String token = extractAccessToken(result);
        assertThat(jwtDecoder.decode(token).getClaimAsString("adminUserId")).isEqualTo(ADMIN_ID.toString());
        assertThat(jwtDecoder.decode(token).getClaimAsString("loginId")).isEqualTo("ops-admin");
        assertThat(jwtDecoder.decode(token).getClaimAsString("role")).isEqualTo("ADMIN");
    }

    @Test
    void existingReadApisAcceptValidBearerToken() throws Exception {
        String token = loginAndExtractToken("ops-admin", "correct-password");

        mockMvc.perform(get("/api/v1/riders/{id}", RIDER_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(RIDER_ID.toString()))
                .andExpect(jsonPath("$.name").value("김라이더"));
    }

    @Test
    void loginRejectsWrongPasswordWithStableUnauthorizedErrorContract() throws Exception {
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"loginId":"ops-admin","password":"wrong-password"}
                                """))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_FAILED"))
                .andExpect(jsonPath("$.path").value("/api/v1/auth/login"));
    }

    @Test
    void loginRejectsDisabledOrSoftDeletedAdmins() throws Exception {
        jdbcTemplate.update("update admin_users set enabled = false where id = ?", ADMIN_ID);

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"loginId":"ops-admin","password":"correct-password"}
                                """))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_FAILED"));

        jdbcTemplate.update("update admin_users set enabled = true, deleted_at = now() where id = ?", ADMIN_ID);

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"loginId":"ops-admin","password":"correct-password"}
                                """))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_FAILED"));
    }

    @Test
    void loginRequestValidationUsesSharedErrorContract() throws Exception {
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"loginId":"","password":""}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldViolations").isArray());
    }

    @Test
    void protectedApisRejectMissingOrInvalidBearerTokenWithStableUnauthorizedErrorContract() throws Exception {
        mockMvc.perform(get("/api/v1/riders/{id}", RIDER_ID))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_FAILED"))
                .andExpect(jsonPath("$.path").value("/api/v1/riders/" + RIDER_ID));

        mockMvc.perform(get("/api/v1/riders/{id}", RIDER_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer not-a-valid-token"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_FAILED"))
                .andExpect(header().doesNotExist(HttpHeaders.WWW_AUTHENTICATE));
    }

    @Test
    void protectedApisRejectExpiredBearerTokenWithStableUnauthorizedErrorContract() throws Exception {
        Instant issuedAt = Instant.now().minusSeconds(3600);
        String expiredToken = jwtEncoder.encode(JwtEncoderParameters.from(
                JwsHeader.with(MacAlgorithm.HS256).build(),
                JwtClaimsSet.builder()
                        .issuer("thundercrew-domain-test")
                        .subject(ADMIN_ID.toString())
                        .issuedAt(issuedAt)
                        .expiresAt(issuedAt.plusSeconds(60))
                        .claim("adminUserId", ADMIN_ID.toString())
                        .claim("loginId", "ops-admin")
                        .claim("role", "ADMIN")
                        .build()
        )).getTokenValue();

        mockMvc.perform(get("/api/v1/riders/{id}", RIDER_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + expiredToken))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_FAILED"))
                .andExpect(jsonPath("$.path").value("/api/v1/riders/" + RIDER_ID));
    }


    @Test
    void protectedApisRejectTokensWithoutRequiredAdminClaims() throws Exception {
        String missingAdminClaimsToken = jwtEncoder.encode(JwtEncoderParameters.from(
                JwsHeader.with(MacAlgorithm.HS256).build(),
                JwtClaimsSet.builder()
                        .issuer("thundercrew-domain-test")
                        .subject(ADMIN_ID.toString())
                        .issuedAt(Instant.now())
                        .expiresAt(Instant.now().plusSeconds(1800))
                        .build()
        )).getTokenValue();

        mockMvc.perform(get("/api/v1/riders/{id}", RIDER_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + missingAdminClaimsToken))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_FAILED"));
    }

    @Test
    void protectedApisRejectTokensWithWrongIssuerOrNonAdminRole() throws Exception {
        String wrongIssuerToken = jwtEncoder.encode(JwtEncoderParameters.from(
                JwsHeader.with(MacAlgorithm.HS256).build(),
                JwtClaimsSet.builder()
                        .issuer("wrong-issuer")
                        .subject(ADMIN_ID.toString())
                        .issuedAt(Instant.now())
                        .expiresAt(Instant.now().plusSeconds(1800))
                        .claim("adminUserId", ADMIN_ID.toString())
                        .claim("loginId", "ops-admin")
                        .claim("role", "ADMIN")
                        .build()
        )).getTokenValue();

        mockMvc.perform(get("/api/v1/riders/{id}", RIDER_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + wrongIssuerToken))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_FAILED"));

        String nonAdminToken = jwtEncoder.encode(JwtEncoderParameters.from(
                JwsHeader.with(MacAlgorithm.HS256).build(),
                JwtClaimsSet.builder()
                        .issuer("thundercrew-domain-test")
                        .subject(ADMIN_ID.toString())
                        .issuedAt(Instant.now())
                        .expiresAt(Instant.now().plusSeconds(1800))
                        .claim("adminUserId", ADMIN_ID.toString())
                        .claim("loginId", "ops-admin")
                        .claim("role", "VIEWER")
                        .build()
        )).getTokenValue();

        mockMvc.perform(get("/api/v1/riders/{id}", RIDER_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + nonAdminToken))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_FAILED"));
    }

    private String loginAndExtractToken(String loginId, String password) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"loginId\":\"" + loginId + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return extractAccessToken(result);
    }

    private String extractAccessToken(MvcResult result) throws Exception {
        Matcher matcher = ACCESS_TOKEN_PATTERN.matcher(result.getResponse().getContentAsString());
        if (!matcher.find()) {
            throw new AssertionError("accessToken was not present in login response: "
                    + result.getResponse().getContentAsString());
        }
        return matcher.group(1);
    }
}
