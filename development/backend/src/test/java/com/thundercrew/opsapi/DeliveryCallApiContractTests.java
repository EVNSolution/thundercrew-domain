package com.thundercrew.opsapi;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.hamcrest.Matchers;
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
class DeliveryCallApiContractTests extends PostgresContainerSupport {

    private static final UUID ADMIN_ID  = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa10");
    private static final UUID BIKE_A_ID = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb10");
    private static final UUID BIKE_B_ID = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb11");
    private static final UUID BIKE_C_ID = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb12");

    private static final Pattern ACCESS_TOKEN_PATTERN =
            Pattern.compile("\\\"accessToken\\\"\\s*:\\s*\\\"([^\\\"]+)\\\"");
    private static final Pattern ID_PATTERN =
            Pattern.compile("\\\"id\\\"\\s*:\\s*\\\"([^\\\"]+)\\\"");

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
        jdbcTemplate.update("delete from dispatch_orders");
        jdbcTemplate.update("delete from dispatch_batch");
        jdbcTemplate.update("delete from bike_current_states");
        jdbcTemplate.update("delete from rider_bike_contracts");
        jdbcTemplate.update("delete from bikes");
        jdbcTemplate.update("delete from admin_users");

        jdbcTemplate.update("""
                insert into admin_users (id, login_id, email, password_hash, display_name, enabled)
                values (?, 'delivery-admin', 'delivery@example.test', ?, 'Delivery Admin', true)
                """, ADMIN_ID, passwordEncoder.encode("correct-password"));

