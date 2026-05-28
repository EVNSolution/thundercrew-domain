package com.thundercrew.opsapi;

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
class BikeNextCustomerApiContractTests extends PostgresContainerSupport {

    private static final UUID ADMIN_ID        = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final UUID CLEANING_BIKE   = UUID.fromString("cccccccc-cccc-cccc-cccc-cccccccccccc");
    private static final UUID DELIVERY_BIKE   = UUID.fromString("dddddddd-dddd-dddd-dddd-dddddddddddd");
    private static final Pattern TOKEN_PATTERN =
            Pattern.compile("\"accessToken\"\\s*:\\s*\"([^\"]+)\"");

    @Autowired MockMvc mockMvc;
    @Autowired JdbcTemplate jdbcTemplate;
    @Autowired PasswordEncoder passwordEncoder;

    private String accessToken;

    @DynamicPropertySource
    static void postgresProperties(DynamicPropertyRegistry registry) {
        registerPostgresProperties(registry);
    }

    @BeforeEach
    void setUp() throws Exception {
        jdbcTemplate.update("delete from bike_next_customer");
        jdbcTemplate.update("delete from bike_operation_status_histories");
        jdbcTemplate.update("delete from bikes");
        jdbcTemplate.update("delete from admin_users");

        jdbcTemplate.update("""
                insert into admin_users (id, login_id, email, password_hash, display_name, enabled)
                values (?, 'ops-admin', 'ops@example.test', ?, 'Ops Admin', true)
                """, ADMIN_ID, passwordEncoder.encode("correct-password"));

        jdbcTemplate.update("""
                insert into bikes (id, plate_number, model_name, engine_type, service_type,
                                   operation_status, ignition_blocked)
                values (?, '서울CC-0001', '청소차 M1', 'ICE', 'CLEANING', 'IN_SERVICE', false)
                """, CLEANING_BIKE);

        jdbcTemplate.update("""
                insert into bikes (id, plate_number, model_name, engine_type, service_type,
                                   operation_status, ignition_blocked)
                values (?, '서울DD-0001', '배송 오토바이', 'ELECTRIC', 'DELIVERY', 'IN_SERVICE', false)
                """, DELIVERY_BIKE);

        accessToken = loginAndExtractToken();
    }

    @Test
    void get_returnsNotFoundWhenNotSet() throws Exception {
        mockMvc.perform(get("/api/v1/bikes/{id}/next-customer", CLEANING_BIKE)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isNotFound());
    }

    @Test
    void put_thenGet_roundTrip() throws Exception {
        String body = """
                {
                  "customerName":  "홍길동",
                  "customerPhone": "010-1234-5678",
                  "address":       "서울 강남구 역삼동 123",
                  "latitude":      37.4987,
                  "longitude":     127.0276
                }
                """;

        mockMvc.perform(put("/api/v1/bikes/{id}/next-customer", CLEANING_BIKE)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.customerName").value("홍길동"))
                .andExpect(jsonPath("$.customerPhone").value("010-1234-5678"))
                .andExpect(jsonPath("$.latitude").value(37.4987))
                .andExpect(jsonPath("$.longitude").value(127.0276));

        mockMvc.perform(get("/api/v1/bikes/{id}/next-customer", CLEANING_BIKE)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.customerName").value("홍길동"));
    }

    @Test
    void put_upsertOverwritesExistingRow() throws Exception {
        String first = """
                {"customerName":"이순신","customerPhone":"010-1111-2222",
                 "address":"서울 종로구 1","latitude":37.5762,"longitude":126.9769}
                """;
        String second = """
                {"customerName":"김철수","customerPhone":"010-9999-8888",
                 "address":"서울 강남구 2","latitude":37.4987,"longitude":127.0276}
                """;

        mockMvc.perform(put("/api/v1/bikes/{id}/next-customer", CLEANING_BIKE)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON).content(first))
                .andExpect(status().isOk());

        mockMvc.perform(put("/api/v1/bikes/{id}/next-customer", CLEANING_BIKE)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON).content(second))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.customerName").value("김철수"));

        mockMvc.perform(get("/api/v1/bikes/{id}/next-customer", CLEANING_BIKE)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.customerName").value("김철수"));
    }

    @Test
    void put_rejectsDeliveryBikeWith409() throws Exception {
        mockMvc.perform(put("/api/v1/bikes/{id}/next-customer", DELIVERY_BIKE)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"customerName":"홍길동","customerPhone":"010-1234-5678",
                                 "address":"서울 강남구","latitude":37.4987,"longitude":127.0276}
                                """))
                .andExpect(status().isConflict());
    }

    @Test
    void put_returnsValidationErrorForBlankName() throws Exception {
        mockMvc.perform(put("/api/v1/bikes/{id}/next-customer", CLEANING_BIKE)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"customerName":"","customerPhone":"010-1234-5678",
                                 "address":"서울 강남구","latitude":37.4987,"longitude":127.0276}
                                """))
                .andExpect(status().isBadRequest());
    }

    private String loginAndExtractToken() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"loginId\":\"ops-admin\",\"password\":\"correct-password\"}"))
                .andReturn();
        Matcher m = TOKEN_PATTERN.matcher(result.getResponse().getContentAsString());
        if (!m.find()) throw new IllegalStateException("No access token in login response");
        return m.group(1);
    }
}
