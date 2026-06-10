package com.thundercrew.opsapi;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
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

    private static final UUID ADMIN_ID    = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final UUID TEMPLATE_ID = UUID.fromString("cccccccc-cccc-cccc-cccc-cccccccccccc");
    private static final UUID BIKE_ID     = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private static final UUID RIDER_ID    = UUID.fromString("dddddddd-dddd-dddd-dddd-dddddddddddd");
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
                insert into bikes (id, idx, plate_number, engine_type, service_type,
                                   operation_status, wheel_type, ignition_blocked)
                values (?, nextval('bikes_idx_seq'), '12가3456', 'ELECTRIC', 'DELIVERY',
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
        MockMultipartFile file = buildContractExcel(
                "12가3456", "홍길동", "010-1234-5678", "구독", "인수형", "2026-07-01", "2027-06-30", "N");

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
                "99나9999", "홍길동", "010-1234-5678", "구독", "인수형", "2026-07-01", "2027-06-30", "N");

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
                "12가3456", "김철수", "010-9999-9999", "구독", "인수형", "2026-07-01", "2027-06-30", "N");

        mockMvc.perform(multipart("/api/v1/contracts/bulk-preview")
                        .file(file)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rows[0].status").value("ERROR"));
    }

    @Test
    void applyCreatesContract() throws Exception {
        MockMultipartFile file = buildContractExcel(
                "12가3456", "홍길동", "010-1234-5678", "구독", "인수형", "2026-07-01", "2027-06-30", "N");

        mockMvc.perform(multipart("/api/v1/contracts/bulk-apply")
                        .file(file)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.applied").value(1));
    }

    @Test
    void applySkipsInvalidRow() throws Exception {
        MockMultipartFile file = buildContractExcel(
                "99나9999", "홍길동", "010-1234-5678", "구독", "인수형", "2026-07-01", "2027-06-30", "N");

        mockMvc.perform(multipart("/api/v1/contracts/bulk-apply")
                        .file(file)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.applied").value(0))
                .andExpect(jsonPath("$.skipped").value(1));
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

    private MockMultipartFile buildContractExcel(
            String plate, String riderName, String phone,
            String category, String returnType,
            String startAt, String endAt, String insurance) throws Exception {
        XSSFWorkbook wb = new XSSFWorkbook();
        Sheet sheet = wb.createSheet();
        sheet.createRow(0);
        sheet.createRow(1);
        sheet.createRow(2);
        Row row = sheet.createRow(3); // DATA_START_ROW = 3
        row.createCell(0).setCellValue(plate);
        row.createCell(1).setCellValue(riderName);
        row.createCell(2).setCellValue(phone);
        row.createCell(3).setCellValue(category);
        row.createCell(4).setCellValue(returnType);
        row.createCell(5).setCellValue(startAt);
        row.createCell(6).setCellValue(endAt);
        row.createCell(7).setCellValue(insurance);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        wb.write(out);
        wb.close();
        return new MockMultipartFile("file", "matching.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                out.toByteArray());
    }
}
