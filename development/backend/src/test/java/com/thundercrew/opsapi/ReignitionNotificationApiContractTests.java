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
class ReignitionNotificationApiContractTests extends PostgresContainerSupport {

    private static final UUID ADMIN_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final UUID BIKE_ID = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");

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
        jdbcTemplate.update("delete from reignition_notifications");
        jdbcTemplate.update("delete from admin_users");

        jdbcTemplate.update("""
                insert into admin_users (id, login_id, email, password_hash, display_name, enabled)
                values (?, 'ops-admin', 'ops@example.test', ?, 'Ops Admin', true)
                """, ADMIN_ID, passwordEncoder.encode("correct-password"));

        accessToken = loginAndExtractToken();
    }

    // ① POST /api/v1/reignition-notifications → 201, fields persisted including next-destination
    @Test
    void postReturns201WithAllNextDestinationFields() throws Exception {
        String occurredAt = "2026-06-16T10:00:00Z";

        mockMvc.perform(post("/api/v1/reignition-notifications")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "bikeId": "%s",
                                  "plateNumber": "서울CC-0001",
                                  "occurredAt": "%s",
                                  "nextCustomerName": "홍길동",
                                  "nextAddress": "서울 강남구 역삼동 123",
                                  "nextLatitude": 37.4987,
                                  "nextLongitude": 127.0276
                                }
                                """.formatted(BIKE_ID, occurredAt)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isString())
                .andExpect(jsonPath("$.idx").isNumber())
                .andExpect(jsonPath("$.bikeId").value(BIKE_ID.toString()))
                .andExpect(jsonPath("$.plateNumber").value("서울CC-0001"))
                .andExpect(jsonPath("$.occurredAt").value(occurredAt))
                .andExpect(jsonPath("$.nextCustomerName").value("홍길동"))
                .andExpect(jsonPath("$.nextAddress").value("서울 강남구 역삼동 123"))
                .andExpect(jsonPath("$.nextLatitude").value(37.4987))
                .andExpect(jsonPath("$.nextLongitude").value(127.0276))
                .andExpect(jsonPath("$.createdAt").isString());
    }

    // ② POST then GET list returns the event (ordered by occurredAt desc), next-destination fields visible
    @Test
    void getListReturnsRecentEventWithNextDestinationFields() throws Exception {
        String occurredAt = "2026-06-16T09:00:00Z";

        mockMvc.perform(post("/api/v1/reignition-notifications")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "bikeId": "%s",
                                  "plateNumber": "서울CC-0001",
                                  "occurredAt": "%s",
                                  "nextCustomerName": "김철수",
                                  "nextAddress": "서울 마포구 합정동 456",
                                  "nextLatitude": 37.5503,
                                  "nextLongitude": 126.9142
                                }
                                """.formatted(BIKE_ID, occurredAt)))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/v1/reignition-notifications")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].bikeId").value(BIKE_ID.toString()))
                .andExpect(jsonPath("$[0].plateNumber").value("서울CC-0001"))
                .andExpect(jsonPath("$[0].occurredAt").value(occurredAt))
                .andExpect(jsonPath("$[0].nextCustomerName").value("김철수"))
                .andExpect(jsonPath("$[0].nextAddress").value("서울 마포구 합정동 456"))
                .andExpect(jsonPath("$[0].nextLatitude").value(37.5503))
                .andExpect(jsonPath("$[0].nextLongitude").value(126.9142));
    }

    // ③ POST without next-destination fields (nullable) → 201
    @Test
    void postWithNullNextDestinationFieldsReturns201() throws Exception {
        mockMvc.perform(post("/api/v1/reignition-notifications")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "bikeId": "%s",
                                  "plateNumber": "서울CC-0002",
                                  "occurredAt": "2026-06-16T08:00:00Z"
                                }
                                """.formatted(BIKE_ID)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.nextCustomerName").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.nextAddress").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.nextLatitude").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.nextLongitude").value(org.hamcrest.Matchers.nullValue()));
    }

    // ④ Two events posted: GET list is ordered occurredAt desc
    @Test
    void getListOrdersByOccurredAtDesc() throws Exception {
        mockMvc.perform(post("/api/v1/reignition-notifications")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"bikeId":"%s","plateNumber":"서울CC-0001","occurredAt":"2026-06-16T07:00:00Z"}
                                """.formatted(BIKE_ID)))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/v1/reignition-notifications")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"bikeId":"%s","plateNumber":"서울CC-0002","occurredAt":"2026-06-16T08:00:00Z"}
                                """.formatted(BIKE_ID)))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/v1/reignition-notifications")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].plateNumber").value("서울CC-0002"))
                .andExpect(jsonPath("$[1].plateNumber").value("서울CC-0001"));
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
