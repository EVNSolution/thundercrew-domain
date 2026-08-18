package com.thundercrew.opsapi;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.ByteArrayOutputStream;
import java.time.Instant;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class DispatchOrderApiContractTests extends PostgresContainerSupport {

    private static final UUID ADMIN_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final UUID BIKE_ID = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private static final UUID SEQ_BIKE_ID = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbd");
    private static final UUID DEVICE_ID = UUID.fromString("cccccccc-cccc-cccc-cccc-cccccccccccc");
    private static final String BIKE_PLATE = "서울CC-0001";
    private static final String SEQ_BIKE_PLATE = "서울CC-0009";

    /** Matches dispatch-template.xlsx: 0-based row 2 is the first data row (header at row 1). */
    private static final int DATA_START_ROW = 2;

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
        jdbcTemplate.update("delete from audit_logs");
        jdbcTemplate.update("delete from dispatch_orders");
        jdbcTemplate.update("delete from bike_current_states");
        jdbcTemplate.update("delete from rider_bike_contracts");
        jdbcTemplate.update("delete from bikes");
        jdbcTemplate.update("delete from admin_users");

        jdbcTemplate.update("""
                insert into admin_users (id, login_id, email, password_hash, display_name, enabled)
                values (?, 'ops-admin', 'ops@example.test', ?, 'Ops Admin', true)
                """, ADMIN_ID, passwordEncoder.encode("correct-password"));

        seedBike(BIKE_ID, BIKE_PLATE, "VIN-DISPATCH-001", "IN_SERVICE", "SINGLE");
        seedBike(SEQ_BIKE_ID, SEQ_BIKE_PLATE, "VIN-DISPATCH-SEQ-001", "IN_SERVICE", "SEQUENTIAL");

        accessToken = loginAndExtractToken();
    }

    // ① 단건 POST 생성 → 201, id/idx 생성, status ASSIGNED, sequence 1
    @Test
    void createReturns201WithAssignedStatusAndSequenceOne() throws Exception {
        mockMvc.perform(post("/api/v1/dispatch-orders")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody("홍길동", "010-1234-5678", "서울 강남구 역삼동 123", 37.4987, 127.0276)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isString())
                .andExpect(jsonPath("$.idx").isNumber())
                .andExpect(jsonPath("$.bikeId").value(BIKE_ID.toString()))
                .andExpect(jsonPath("$.customerName").value("홍길동"))
                .andExpect(jsonPath("$.customerPhone").value("010-1234-5678"))
                .andExpect(jsonPath("$.address").value("서울 강남구 역삼동 123"))
                .andExpect(jsonPath("$.latitude").value(37.4987))
                .andExpect(jsonPath("$.longitude").value(127.0276))
                .andExpect(jsonPath("$.sequence").value(1))
                .andExpect(jsonPath("$.status").value("ASSIGNED"))
                .andExpect(jsonPath("$.completedAt").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.createdAt").isString());
    }

    // ② 같은 차량 2건 생성 → GET ?bikeId 2행, sequence 1, 2 (오름차순)
    @Test
    void twoCreatesForSameBikeAreListedWithAscendingSequences() throws Exception {
        createOrder("고객A", "010-1111-1111", "주소 A");
        createOrder("고객B", "010-2222-2222", "주소 B");

        mockMvc.perform(get("/api/v1/dispatch-orders")
                        .param("bikeId", BIKE_ID.toString())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].sequence").value(1))
                .andExpect(jsonPath("$[0].customerName").value("고객A"))
                .andExpect(jsonPath("$[1].sequence").value(2))
                .andExpect(jsonPath("$[1].customerName").value("고객B"));
    }

    // ③ complete → 해당 건 COMPLETED. 목록은 완료 건도 유지(soft delete 만 제외).
    @Test
    void completeMarksOrderCompletedAndListStillIncludesIt() throws Exception {
        String firstId = createOrder("고객A", "010-1111-1111", "주소 A");
        createOrder("고객B", "010-2222-2222", "주소 B");

        completeOrder(firstId);

        mockMvc.perform(get("/api/v1/dispatch-orders")
                        .param("bikeId", BIKE_ID.toString())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].id").value(firstId))
                .andExpect(jsonPath("$[0].status").value("COMPLETED"))
                .andExpect(jsonPath("$[1].status").value("ASSIGNED"));
    }

    // ③-photo: 사진 포함 완료 → COMPLETED, hasCompletionPhoto=true, GET 사진 엔드포인트 바이트/콘텐츠타입 반환
    @Test
    void completeWithPhotoStoresPhotoAndRetrievesItViaPhotoEndpoint() throws Exception {
        String orderId = createOrder("사진고객", "010-9999-0000", "사진 주소");
        byte[] photoBytes = new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0x00, 0x10};

        MockMultipartFile photo = new MockMultipartFile("photo", "test.jpg", "image/jpeg", photoBytes);

        mockMvc.perform(multipart("/api/v1/dispatch-orders/{id}/complete", orderId)
                        .file(photo)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(orderId))
                .andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.completedAt").isString())
                .andExpect(jsonPath("$.hasCompletionPhoto").value(true));

        mockMvc.perform(get("/api/v1/dispatch-orders/{id}/completion-photo", orderId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(result -> {
                    byte[] body = result.getResponse().getContentAsByteArray();
                    assertThat(body).isEqualTo(photoBytes);
                    assertThat(result.getResponse().getContentType()).startsWith("image/jpeg");
                });
    }

    // ③-nophoto: 사진 없이 완료 시도 → 거부 (400/409)
    @Test
    void completeWithoutPhotoIsRejected() throws Exception {
        String orderId = createOrder("사진없음고객", "010-0000-1111", "주소");

        MockMultipartFile emptyPhoto = new MockMultipartFile("photo", "empty.jpg", "image/jpeg", new byte[0]);

        mockMvc.perform(multipart("/api/v1/dispatch-orders/{id}/complete", orderId)
                        .file(emptyPhoto)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(result -> assertThat(result.getResponse().getStatus()).isIn(400, 409));
    }

    // ③-completed-list: GET /completed?bikeId → hasCompletionPhoto=true 인 COMPLETED 건 반환
    @Test
    void completedByBikeListsCompletedOrdersWithHasCompletionPhotoTrue() throws Exception {
        String orderId = createOrder("완료목록고객", "010-1234-0000", "완료 주소");
        completeOrder(orderId);

        mockMvc.perform(get("/api/v1/dispatch-orders/completed")
                        .param("bikeId", BIKE_ID.toString())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(orderId))
                .andExpect(jsonPath("$[0].status").value("COMPLETED"))
                .andExpect(jsonPath("$[0].hasCompletionPhoto").value(true));
    }

    // ③-audit: complete → audit_logs 에 DISPATCH_ORDER/status 행 생성
    @Test
    void completeRecordsAuditLog() throws Exception {
        String orderId = createOrder("감사고객", "010-5678-0000", "감사 주소");
        completeOrder(orderId);

        int count = jdbcTemplate.queryForObject(
                "select count(*) from audit_logs where entity_type='DISPATCH_ORDER' and entity_id=?::uuid and field='status' and old_value='ASSIGNED' and new_value='COMPLETED'",
                Integer.class,
                orderId);
        assertThat(count).isEqualTo(1);
    }

    // ④ DELETE → 204, 소프트 삭제로 목록에서 제외
    @Test
    void deleteSoftDeletesOrderSoItIsExcludedFromList() throws Exception {
        String firstId = createOrder("고객A", "010-1111-1111", "주소 A");
        createOrder("고객B", "010-2222-2222", "주소 B");

        mockMvc.perform(delete("/api/v1/dispatch-orders/{id}", firstId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/dispatch-orders")
                        .param("bikeId", BIKE_ID.toString())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].customerName").value("고객B"));
    }

    // ⑤ bulk-apply (JSON, 2행) → applied=2, GET ?bikeId 큐에 append
    @Test
    void bulkApplyAppliesRowsAndAppendsThemToBikeQueue() throws Exception {
        createOrder("기존고객", "010-0000-0000", "기존 주소"); // sequence 1

        String body = """
                {
                  "rows": [
                    {"bikeId":"%1$s","customerName":"벌크A","customerPhone":"010-3333-3333",
                     "address":"벌크 주소 A","latitude":37.50,"longitude":127.00},
                    {"bikeId":"%1$s","customerName":"벌크B","customerPhone":"010-4444-4444",
                     "address":"벌크 주소 B","latitude":37.51,"longitude":127.01}
                  ]
                }
                """.formatted(BIKE_ID);

        mockMvc.perform(post("/api/v1/dispatch-orders/bulk-apply")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.applied").value(2))
                .andExpect(jsonPath("$.skipped").value(0));

        mockMvc.perform(get("/api/v1/dispatch-orders")
                        .param("bikeId", BIKE_ID.toString())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[1].customerName").value("벌크A"))
                .andExpect(jsonPath("$[1].sequence").value(2))
                .andExpect(jsonPath("$[2].customerName").value("벌크B"))
                .andExpect(jsonPath("$[2].sequence").value(3));
    }

    // ⑥ bulk-preview: 존재하지 않는 차량번호 행 ERROR + 정상 행 NEW + summary 카운트
    @Test
    void bulkPreviewMarksUnknownPlateAsErrorAndValidRowAsNew() throws Exception {
        byte[] xlsx = buildUploadWorkbook(
                new String[] {BIKE_PLATE, "정상고객", "010-5555-5555", "정상 주소"},
                new String[] {"없는차량-9999", "에러고객", "010-6666-6666", "에러 주소"});

        MockMultipartFile file = new MockMultipartFile(
                "file", "upload.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", xlsx);

        mockMvc.perform(multipart("/api/v1/dispatch-orders/bulk-preview")
                        .file(file)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rows.length()").value(2))
                .andExpect(jsonPath("$.rows[0].plateNumber").value(BIKE_PLATE))
                .andExpect(jsonPath("$.rows[0].bikeId").value(BIKE_ID.toString()))
                .andExpect(jsonPath("$.rows[0].customerName").value("정상고객"))
                .andExpect(jsonPath("$.rows[0].status").value("NEW"))
                .andExpect(jsonPath("$.rows[1].plateNumber").value("없는차량-9999"))
                .andExpect(jsonPath("$.rows[1].bikeId").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.rows[1].status").value("ERROR"))
                .andExpect(jsonPath("$.rows[1].message").isString())
                .andExpect(jsonPath("$.summary.new").value(1))
                .andExpect(jsonPath("$.summary.error").value(1))
                .andExpect(jsonPath("$.summary.total").value(2));
    }

    // ⑦ bulk-preview-sequential: 순번 컬럼 있는 엑셀 → NEW rows에 sequence 포함, 잘못된 순번 행 → ERROR
    @Test
    void bulkPreviewSequentialReturnsSequenceOnNewRowsAndErrorOnInvalidSequence() throws Exception {
        byte[] xlsx = buildSequentialWorkbook(
                new String[]{SEQ_BIKE_PLATE, "순차고객A", "010-1111-2222", "순차 주소 A", "2"},
                new String[]{SEQ_BIKE_PLATE, "순차고객B", "010-3333-4444", "순차 주소 B", "1"},
                new String[]{SEQ_BIKE_PLATE, "순번없음", "010-5555-6666", "주소 C", ""},
                new String[]{SEQ_BIKE_PLATE, "순번오류", "010-7777-8888", "주소 D", "abc"});

        MockMultipartFile file = new MockMultipartFile(
                "file", "upload-seq.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", xlsx);

        mockMvc.perform(multipart("/api/v1/dispatch-orders/bulk-preview-sequential")
                        .file(file)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rows.length()").value(4))
                .andExpect(jsonPath("$.rows[0].status").value("NEW"))
                .andExpect(jsonPath("$.rows[0].sequence").value(2))
                .andExpect(jsonPath("$.rows[0].customerName").value("순차고객A"))
                .andExpect(jsonPath("$.rows[1].status").value("NEW"))
                .andExpect(jsonPath("$.rows[1].sequence").value(1))
                .andExpect(jsonPath("$.rows[1].customerName").value("순차고객B"))
                .andExpect(jsonPath("$.rows[2].status").value("ERROR"))
                .andExpect(jsonPath("$.rows[2].message").value("순번 없음"))
                .andExpect(jsonPath("$.rows[3].status").value("ERROR"))
                .andExpect(jsonPath("$.rows[3].message").value("순번 형식 오류: abc"))
                .andExpect(jsonPath("$.summary.new").value(2))
                .andExpect(jsonPath("$.summary.error").value(2))
                .andExpect(jsonPath("$.summary.total").value(4));
    }

    // ⑧ bulk-apply-sequential: 순번 역순으로 전송 → 차량 큐에 순번 오름차순으로 append
    @Test
    void bulkApplySequentialAppendsBikeQueueInSequenceOrder() throws Exception {
        // 순번을 역순(3,1,2)으로 전송 → 실제 저장 sequence 는 1,2,3 (순번 오름차순 append 결과)
        String body = """
                {
                  "rows": [
                    {"bikeId":"%1$s","customerName":"순차C","customerPhone":"010-3333-3333",
                     "address":"주소 C","latitude":37.50,"longitude":127.00,"sequence":3},
                    {"bikeId":"%1$s","customerName":"순차A","customerPhone":"010-1111-1111",
                     "address":"주소 A","latitude":37.50,"longitude":127.00,"sequence":1},
                    {"bikeId":"%1$s","customerName":"순차B","customerPhone":"010-2222-2222",
                     "address":"주소 B","latitude":37.50,"longitude":127.00,"sequence":2}
                  ]
                }
                """.formatted(SEQ_BIKE_ID);

        mockMvc.perform(post("/api/v1/dispatch-orders/bulk-apply-sequential")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.applied").value(3))
                .andExpect(jsonPath("$.skipped").value(0));

        // 큐 조회: appendForBike 는 순번 오름차순으로 호출되었으므로 저장 sequence 1→A, 2→B, 3→C
        mockMvc.perform(get("/api/v1/dispatch-orders")
                        .param("bikeId", SEQ_BIKE_ID.toString())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].customerName").value("순차A"))
                .andExpect(jsonPath("$[0].sequence").value(1))
                .andExpect(jsonPath("$[1].customerName").value("순차B"))
                .andExpect(jsonPath("$[1].sequence").value(2))
                .andExpect(jsonPath("$[2].customerName").value("순차C"))
                .andExpect(jsonPath("$[2].sequence").value(3));
    }

    // ⑦ dashboard map-state: ASSIGNED 배차 생성 후 해당 핀에 dispatchQueueCount>=1, currentDispatchCustomerName 설정
    @Test
    void dashboardMapStateExposesCurrentDispatchAndQueueCountForBike() throws Exception {
        // 핀으로 노출되려면 좌표가 있는 current state 가 필요하다.
        insertCurrentState(BIKE_ID, DEVICE_ID, Instant.now().minusSeconds(60), "ON", "10.00", "80.00");

        createOrder("배차고객", "010-7777-7777", "배차 주소");

        mockMvc.perform(get("/api/v1/dashboard/map-state")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bikePins[?(@.bikeId=='" + BIKE_ID + "')].dispatchQueueCount")
                        .value(org.hamcrest.Matchers.contains(1)))
                .andExpect(jsonPath("$.bikePins[?(@.bikeId=='" + BIKE_ID + "')].currentDispatchCustomerName")
                        .value(org.hamcrest.Matchers.contains("배차고객")))
                .andExpect(jsonPath("$.bikePins[?(@.bikeId=='" + BIKE_ID + "')].currentDispatchAddress")
                        .value(org.hamcrest.Matchers.contains("배차 주소")));
    }

    // ⑨ bulk-apply with originAddress/Lat/Lng persists origin fields to DispatchOrder
    @Test
    void bulkApplyWithOriginPersistsOriginFieldsToDispatchOrder() throws Exception {
        String body = """
                {
                  "rows": [
                    {"bikeId":"%1$s","customerName":"출발지고객","customerPhone":"010-9999-0000",
                     "address":"목적지 주소","latitude":37.50,"longitude":127.00,
                     "originAddress":"출발지 주소","originLatitude":37.48,"originLongitude":126.98}
                  ]
                }
                """.formatted(BIKE_ID);

        mockMvc.perform(post("/api/v1/dispatch-orders/bulk-apply")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.applied").value(1));

        mockMvc.perform(get("/api/v1/dispatch-orders")
                        .param("bikeId", BIKE_ID.toString())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].originAddress").value("출발지 주소"))
                .andExpect(jsonPath("$[0].originLatitude").value(37.48))
                .andExpect(jsonPath("$[0].originLongitude").value(126.98));
    }

    // ⑩ bulk-preview service type: SEQ 차량으로 단일 preview → ERROR (서비스 유형 불일치)
    @Test
    void bulkPreviewReturnsErrorForNonSingleBike() throws Exception {
        byte[] xlsx = buildUploadWorkbook(
                new String[]{SEQ_BIKE_PLATE, "순차고객", "010-7777-7777", "주소"});

        MockMultipartFile file = new MockMultipartFile(
                "file", "upload-type.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", xlsx);

        mockMvc.perform(multipart("/api/v1/dispatch-orders/bulk-preview")
                        .file(file)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rows.length()").value(1))
                .andExpect(jsonPath("$.rows[0].status").value("ERROR"))
                .andExpect(jsonPath("$.rows[0].message").value(org.hamcrest.Matchers.containsString("배송용 차량이 아닙니다")))
                .andExpect(jsonPath("$.summary.error").value(1))
                .andExpect(jsonPath("$.summary.new").value(0));
    }

    // ⑪ bulk-preview-sequential service type: SINGLE 차량으로 순차 preview → ERROR (서비스 유형 불일치)
    @Test
    void bulkPreviewSequentialReturnsErrorForNonSequentialBike() throws Exception {
        byte[] xlsx = buildSequentialWorkbook(
                new String[]{BIKE_PLATE, "단일고객", "010-8888-8888", "주소", "1"});

        MockMultipartFile file = new MockMultipartFile(
                "file", "upload-seq-type.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", xlsx);

        mockMvc.perform(multipart("/api/v1/dispatch-orders/bulk-preview-sequential")
                        .file(file)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rows.length()").value(1))
                .andExpect(jsonPath("$.rows[0].status").value("ERROR"))
                .andExpect(jsonPath("$.rows[0].message").value(org.hamcrest.Matchers.containsString("클린 차량이 아닙니다")))
                .andExpect(jsonPath("$.summary.error").value(1))
                .andExpect(jsonPath("$.summary.new").value(0));
    }

    // ⑫ PATCH: 고객/주소 필드 수정 반영
    @Test
    void patchUpdatesCustomerAndAddressFields() throws Exception {
        String orderId = createOrder("원래고객", "010-0000-0000", "원래 주소");

        String body = """
                {"bikeId":"%s","customerName":"수정고객","customerPhone":"010-9999-9999",
                 "address":"수정 주소","latitude":37.51,"longitude":127.02}
                """.formatted(BIKE_ID);

        mockMvc.perform(patch("/api/v1/dispatch-orders/{id}", orderId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.customerName").value("수정고객"))
                .andExpect(jsonPath("$.customerPhone").value("010-9999-9999"))
                .andExpect(jsonPath("$.address").value("수정 주소"))
                .andExpect(jsonPath("$.status").value("ASSIGNED"));
    }

    // ⑬ PATCH 재배정: bikeId 변경 시 대상 큐 tail+1 순번
    @Test
    void patchReassignMovesOrderToTargetBikeQueueTail() throws Exception {
        // SEQ_BIKE 큐에 1건(sequence 1) 만들어 tail 을 확보
        String seqBody = """
                {"bikeId":"%1$s","customerName":"순차기존","customerPhone":"010-1111-1111",
                 "address":"순차 주소","latitude":37.50,"longitude":127.00,"sequence":1}
                """.formatted(SEQ_BIKE_ID);
        mockMvc.perform(post("/api/v1/dispatch-orders/bulk-apply-sequential")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"rows\":[" + seqBody + "]}"))
                .andExpect(status().isOk());

        String orderId = createOrder("이동고객", "010-2222-2222", "이동 주소"); // BIKE_ID(SINGLE), seq 1

        String patch = """
                {"bikeId":"%s","customerName":"이동고객","customerPhone":"010-2222-2222",
                 "address":"이동 주소","latitude":37.50,"longitude":127.00}
                """.formatted(SEQ_BIKE_ID);

        mockMvc.perform(patch("/api/v1/dispatch-orders/{id}", orderId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(patch))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bikeId").value(SEQ_BIKE_ID.toString()))
                .andExpect(jsonPath("$.sequence").value(2));
    }

    // ⑭ PATCH 완료건 → 409
    @Test
    void patchCompletedOrderIsRejected() throws Exception {
        String orderId = createOrder("완료고객", "010-3333-3333", "완료 주소");
        completeOrder(orderId);

        String body = """
                {"bikeId":"%s","customerName":"수정시도","customerPhone":"010-3333-3333",
                 "address":"수정 주소","latitude":37.50,"longitude":127.00}
                """.formatted(BIKE_ID);

        mockMvc.perform(patch("/api/v1/dispatch-orders/{id}", orderId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(result -> assertThat(result.getResponse().getStatus()).isIn(400, 409));
    }

    // ⑮ PATCH → audit_logs 에 DISPATCH_ORDER/__updated__ 행 생성
    @Test
    void patchRecordsUpdatedAuditLog() throws Exception {
        String orderId = createOrder("감사수정고객", "010-4444-4444", "감사 주소");

        String body = """
                {"bikeId":"%s","customerName":"감사수정후","customerPhone":"010-4444-4444",
                 "address":"감사 주소","latitude":37.50,"longitude":127.00}
                """.formatted(BIKE_ID);
        mockMvc.perform(patch("/api/v1/dispatch-orders/{id}", orderId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk());

        int count = jdbcTemplate.queryForObject(
                "select count(*) from audit_logs where entity_type='DISPATCH_ORDER' and entity_id=?::uuid and field='__updated__'",
                Integer.class, orderId);
        assertThat(count).isEqualTo(1);
    }

    // ⑯ 모니터 조회: includeCompleted=true 면 당일 완료도 포함
    @Test
    void activeWithIncludeCompletedReturnsTodayCompleted() throws Exception {
        createOrder("진행중고객", "010-1111-0000", "주소A");
        String b = createOrder("완료대상고객", "010-2222-0000", "주소B");
        completeOrder(b);

        mockMvc.perform(get("/api/v1/dispatch-orders/active")
                        .param("includeCompleted", "true")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));

        // includeCompleted 기본 false → ASSIGNED 만
        mockMvc.perform(get("/api/v1/dispatch-orders/active")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
    }

    // --- helpers ---------------------------------------------------------

    private void completeOrder(String orderId) throws Exception {
        byte[] photoBytes = new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0};
        MockMultipartFile photo = new MockMultipartFile("photo", "photo.jpg", "image/jpeg", photoBytes);
        mockMvc.perform(multipart("/api/v1/dispatch-orders/{id}/complete", orderId)
                        .file(photo)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk());
    }

    private String createBody(String name, String phone, String address, double lat, double lng) {
        return """
                {"bikeId":"%s","customerName":"%s","customerPhone":"%s",
                 "address":"%s","latitude":%s,"longitude":%s}
                """.formatted(BIKE_ID, name, phone, address, lat, lng);
    }

    private String createOrder(String name, String phone, String address) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/dispatch-orders")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody(name, phone, address, 37.5, 127.0)))
                .andExpect(status().isCreated())
                .andReturn();
        return extractId(result.getResponse().getContentAsString());
    }

    /**
     * Build an .xlsx upload matching dispatch-template's layout: header rows occupy 0-based indices
     * 0..1, data begins at {@link #DATA_START_ROW}. Columns: [0]=차량번호, [1]=고객명, [2]=연락처,
     * [3]=배송지주소.
     */
    private byte[] buildUploadWorkbook(String[]... dataRows) throws Exception {
        try (Workbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = wb.createSheet("dispatch");
            // header row at index DATA_START_ROW - 1 (1); index 0 left blank like the template title row
            Row header = sheet.createRow(DATA_START_ROW - 1);
            String[] headers = {"차량번호", "고객명", "연락처", "배송지주소"};
            for (int c = 0; c < headers.length; c++) {
                header.createCell(c).setCellValue(headers[c]);
            }
            int rowIdx = DATA_START_ROW;
            for (String[] cols : dataRows) {
                Row row = sheet.createRow(rowIdx++);
                for (int c = 0; c < cols.length; c++) {
                    row.createCell(c).setCellValue(cols[c]);
                }
            }
            wb.write(out);
            return out.toByteArray();
        }
    }

    /**
     * Build an .xlsx upload for sequential bulk preview: 5 columns
     * [0]=차량번호 [1]=고객명 [2]=연락처 [3]=배송지주소 [4]=순번.
     */
    private byte[] buildSequentialWorkbook(String[]... dataRows) throws Exception {
        try (Workbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = wb.createSheet("dispatch-seq");
            Row header = sheet.createRow(DATA_START_ROW - 1);
            String[] headers = {"차량번호", "고객명", "연락처", "배송지주소", "순번"};
            for (int c = 0; c < headers.length; c++) {
                header.createCell(c).setCellValue(headers[c]);
            }
            int rowIdx = DATA_START_ROW;
            for (String[] cols : dataRows) {
                Row row = sheet.createRow(rowIdx++);
                for (int c = 0; c < cols.length; c++) {
                    row.createCell(c).setCellValue(cols[c]);
                }
            }
            wb.write(out);
            return out.toByteArray();
        }
    }

    /** 배차 방식 축은 V59 로 용도에 단일화됐다 — 옛 SEQUENTIAL 시드는 클린차량으로,
     *  나머지는 배송용으로 환원해 기존 호출부 시그니처를 유지한다. */
    private void seedBike(UUID id, String plateNumber, String vin, String operationStatus, String legacyServiceType) {
        String purpose = "SEQUENTIAL".equals(legacyServiceType) ? "CLEANING" : "DELIVERY";
        jdbcTemplate.update("""
                insert into bikes (id, plate_number, vin, model_name, operation_status, purpose)
                values (?, ?, ?, 'Thunder M1', ?, ?)
                """, id, plateNumber, vin, operationStatus, purpose);
        jdbcTemplate.update(
                "insert into rider_bike_contracts (id, rider_id, bike_id, contract_template_id, start_at) "
                + "values (?, ?, ?, ?, now())",
                java.util.UUID.randomUUID(), java.util.UUID.randomUUID(), id, java.util.UUID.randomUUID());
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
                                {"loginId":"ops-admin","password":"correct-password"}
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
