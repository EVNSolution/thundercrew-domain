package com.thundercrew.opsapi;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.ArrayList;
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
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
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
class DispatchRoundApiContractTests extends PostgresContainerSupport {

    private static final UUID ADMIN_ID   = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab");
    private static final UUID BIKE_ID    = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbc");
    private static final UUID SINGLE_BIKE_ID = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbe");
    private static final UUID DEVICE_ID  = UUID.fromString("cccccccc-cccc-cccc-cccc-cccccccccccd");
    private static final String BIKE_PLATE = "서울CC-0002";

    private static final Pattern ACCESS_TOKEN_PATTERN =
            Pattern.compile("\\\"accessToken\\\"\\s*:\\s*\\\"([^\\\"]+)\\\"");
    private static final Pattern ID_PATTERN =
            Pattern.compile("\\\"id\\\"\\s*:\\s*\\\"([^\\\"]+)\\\"");
    private static final Pattern BATCH_ID_PATTERN =
            Pattern.compile("\\\"batchId\\\"\\s*:\\s*\\\"([^\\\"]+)\\\"");

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
                values (?, 'round-admin', 'round@example.test', ?, 'Round Admin', true)
                """, ADMIN_ID, passwordEncoder.encode("correct-password"));

        seedBike(BIKE_ID, BIKE_PLATE, "VIN-ROUND-001", "IN_SERVICE");
        seedBikeWithServiceType(SINGLE_BIKE_ID, "서울CC-0010", "VIN-SINGLE-ROUND-001", "IN_SERVICE", "SINGLE");

        accessToken = loginAndExtractToken();
    }

    // ① createRound — POST /dispatch-batches/round → 200, COLLECTING, pickupTotal==N, pickupDone==0,
    //   deliveryTotal==0. GET /dispatch-orders?bikeId → N orders with kind==PICKUP, status==ASSIGNED.
    @Test
    void createRoundReturnsBatchInCollectingWithPickupOrders() throws Exception {
        int n = 2;
        String body = buildRoundBody(n);

        MvcResult result = mockMvc.perform(post("/api/v1/dispatch-batches/round")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.batchId").isString())
                .andExpect(jsonPath("$.status").value("COLLECTING"))
                .andExpect(jsonPath("$.pickupTotal").value(n))
                .andExpect(jsonPath("$.pickupDone").value(0))
                .andExpect(jsonPath("$.deliveryTotal").value(0))
                .andExpect(jsonPath("$.deliveryDone").value(0))
                .andReturn();

        assertThat(result.getResponse().getStatus()).isEqualTo(200);

        mockMvc.perform(get("/api/v1/dispatch-orders")
                        .param("bikeId", BIKE_ID.toString())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(n))
                .andExpect(jsonPath("$[0].kind").value("PICKUP"))
                .andExpect(jsonPath("$[0].status").value("ASSIGNED"))
                .andExpect(jsonPath("$[1].kind").value("PICKUP"))
                .andExpect(jsonPath("$[1].status").value("ASSIGNED"));
    }

    // ② concurrent round rejected — second POST /dispatch-batches/round with active round present → 409
    //   (InvalidStateTransitionException → GlobalExceptionHandler → 409 CONFLICT with message body).
    @Test
    void secondCreateRoundIsRejectedWhenActiveRoundExists() throws Exception {
        mockMvc.perform(post("/api/v1/dispatch-batches/round")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(buildRoundBody(1)))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/dispatch-batches/round")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(buildRoundBody(1)))
                .andExpect(status().isConflict());
    }

    // ③ start-delivery gate — with pickups still ASSIGNED, POST /start-delivery → 409, message references "수거".
    @Test
    void startDeliveryIsRejectedWhenPickupsAreIncomplete() throws Exception {
        String batchId = createRound(1);

        MvcResult result = mockMvc.perform(post("/api/v1/dispatch-batches/{id}/start-delivery", batchId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isConflict())
                .andReturn();

        assertThat(result.getResponse().getContentAsString()).contains("수거");
    }

    // ④ full pickup → transition — complete all PICKUP orders, POST /start-delivery → 200, DELIVERING,
    //   deliveryTotal==N. GET /dispatch-orders?bikeId → N DELIVERY orders ASSIGNED plus N completed pickups.
    @Test
    void startDeliverySucceedsAfterAllPickupsCompleted() throws Exception {
        int n = 2;
        String batchId = createRound(n);

        List<String> pickupIds = listOrderIds(BIKE_ID);
        assertThat(pickupIds).hasSize(n);
        for (String orderId : pickupIds) {
            mockMvc.perform(completeWithPhoto(orderId))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("COMPLETED"));
        }

        mockMvc.perform(post("/api/v1/dispatch-batches/{id}/start-delivery", batchId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DELIVERING"))
                .andExpect(jsonPath("$.deliveryTotal").value(n))
                .andExpect(jsonPath("$.pickupDone").value(n));

        mockMvc.perform(get("/api/v1/dispatch-orders")
                        .param("bikeId", BIKE_ID.toString())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                // n PICKUP (COMPLETED) + n DELIVERY (ASSIGNED)
                .andExpect(jsonPath("$.length()").value(n * 2))
                // `$[?(...)].length()` 는 매치 개수가 아니라 매치된 객체의 필드 수 목록을 준다
                // (실제로 [19,19] 가 나왔다). 매치 개수를 보려면 hasSize 다.
                .andExpect(jsonPath("$[?(@.kind=='DELIVERY' && @.status=='ASSIGNED')]", hasSize(n)));
    }

    // ⑤ delivery complete → DONE — complete all DELIVERY orders, then GET /dispatch-batches/active → 204.
    @Test
    void activeRoundReturns204AfterAllDeliveriesCompleted() throws Exception {
        int n = 2;
        String batchId = createRound(n);

        // Complete all pickups
        List<String> pickupIds = listOrderIds(BIKE_ID);
        for (String orderId : pickupIds) {
            mockMvc.perform(completeWithPhoto(orderId))
                    .andExpect(status().isOk());
        }

        // Transition to delivery
        mockMvc.perform(post("/api/v1/dispatch-batches/{id}/start-delivery", batchId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DELIVERING"));

        // Collect the new DELIVERY order ids (ASSIGNED ones among all orders)
        List<String> deliveryIds = listOrderIdsByKind(BIKE_ID, "DELIVERY");
        assertThat(deliveryIds).hasSize(n);
        for (String orderId : deliveryIds) {
            mockMvc.perform(completeWithPhoto(orderId))
                    .andExpect(status().isOk());
        }

        // Batch should now be DONE → /active returns 204
        mockMvc.perform(get("/api/v1/dispatch-batches/active")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isNoContent());
    }

    // ⑥ dashboard currentDispatchKind — after createRound, GET /dashboard/map-state → bikePin has
    //   currentDispatchKind == "PICKUP".
    @Test
    void dashboardBikePinExposesCurrentDispatchKindAfterCreateRound() throws Exception {
        insertCurrentState(BIKE_ID, DEVICE_ID, Instant.now().minusSeconds(60), "ON", "10.00", "80.00");

        createRound(1);

        mockMvc.perform(get("/api/v1/dashboard/map-state")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bikePins[?(@.bikeId=='" + BIKE_ID + "')].currentDispatchKind")
                        .value(org.hamcrest.Matchers.contains("PICKUP")));
    }

    // ⑦ createRound with non-ROUND bike → 409 (invalid service type)
    @Test
    void createRoundWithNonRoundBikeIsRejected() throws Exception {
        String body = """
                {"rows":[{"bikeId":"%s","customerName":"비라운드","customerPhone":"010-9999-1111",
                 "address":"서울 강남구 역삼동 1","latitude":37.4987,"longitude":127.0276}]}
                """.formatted(SINGLE_BIKE_ID);

        mockMvc.perform(post("/api/v1/dispatch-batches/round")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isConflict());
    }

    // --- helpers ---------------------------------------------------------

    private String buildRoundBody(int n) {
        StringBuilder sb = new StringBuilder("{\"rows\":[");
        for (int i = 0; i < n; i++) {
            if (i > 0) sb.append(',');
            sb.append("""
                    {"bikeId":"%s","customerName":"라운드고객%d","customerPhone":"010-%04d-%04d",
                     "address":"서울 강남구 역삼동 %d","latitude":37.%d,"longitude":127.%d}
                    """.formatted(BIKE_ID, i + 1, i + 1, i + 1, i + 100, 4987 + i, 276 + i));
        }
        sb.append("]}");
        return sb.toString();
    }

    /**
     * Creates a round with n rows and returns the batchId.
     */
    /**
     * 배송 완료는 **증빙 사진을 요구한다** — `POST /{id}/complete` 가
     * `consumes = multipart/form-data` 이고 `photo` 파트를 받는다.
     *
     * 전에는 본문 없이 POST 해서 `HttpMediaTypeNotSupportedException` 이 났다. 사진
     * 요구가 나중에 추가됐는데 이 테스트가 따라오지 못한 것이다. 여기서 완료는 준비
     * 단계이므로 최소한의 사진을 실어 보낸다.
     */
    private MockHttpServletRequestBuilder completeWithPhoto(String orderId) {
        MockMultipartFile photo = new MockMultipartFile(
                "photo", "proof.jpg", "image/jpeg", new byte[] {1, 2, 3});
        return multipart("/api/v1/dispatch-orders/{id}/complete", orderId)
                .file(photo)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken);
    }

    private String createRound(int n) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/dispatch-batches/round")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(buildRoundBody(n)))
                .andExpect(status().isOk())
                .andReturn();
        return extractBatchId(result.getResponse().getContentAsString());
    }

    /**
     * Lists all order ids for a bike (in sequence order, as returned by the API).
     */
    private List<String> listOrderIds(UUID bikeId) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/dispatch-orders")
                        .param("bikeId", bikeId.toString())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andReturn();
        return extractAllIds(result.getResponse().getContentAsString());
    }

    /**
     * Lists order ids for a bike that match the given kind (PICKUP or DELIVERY).
     * Uses a simple filter on the JSON response; collects all ids for matching objects.
     */
    private List<String> listOrderIdsByKind(UUID bikeId, String kind) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/dispatch-orders")
                        .param("bikeId", bikeId.toString())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andReturn();
        String body = result.getResponse().getContentAsString();
        // Parse each object block { ... } in the JSON array, collect id where kind matches.
        List<String> ids = new ArrayList<>();
        Pattern objPattern = Pattern.compile("\\{[^\\{\\}]*\\}");
        Matcher objMatcher = objPattern.matcher(body);
        while (objMatcher.find()) {
            String obj = objMatcher.group();
            if (obj.contains("\"" + kind + "\"")) {
                Matcher idMatcher = ID_PATTERN.matcher(obj);
                if (idMatcher.find()) {
                    ids.add(idMatcher.group(1));
                }
            }
        }
        return ids;
    }

    private void seedBike(UUID id, String plateNumber, String vin, String operationStatus) {
        jdbcTemplate.update("""
                insert into bikes (id, plate_number, vin, model_name, operation_status)
                values (?, ?, ?, 'Thunder M1', ?)
                """, id, plateNumber, vin, operationStatus);
        seedActiveServiceContract(id, "ROUND");
    }

    private void seedBikeWithServiceType(UUID id, String plateNumber, String vin,
                                         String operationStatus, String serviceType) {
        jdbcTemplate.update("""
                insert into bikes (id, plate_number, vin, model_name, operation_status)
                values (?, ?, ?, 'Thunder M1', ?)
                """, id, plateNumber, vin, operationStatus);
        seedActiveServiceContract(id, serviceType);
    }

    private void seedActiveServiceContract(java.util.UUID bikeId, String serviceType) {
        jdbcTemplate.update(
                "insert into rider_bike_contracts (id, rider_id, bike_id, contract_template_id, start_at, service_type) "
                + "values (?, ?, ?, ?, now(), ?)",
                java.util.UUID.randomUUID(), java.util.UUID.randomUUID(), bikeId, java.util.UUID.randomUUID(), serviceType);
    }

    private void insertCurrentState(UUID bikeId, UUID deviceId, Instant receivedAt,
                                    String ignitionStatus, String speedKph, String batteryPercent) {
        jdbcTemplate.update("""
                insert into bike_current_states (
                    bike_id, device_id, telemetry_log_id, last_received_at,
                    latitude, longitude, speed_kph, battery_percent, ignition_status, telemetry_source
                ) values (?, ?, ?, ?::timestamptz, 37.5010000, 127.0396000, ?::numeric, ?::numeric, ?, 'POLLING')
                """, bikeId, deviceId, UUID.randomUUID(), receivedAt.toString(), speedKph, batteryPercent, ignitionStatus);
    }

    private String loginAndExtractToken() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"loginId":"round-admin","password":"correct-password"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isString())
                .andReturn();

        Matcher matcher = ACCESS_TOKEN_PATTERN.matcher(result.getResponse().getContentAsString());
        assertThat(matcher.find()).isTrue();
        return matcher.group(1);
    }

    private String extractBatchId(String json) {
        Matcher matcher = BATCH_ID_PATTERN.matcher(json);
        if (!matcher.find()) {
            throw new IllegalStateException("No batchId in response: " + json);
        }
        return matcher.group(1);
    }

    private String extractId(String json) {
        Matcher matcher = ID_PATTERN.matcher(json);
        if (!matcher.find()) {
            throw new IllegalStateException("No id in response: " + json);
        }
        return matcher.group(1);
    }

    private List<String> extractAllIds(String json) {
        List<String> ids = new ArrayList<>();
        Matcher matcher = ID_PATTERN.matcher(json);
        while (matcher.find()) {
            ids.add(matcher.group(1));
        }
        return ids;
    }
}
