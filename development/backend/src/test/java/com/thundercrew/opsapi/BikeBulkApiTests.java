package com.thundercrew.opsapi;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
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
class BikeBulkApiTests extends PostgresContainerSupport {

    private static final UUID ADMIN_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
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
        jdbcTemplate.update("delete from admin_users");
        jdbcTemplate.update("""
                insert into admin_users (id, login_id, email, password_hash, display_name, enabled)
                values (?, 'ops-admin', 'ops@example.test', ?, 'Ops Admin', true)
                """, ADMIN_ID, passwordEncoder.encode("correct-password"));
        accessToken = loginAndExtractToken();
    }

    @Test
    void previewNewBike() throws Exception {
        MockMultipartFile file = buildBikeExcel(
                new String[]{"12가3456", "2륜", "전기", ""});

        mockMvc.perform(multipart("/api/v1/bikes/bulk-preview")
                        .file(file)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rows[0].status").value("NEW"))
                .andExpect(jsonPath("$.rows[0].key").value("12가3456"))
                .andExpect(jsonPath("$.summary.new").value(1))
                .andExpect(jsonPath("$.summary.total").value(1));
    }

    @Test
    void previewExistingUnchangedBike() throws Exception {
        jdbcTemplate.update("""
                insert into bikes (id, idx, plate_number, engine_type,
                                   operation_status, wheel_type, ignition_blocked)
                values (gen_random_uuid(), nextval('bikes_idx_seq'), '34나5678', 'ELECTRIC',
                        'READY', 'TWO_WHEEL', false)
                """);

        MockMultipartFile file = buildBikeExcel(
                new String[]{"34나5678", "2륜", "전기", ""});

        mockMvc.perform(multipart("/api/v1/bikes/bulk-preview")
                        .file(file)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rows[0].status").value("UNCHANGED"))
                .andExpect(jsonPath("$.summary.unchanged").value(1));
    }

    @Test
    void previewExistingUpdateBike() throws Exception {
        jdbcTemplate.update("""
                insert into bikes (id, idx, plate_number, engine_type,
                                   operation_status, wheel_type, ignition_blocked)
                values (gen_random_uuid(), nextval('bikes_idx_seq'), '56다7890', 'ELECTRIC',
                        'READY', 'TWO_WHEEL', false)
                """);

        MockMultipartFile file = buildBikeExcel(
                new String[]{"56다7890", "4륜", "전기", ""});

        mockMvc.perform(multipart("/api/v1/bikes/bulk-preview")
                        .file(file)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rows[0].status").value("UPDATE"))
                .andExpect(jsonPath("$.rows[0].changes[0]").value("wheelType"))
                .andExpect(jsonPath("$.summary.update").value(1));
    }

    @Test
    void applyCreatesAndUpdatesBikes() throws Exception {
        jdbcTemplate.update("""
                insert into bikes (id, idx, plate_number, engine_type,
                                   operation_status, wheel_type, ignition_blocked)
                values (gen_random_uuid(), nextval('bikes_idx_seq'), '34나5678', 'ELECTRIC',
                        'READY', 'TWO_WHEEL', false)
                """);

        MockMultipartFile file = buildBikeExcel(
                new String[]{"12가3456", "2륜", "전기", ""},
                new String[]{"34나5678", "4륜", "전기", ""});

        mockMvc.perform(multipart("/api/v1/bikes/bulk-apply")
                        .file(file)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.applied").value(2))
                .andExpect(jsonPath("$.skipped").value(0));
    }

    @Test
    void applyPersistsTerminalIdAndExportEmitsIt() throws Exception {
        MockMultipartFile file = buildBikeExcel(
                new String[]{"12가3456", "2륜", "전기", "IMEI-001", "TERM-001"});

        mockMvc.perform(multipart("/api/v1/bikes/bulk-apply")
                        .file(file)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.applied").value(1));

        String terminalId = jdbcTemplate.queryForObject(
                "select terminal_id from bikes where plate_number = '12가3456' limit 1",
                String.class);
        org.assertj.core.api.Assertions.assertThat(terminalId).isEqualTo("TERM-001");

        // export should include the terminalId in col4
        MvcResult exportResult = mockMvc.perform(get("/api/v1/bikes/export")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andReturn();
        byte[] exportBytes = exportResult.getResponse().getContentAsByteArray();
        try (XSSFWorkbook wb = new XSSFWorkbook(new java.io.ByteArrayInputStream(exportBytes))) {
            org.apache.poi.ss.usermodel.Sheet sheet = wb.getSheetAt(0);
            org.apache.poi.ss.usermodel.Row dataRow = sheet.getRow(2); // DATA_START_ROW = 2
            org.assertj.core.api.Assertions.assertThat(dataRow.getCell(4).getStringCellValue())
                    .isEqualTo("TERM-001");
        }
    }

    @Test
    void exportReturnsBikeSpreadsheet() throws Exception {
        jdbcTemplate.update("""
                insert into bikes (id, idx, plate_number, engine_type,
                                   operation_status, wheel_type, ignition_blocked)
                values (gen_random_uuid(), nextval('bikes_idx_seq'), '12가3456', 'ELECTRIC',
                        'READY', 'TWO_WHEEL', false)
                """);

        mockMvc.perform(get("/api/v1/bikes/export")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_TYPE,
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
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

    private MockMultipartFile buildBikeExcel(String[]... dataRows) throws Exception {
        XSSFWorkbook wb = new XSSFWorkbook();
        Sheet sheet = wb.createSheet();
        sheet.createRow(0); // header row 1
        sheet.createRow(1); // header row 2
        for (int i = 0; i < dataRows.length; i++) {
            Row row = sheet.createRow(2 + i); // DATA_START_ROW = 2
            for (int j = 0; j < dataRows[i].length; j++) {
                row.createCell(j).setCellValue(dataRows[i][j]);
            }
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        wb.write(out);
        wb.close();
        return new MockMultipartFile("file", "bikes.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                out.toByteArray());
    }
}