        accessToken = loginAndExtractToken();
    }

    // ① systemDispatch — seed 1 DELIVERY bike → 200, status ASSIGNED, bikeId not null.
    //   GET /dispatch-orders?bikeId= contains the new order.
    @Test
    void systemDispatchPicksDeliveryBikeAndReturnsAssigned() throws Exception {
        seedDeliveryBike(BIKE_A_ID, "배송-A", "VIN-DELIVERY-A-001");

        MvcResult result = mockMvc.perform(post("/api/v1/dispatch-orders/calls/system")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(callBody("홍길동", "010-1111-1111", "서울 강남구 역삼동 1")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ASSIGNED"))
                .andExpect(jsonPath("$.bikeId").value(BIKE_A_ID.toString()))
                .andExpect(jsonPath("$.customerName").value("홍길동"))
                .andReturn();

        String orderId = extractId(result.getResponse().getContentAsString());

        mockMvc.perform(get("/api/v1/dispatch-orders")
                        .param("bikeId", BIKE_A_ID.toString())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                // `$[?(...)].length()` 는 매치 개수가 아니라 매치된 **객체의 필드 수**를
                // 준다(이 응답에서 19). 매치 개수를 보려면 hasSize 를 써야 한다.
                .andExpect(jsonPath("$[?(@.id=='" + orderId + "')]", hasSize(1)));
    }

    // ② least-loaded — seed 2 DELIVERY bikes A, B. Pre-assign 1 order to A.
    //   Second call/system → picks B (fewest assigned orders).
    @Test
    void systemDispatchPicksLeastLoadedDeliveryBike() throws Exception {
        seedDeliveryBike(BIKE_A_ID, "배송-A", "VIN-DELIVERY-A-002");
        seedDeliveryBike(BIKE_B_ID, "배송-B", "VIN-DELIVERY-B-002");

        // Pre-assign 1 order to BIKE_A via /calls/system (it picks least-loaded; both have 0 so it picks one).
        // We force an order on A by using the standard /dispatch-orders create endpoint (which takes explicit bikeId).
        mockMvc.perform(post("/api/v1/dispatch-orders")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"bikeId":"%s","customerName":"기존고객","customerPhone":"010-0000-0000",
                                 "address":"서울 강남구 역삼동 99","latitude":37.4987,"longitude":127.0276}
                                """.formatted(BIKE_A_ID)))
                .andExpect(status().isCreated());

        // Now /calls/system should pick BIKE_B (0 assigned) over BIKE_A (1 assigned).
        mockMvc.perform(post("/api/v1/dispatch-orders/calls/system")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(callBody("신규고객", "010-2222-2222", "서울 강남구 역삼동 2")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ASSIGNED"))
                .andExpect(jsonPath("$.bikeId").value(BIKE_B_ID.toString()));
    }

    // ③ no available bike — seed a CLEANING bike (not DELIVERY) → POST /calls/system → 409,
    //   response body contains "배송 차량".
    @Test
    void systemDispatchReturns409WhenNoDeliveryBikeExists() throws Exception {
        seedCleaningBike(BIKE_C_ID, "클리닝-C", "VIN-CLEANING-C-001");

        MvcResult result = mockMvc.perform(post("/api/v1/dispatch-orders/calls/system")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(callBody("고객X", "010-9999-9999", "서울 종로구 청진동 1")))
                .andExpect(status().isConflict())
                .andReturn();

        assertThat(result.getResponse().getContentAsString()).contains("배송 차량");
    }

    // ④ offer + list — POST /calls/offer → 200, status OFFERED, bikeId null.
    //   GET /calls/offered contains the new order.
    @Test
    void offerCallReturnsOfferedStatusWithNullBikeId() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/dispatch-orders/calls/offer")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(callBody("오퍼고객", "010-3333-3333", "서울 마포구 합정동 1")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("OFFERED"))
                .andExpect(jsonPath("$.bikeId").value(Matchers.nullValue()))
                .andReturn();

        String offeredId = extractId(result.getResponse().getContentAsString());

        mockMvc.perform(get("/api/v1/dispatch-orders/calls/offered")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id=='" + offeredId + "')]", hasSize(1)));
    }

    // ⑤ accept — offer then accept with a DELIVERY bike → 200, status ASSIGNED, bikeId set.
    //   GET /dispatch-orders?bikeId= contains it; GET /calls/offered no longer contains it.
    @Test
    void acceptCallAssignsOfferedOrderToDeliveryBike() throws Exception {
        seedDeliveryBike(BIKE_A_ID, "배송-A", "VIN-DELIVERY-A-005");

        MvcResult offerResult = mockMvc.perform(post("/api/v1/dispatch-orders/calls/offer")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(callBody("수락고객", "010-4444-4444", "서울 서초구 방배동 1")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("OFFERED"))
                .andReturn();

        String offeredId = extractId(offerResult.getResponse().getContentAsString());

        mockMvc.perform(post("/api/v1/dispatch-orders/calls/{id}/accept", offeredId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"bikeId":"%s"}
                                """.formatted(BIKE_A_ID)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ASSIGNED"))
                .andExpect(jsonPath("$.bikeId").value(BIKE_A_ID.toString()));

        // Now visible in /dispatch-orders?bikeId=
        mockMvc.perform(get("/api/v1/dispatch-orders")
                        .param("bikeId", BIKE_A_ID.toString())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id=='" + offeredId + "')]", hasSize(1)));

        // No longer in /calls/offered
        mockMvc.perform(get("/api/v1/dispatch-orders/calls/offered")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id=='" + offeredId + "')]").isEmpty());
    }

    // ⑥ re-accept — accepting an already-ASSIGNED order → 409.
    @Test
    void reAcceptAlreadyAssignedOrderReturns409() throws Exception {
        seedDeliveryBike(BIKE_A_ID, "배송-A", "VIN-DELIVERY-A-006");

        MvcResult offerResult = mockMvc.perform(post("/api/v1/dispatch-orders/calls/offer")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(callBody("재수락고객", "010-5555-5555", "서울 동작구 상도동 1")))
                .andExpect(status().isOk())
                .andReturn();

        String offeredId = extractId(offerResult.getResponse().getContentAsString());

        // First accept
        mockMvc.perform(post("/api/v1/dispatch-orders/calls/{id}/accept", offeredId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"bikeId":"%s"}
                                """.formatted(BIKE_A_ID)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ASSIGNED"));

        // Second accept → 409
        mockMvc.perform(post("/api/v1/dispatch-orders/calls/{id}/accept", offeredId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"bikeId":"%s"}
                                """.formatted(BIKE_A_ID)))
                .andExpect(status().isConflict());
    }

    // ⑦ acceptCall with non-CALL bike → 409
    @Test
    void acceptCallWithNonCallBikeIsRejected() throws Exception {
        seedCleaningBike(BIKE_C_ID, "순차-C2", "VIN-SEQ-C-007");

        MvcResult offerResult = mockMvc.perform(post("/api/v1/dispatch-orders/calls/offer")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(callBody("거절고객", "010-6666-6666", "서울 은평구 응암동 1")))
                .andExpect(status().isOk())
                .andReturn();

        String offeredId = extractId(offerResult.getResponse().getContentAsString());

        mockMvc.perform(post("/api/v1/dispatch-orders/calls/{id}/accept", offeredId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"bikeId":"%s"}
                                """.formatted(BIKE_C_ID)))
                .andExpect(status().isConflict());
    }

    // --- helpers ---------------------------------------------------------

    /**
     * Seed a CALL bike (effective serviceType = 'CALL' via active contract).
     * CALL is the only type eligible for systemDispatch and acceptCall.
     */
    private void seedDeliveryBike(UUID id, String plateNumber, String vin) {
        jdbcTemplate.update("""
                insert into bikes (id, plate_number, vin, model_name, engine_type, operation_status, ignition_blocked)
                values (?, ?, ?, 'Thunder M1', 'ELECTRIC', 'IN_SERVICE', false)
                """, id, plateNumber, vin);
        seedActiveServiceContract(id, "CALL");
    }

    /**
     * Seed a SEQUENTIAL bike (effective serviceType = 'SEQUENTIAL' via active contract) — cleaning-family, not eligible for delivery auto-dispatch.
     */
    private void seedCleaningBike(UUID id, String plateNumber, String vin) {
        jdbcTemplate.update("""
                insert into bikes (id, plate_number, vin, model_name, engine_type, operation_status, ignition_blocked)
                values (?, ?, ?, 'Cleaning Van', 'ICE', 'IN_SERVICE', false)
                """, id, plateNumber, vin);
        seedActiveServiceContract(id, "SEQUENTIAL");
    }

    private void seedActiveServiceContract(java.util.UUID bikeId, String serviceType) {
        jdbcTemplate.update(
                "insert into rider_bike_contracts (id, rider_id, bike_id, contract_template_id, start_at, service_type) "
                + "values (?, ?, ?, ?, now(), ?)",
                java.util.UUID.randomUUID(), java.util.UUID.randomUUID(), bikeId, java.util.UUID.randomUUID(), serviceType);
    }

    private String callBody(String name, String phone, String address) {
        return """
                {"customerName":"%s","customerPhone":"%s","address":"%s","latitude":37.4987,"longitude":127.0276}
                """.formatted(name, phone, address);
    }

    private String loginAndExtractToken() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"loginId":"delivery-admin","password":"correct-password"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isString())
                .andReturn();

        Matcher matcher = ACCESS_TOKEN_PATTERN.matcher(result.getResponse().getContentAsString());
        assertThat(matcher.find()).isTrue();
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
