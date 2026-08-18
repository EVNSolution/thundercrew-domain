package com.thundercrew.opsapi;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.ByteArrayOutputStream;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
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
class ContractBulkApiTests extends PostgresContainerSupport {

    private static final UUID ADMIN_ID       = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final UUID TEMPLATE_ID    = UUID.fromString("cccccccc-cccc-cccc-cccc-cccccccccccc");
    private static final UUID BIKE_ID        = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private static final UUID RIDER_ID       = UUID.fromString("dddddddd-dddd-dddd-dddd-dddddddddddd");
    private static final UUID CONTRACT_ID    = UUID.fromString("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee");
    private static final UUID CONTRACT_ID_2  = UUID.fromString("ffffffff-ffff-ffff-ffff-ffffffffffff");
    private static final Pattern TOKEN_PATTERN =
            Pattern.compile("\"accessToken\"\\s*:\\s*\"([^\"]+)\"");

    @Autowired MockMvc mockMvc;
    @Autowired JdbcTemplate jdbcTemplate;
    @Autowired PasswordEncoder passwordEncoder;
    private String accessToken;

    @DynamicPropertySource
    static void postgresProperties(DynamicPropertyRegistry r) {
        registerPostgresProperties(r);
    }

    @BeforeEach
    void resetRows() throws Exception {
        jdbcTemplate.update("delete from rider_bike_contracts");
        jdbcTemplate.update("delete from riders");
        jdbcTemplate.update("delete from bike_operation_status_histories");
        jdbcTemplate.update("delete from bikes");
        jdbcTemplate.update("delete from contract_templates");
        jdbcTemplate.update("delete from admin_users");
        jdbcTemplate.update("""
                insert into admin_users (id, login_id, email, password_hash, display_name, enabled)
                values (?, 'ops-admin', 'ops@example.test', ?, 'Ops Admin', true)
                """, ADMIN_ID, passwordEncoder.encode("correct-password"));
        jdbcTemplate.update("""
                insert into bikes (id, idx, plate_number, engine_type,
                                   operation_status, wheel_type, ignition_blocked)
                values (?, nextval('bikes_idx_seq'), '12가3456', 'ELECTRIC',
                        'READY', 'TWO_WHEEL', false)
                """, BIKE_ID);
        jdbcTemplate.update("""
                insert into riders (id, idx, name, phone_number, app_account_linked)
                values (?, nextval('riders_idx_seq'), '홍길동', '010-1234-5678', false)
                """, RIDER_ID);
        jdbcTemplate.update("""
                insert into contract_templates (id, idx, name, category, return_type,
                                                enabled, system_template, includes_insurance)
                values (?, nextval('contract_templates_idx_seq'), '구독-인수형', 'SUBSCRIPTION',
                        'TAKEOVER', true, false, false)
                """, TEMPLATE_ID);
        accessToken = loginAndExtractToken();
    }

