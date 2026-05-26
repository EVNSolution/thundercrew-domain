package com.thundercrew.opsapi;

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

import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class CleaningScheduleApiContractTests extends PostgresContainerSupport {

    private static final UUID ADMIN_ID = UUID.fromString("cccccccc-cccc-cccc-cccc-cccccccccccc");
    private static final UUID CLEANING_BIKE_ID = UUID.fromString("dddddddd-dddd-dddd-dddd-dddddddddddd");
    private static final UUID DELIVERY_BIKE_ID = UUID.fromString("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee");
    private static final Pattern ACCESS_TOKEN_PATTERN = Pattern.compile("\"accessToken\"\\s*:\\s*\"([^\"]+)\"");

    @Autowired private MockMvc mockMvc;
    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private PasswordEncoder passwordEncoder;

    private String accessToken;

    @DynamicPropertySource
    static void postgresProperties(DynamicPropertyRegistry registry) {
        registerPostgresProperties(registry);
    }

    @BeforeEach
    void resetRows() throws Exception {
        jdbcTemplate.update("delete from cleaning_schedules");
        jdbcTemplate.update("delete from bike_operation_status_histories");
        jdbcTemplate.update("delete from bikes");
        jdbcTemplate.update("delete from admin_users");
        jdbcTemplate.update("""
            insert into admin_users (id, login_id, email, password_hash, display_name, enabled)
            values (?, 'ops-admin', 'ops@example.test', ?, 'Ops Admin', true)
            """, ADMIN_ID, passwordEncoder.encode("correct-password"));
        jdbcTemplate.update("""
            insert into bikes (id, plate_number, vin, model_name, engine_type, service_type,
                               operation_status, ignition_blocked, created_at, updated_at)
            values (?, '서울A-9001', 'VIN-CLEAN-001', 'Thunder C1', 'ELECTRIC', 'CLEANING',
                    'READY', false, now(), now())
            """, CLEANING_BIKE_ID);
        jdbcTemplate.update("""
            insert into bikes (id, plate_number, vin, model_name, engine_type, service_type,
                               operation_status, ignition_blocked, created_at, updated_at)
            values (?, '서울B-9002', 'VIN-DLVR-001', 'Thunder D1', 'ELECTRIC', 'DELIVERY',
                    'READY', false, now(), now())
            """, DELIVERY_BIKE_ID);
        accessToken = loginAndExtractToken();
    }

    private String loginAndExtractToken() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"loginId\":\"ops-admin\",\"password\":\"correct-password\"}"))
            .andExpect(status().isOk())
            .andReturn();
        String body = result.getResponse().getContentAsString();
        Matcher m = ACCESS_TOKEN_PATTERN.matcher(body);
        if (!m.find()) throw new IllegalStateException("accessToken not found in login response");
        return m.group(1);
    }

    @Test
    void createScheduleForCleaningBikeReturns201WithId() throws Exception {
        mockMvc.perform(post("/api/v1/cleaning-schedules")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "bikeId": "%s",
                      "scheduledAt": "2026-06-01T10:00:00",
                      "address": "서울시 강남구 역삼동 123",
                      "memo": "현관 비밀번호 1234"
                    }
                    """.formatted(CLEANING_BIKE_ID)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").isString())
            .andExpect(jsonPath("$.bikeId").value(CLEANING_BIKE_ID.toString()))
            .andExpect(jsonPath("$.bikePlateNumber").value("서울A-9001"))
            .andExpect(jsonPath("$.address").value("서울시 강남구 역삼동 123"))
            .andExpect(jsonPath("$.memo").value("현관 비밀번호 1234"))
            .andExpect(jsonPath("$.scheduledAt").value("2026-06-01T10:00:00"));
    }

    @Test
    void createScheduleForDeliveryBikeReturns409() throws Exception {
        mockMvc.perform(post("/api/v1/cleaning-schedules")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "bikeId": "%s",
                      "scheduledAt": "2026-06-01T10:00:00",
                      "address": "서울시 강남구 역삼동 456"
                    }
                    """.formatted(DELIVERY_BIKE_ID)))
            .andExpect(status().isConflict());
    }

    @Test
    void listSchedulesByBikeIdReturnsOnlyThatBikesSchedules() throws Exception {
        // 일정 2개 생성
        mockMvc.perform(post("/api/v1/cleaning-schedules")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"bikeId":"%s","scheduledAt":"2026-06-01T10:00:00","address":"서울시 강남구"}
                    """.formatted(CLEANING_BIKE_ID)))
            .andExpect(status().isCreated());
        mockMvc.perform(post("/api/v1/cleaning-schedules")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"bikeId":"%s","scheduledAt":"2026-06-02T14:00:00","address":"서울시 서초구"}
                    """.formatted(CLEANING_BIKE_ID)))
            .andExpect(status().isCreated());

        mockMvc.perform(get("/api/v1/cleaning-schedules")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                .param("bikeId", CLEANING_BIKE_ID.toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(2))
            .andExpect(jsonPath("$[0].address").value("서울시 강남구"))
            .andExpect(jsonPath("$[1].address").value("서울시 서초구"));
    }
}
