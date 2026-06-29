package com.thundercrew.opsapi;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doNothing;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.thundercrew.opsapi.otoplug.OtoplugClient;
import java.util.List;
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
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class OtoplugObserverApiTests extends PostgresContainerSupport {

    private static final UUID ADMIN_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final Pattern ACCESS_TOKEN_PATTERN = Pattern.compile("\\\"accessToken\\\"\\s*:\\s*\\\"([^\\\"]+)\\\"");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @MockitoBean
    private OtoplugClient otoplugClient;

    private String accessToken;

    @DynamicPropertySource
    static void postgresProperties(DynamicPropertyRegistry registry) {
        registerPostgresProperties(registry);
    }

    @BeforeEach
    void resetRows() throws Exception {
        jdbcTemplate.update("delete from otoplug_observers");
        List.of("admin_auth_sessions", "admin_users")
                .forEach(table -> jdbcTemplate.update("delete from " + table));
        jdbcTemplate.update("""
                insert into admin_users (id, login_id, email, password_hash, display_name, enabled)
                values (?, 'ops-admin', 'ops@example.test', ?, 'Ops Admin', true)
                """, ADMIN_ID, passwordEncoder.encode("correct-password"));
        accessToken = loginAndExtractToken();

        doNothing().when(otoplugClient).registerObserver(anyString(), anyString(), anyString(), anyString());
        doNothing().when(otoplugClient).ignoreObserver(anyString(), anyString(), anyString());
    }

    @Test
    void statusReturnsInactiveWithEmptyApisWhenNothingRegistered() throws Exception {
        mockMvc.perform(get("/api/v1/otoplug/observers")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false))
                .andExpect(jsonPath("$.registeredApis.length()").value(0));
    }

    @Test
    void otoplugObserverEndpointsRequireAdminAuthentication() throws Exception {
        mockMvc.perform(get("/api/v1/otoplug/observers"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/v1/otoplug/observers/register"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/v1/otoplug/observers/ignore"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void registerCreatesObserverRowsAndIgnoreRemovesThem() throws Exception {
        mockMvc.perform(post("/api/v1/otoplug/observers/register")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(true))
                .andExpect(jsonPath("$.registeredApis.length()").value(2));

        Integer rowsAfterRegister = jdbcTemplate.queryForObject(
                "select count(*) from otoplug_observers", Integer.class);
        assertThat(rowsAfterRegister).isEqualTo(2);

        List<String> apis = jdbcTemplate.queryForList(
                "select api from otoplug_observers order by api", String.class);
        assertThat(apis).containsExactly(
                "csi.terminal.status.data.driving",
                "csi.terminal.status.data.drivingDetail");

        // register is idempotent: re-running must not duplicate rows
        mockMvc.perform(post("/api/v1/otoplug/observers/register")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(true));
        Integer rowsAfterReRegister = jdbcTemplate.queryForObject(
                "select count(*) from otoplug_observers", Integer.class);
        assertThat(rowsAfterReRegister).isEqualTo(2);

        mockMvc.perform(post("/api/v1/otoplug/observers/ignore")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false))
                .andExpect(jsonPath("$.registeredApis.length()").value(0));

        Integer rowsAfterIgnore = jdbcTemplate.queryForObject(
                "select count(*) from otoplug_observers", Integer.class);
        assertThat(rowsAfterIgnore).isZero();
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
        if (!matcher.find()) {
            throw new AssertionError("accessToken was not present in login response: "
                    + result.getResponse().getContentAsString());
        }
        return matcher.group(1);
    }
}