    @Test
    void previewNewContract() throws Exception {
        // 9-col layout: plate, serviceType, riderName, phone, category, returnType, start, end, validationResult
        MockMultipartFile file = buildContractExcel(
                "12가3456", "단일 배차", "홍길동", "010-1234-5678", "구독", "인수형", "2026-07-01", "2027-06-30", "");

        mockMvc.perform(multipart("/api/v1/contracts/bulk-preview")
                        .file(file)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rows[0].status").value("NEW"))
                .andExpect(jsonPath("$.summary.new").value(1));
    }

    @Test
    void previewErrorWhenBikeNotFound() throws Exception {
        MockMultipartFile file = buildContractExcel(
                "99나9999", "단일 배차", "홍길동", "010-1234-5678", "구독", "인수형", "2026-07-01", "2027-06-30", "");

        mockMvc.perform(multipart("/api/v1/contracts/bulk-preview")
                        .file(file)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rows[0].status").value("ERROR"))
                .andExpect(jsonPath("$.summary.error").value(1));
    }

    @Test
    void previewErrorWhenRiderNotFound() throws Exception {
        MockMultipartFile file = buildContractExcel(
                "12가3456", "단일 배차", "김철수", "010-9999-9999", "구독", "인수형", "2026-07-01", "2027-06-30", "");

        mockMvc.perform(multipart("/api/v1/contracts/bulk-preview")
                        .file(file)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rows[0].status").value("ERROR"));
    }

    @Test
    void applyCreatesContract() throws Exception {
        MockMultipartFile file = buildContractExcel(
                "12가3456", "단일 배차", "홍길동", "010-1234-5678", "구독", "인수형", "2026-07-01", "2027-06-30", "");

        mockMvc.perform(multipart("/api/v1/contracts/bulk-apply")
                        .file(file)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.applied").value(1));
    }

    @Test
    void applySkipsInvalidRow() throws Exception {
        MockMultipartFile file = buildContractExcel(
                "99나9999", "단일 배차", "홍길동", "010-1234-5678", "구독", "인수형", "2026-07-01", "2027-06-30", "");

        mockMvc.perform(multipart("/api/v1/contracts/bulk-apply")
                        .file(file)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.applied").value(0))
                .andExpect(jsonPath("$.skipped").value(1));
    }

    @Test
    void applyIgnoresPurposeColumn() throws Exception {
        // col1 은 용도 표시(읽기 전용)가 됐다 — 어떤 값이 와도 파싱하지 않고 계약은 생성된다.
        MockMultipartFile file = buildContractExcel(
                "12가3456", "아무 값", "홍길동", "010-1234-5678", "구독", "인수형", "2026-07-01", "2027-06-30", "");

        mockMvc.perform(multipart("/api/v1/contracts/bulk-apply")
                        .file(file)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.applied").value(1));
    }

    @Test
    void applyAcceptsBlankPurposeColumn() throws Exception {
        MockMultipartFile file = buildContractExcel(
                "12가3456", "", "홍길동", "010-1234-5678", "구독", "인수형", "2026-07-01", "2027-06-30", "");

        mockMvc.perform(multipart("/api/v1/contracts/bulk-apply")
                        .file(file)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.applied").value(1));
    }

    @Test
    void previewIgnoresPurposeColumnInDiff() throws Exception {
        // 같은 템플릿·기간의 활성 계약. col1(용도 표시)이 달라도 diff 대상이 아니다.
        jdbcTemplate.update("""
                insert into rider_bike_contracts
                    (id, idx, rider_id, bike_id, contract_template_id, start_at, end_at)
                values (?, nextval('rider_bike_contracts_idx_seq'), ?, ?, ?,
                        '2026-07-01T00:00:00Z', '2027-06-30T00:00:00Z')
                """, CONTRACT_ID, RIDER_ID, BIKE_ID, TEMPLATE_ID);

        MockMultipartFile file = buildContractExcel(
                "12가3456", "전혀 다른 값", "홍길동", "010-1234-5678", "구독", "인수형", "2026-07-01", "2027-06-30", "");

        mockMvc.perform(multipart("/api/v1/contracts/bulk-preview")
                        .file(file)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rows[0].status").value("UNCHANGED"))
                .andExpect(jsonPath("$.summary.unchanged").value(1));
    }

    @Test
    void previewShowsUnchangedWhenServiceTypeAndAllFieldsMatch() throws Exception {
        // Seed an ACTIVE contract with serviceType CALL, matching template + dates.
        jdbcTemplate.update("""
                insert into rider_bike_contracts
                    (id, idx, rider_id, bike_id, contract_template_id, start_at, end_at)
                values (?, nextval('rider_bike_contracts_idx_seq'), ?, ?, ?,
                        '2026-07-01T00:00:00Z', '2027-06-30T00:00:00Z')
                """, CONTRACT_ID, RIDER_ID, BIKE_ID, TEMPLATE_ID);

        // Identical row (serviceType CALL too) → nothing changed.
        MockMultipartFile file = buildContractExcel(
                "12가3456", "콜 배차", "홍길동", "010-1234-5678", "구독", "인수형", "2026-07-01", "2027-06-30", "");

        mockMvc.perform(multipart("/api/v1/contracts/bulk-preview")
                        .file(file)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rows[0].status").value("UNCHANGED"))
                .andExpect(jsonPath("$.summary.unchanged").value(1));
    }

    @Test
    void logExportReturnsXlsxWithActiveAndTerminatedContracts() throws Exception {
        // Seed one ACTIVE contract
        jdbcTemplate.update("""
                insert into rider_bike_contracts
                    (id, idx, rider_id, bike_id, contract_template_id, start_at, end_at)
                values (?, nextval('rider_bike_contracts_idx_seq'), ?, ?, ?,
                        '2026-01-01T00:00:00Z', '2027-01-01T00:00:00Z')
                """, CONTRACT_ID, RIDER_ID, BIKE_ID, TEMPLATE_ID);

        // Seed one TERMINATED contract (terminated_at set)
        jdbcTemplate.update("""
                insert into rider_bike_contracts
                    (id, idx, rider_id, bike_id, contract_template_id, start_at, end_at, terminated_at)
                values (?, nextval('rider_bike_contracts_idx_seq'), ?, ?, ?,
                        '2025-01-01T00:00:00Z', '2026-01-01T00:00:00Z', '2025-06-01T00:00:00Z')
                """, CONTRACT_ID_2, RIDER_ID, BIKE_ID, TEMPLATE_ID);

        MvcResult result = mockMvc.perform(get("/api/v1/contracts/log-export")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(content().contentType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"matching-log.xlsx\""))
                .andReturn();

        byte[] body = result.getResponse().getContentAsByteArray();
        org.assertj.core.api.Assertions.assertThat(body).isNotEmpty();
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private String loginAndExtractToken() throws Exception {
        MvcResult r = mockMvc.perform(
                org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"loginId\":\"ops-admin\",\"password\":\"correct-password\"}"))
                .andReturn();
        Matcher m = TOKEN_PATTERN.matcher(r.getResponse().getContentAsString());
        if (!m.find()) throw new IllegalStateException("No token in response");
        return m.group(1);
    }

    /**
     * Builds a 9-column matching Excel row aligned to the template layout:
     * col0=차량번호, col1=서비스유형, col2=라이더이름, col3=연락처,
     * col4=계약형태, col5=인수방식, col6=시작일(YYYY-MM-DD), col7=종료일(YYYY-MM-DD), col8=검증결과
     */
    private MockMultipartFile buildContractExcel(
            String plate, String serviceType, String riderName, String phone,
            String category, String returnType,
            String startAt, String endAt, String validationResult) throws Exception {
        XSSFWorkbook wb = new XSSFWorkbook();
        Sheet sheet = wb.createSheet();
        sheet.createRow(0);
        sheet.createRow(1);
        sheet.createRow(2);
        Row row = sheet.createRow(3); // DATA_START_ROW = 3
        row.createCell(0).setCellValue(plate);           // 차량번호
        row.createCell(1).setCellValue(serviceType);     // 서비스 유형
        row.createCell(2).setCellValue(riderName);       // 라이더 이름
        row.createCell(3).setCellValue(phone);           // 연락처
        row.createCell(4).setCellValue(category);        // 계약형태
        row.createCell(5).setCellValue(returnType);      // 인수방식
        row.createCell(6).setCellValue(startAt);         // 시작일
        row.createCell(7).setCellValue(endAt);           // 종료일
        row.createCell(8).setCellValue(validationResult); // 검증 결과
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        wb.write(out);
        wb.close();
        return new MockMultipartFile("file", "matching.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                out.toByteArray());
    }
}
