package com.thundercrew.opsapi;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
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
    private static final UUID DEVICE_ID = UUID.fromString("cccccccc-cccc-cccc-cccc-cccccccccccc");
    private static final String BIKE_PLATE = "서울CC-0001";

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
        jdbcTemplate.update("delete from dispatch_orders");
        jdbcTemplate.update("delete from bike_current_states");
        jdbcTemplate.update("delete from bikes");
        jdbcTemplate.update("delete from admin_users");

        jdbcTemplate.update("""
                insert into admin_users (id, login_id, email, password_hash, display_name, enabled)
                values (?, 'ops-admin', 'ops@example.test', ?, 'Ops Admin', true)
                """, ADMIN_ID, passwordEncoder.encode("correct-password"));

        seedBike(BIKE_ID, BIKE_PLATE, "VIN-DISPATCH-001", "IN_SERVICE");

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

        mockMvc.perform(post("/api/v1/dispatch-orders/{id}/complete", firstId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(firstId))
                .andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.completedAt").isString());

        mockMvc.perform(get("/api/v1/dispatch-orders")
                        .param("bikeId", BIKE_ID.toString())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].id").value(firstId))
                .andExpect(jsonPath("$[0].status").value("COMPLETED"))
                .andExpect(jsonPath("$[1].status").value("ASSIGNED"));
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

    // --- helpers ---------------------------------------------------------

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

    private void seedBike(UUID id, String plateNumber, String vin, String operationStatus) {
        jdbcTemplate.update("""
                insert into bikes (id, plate_number, vin, model_name, operation_status)
                values (?, ?, ?, 'Thunder M1', ?)
                """, id, plateNumber, vin, operationStatus);
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
