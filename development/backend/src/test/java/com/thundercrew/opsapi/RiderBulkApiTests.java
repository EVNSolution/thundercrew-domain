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
class RiderBulkApiTests extends PostgresContainerSupport {

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
        jdbcTemplate.update("delete from admin_users");
        jdbcTemplate.update("""
                insert into admin_users (id, login_id, email, password_hash, display_name, enabled)
                values (?, 'ops-admin', 'ops@example.test', ?, 'Ops Admin', true)
                """, ADMIN_ID, passwordEncoder.encode("correct-password"));
        accessToken = loginAndExtractToken();
    }

    @Test
    void previewNewRider() throws Exception {
        MockMultipartFile file = buildRiderExcel("홍길동", "010-1234-5678", "온라인", "팀A");

        mockMvc.perform(multipart("/api/v1/riders/bulk-preview")
                        .file(file)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rows[0].status").value("NEW"))
                .andExpect(jsonPath("$.rows[0].key").value("010-1234-5678"))
                .andExpect(jsonPath("$.summary.new").value(1));
    }

    @Test
    void previewUpdateRider() throws Exception {
        jdbcTemplate.update("""
                insert into riders (id, idx, name, phone_number, app_account_linked)
                values (gen_random_uuid(), nextval('riders_idx_seq'), '홍길동', '010-1234-5678', false)
                """);

        MockMultipartFile file = buildRiderExcel("홍길동", "010-1234-5678", "온라인", "팀B");

        mockMvc.perform(multipart("/api/v1/riders/bulk-preview")
                        .file(file)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rows[0].status").value("UPDATE"))
                .andExpect(jsonPath("$.summary.update").value(1));
    }

    @Test
    void applyCreatesRider() throws Exception {
        MockMultipartFile file = buildRiderExcel("홍길동", "010-1234-5678", "온라인", "팀A");

        mockMvc.perform(multipart("/api/v1/riders/bulk-apply")
                        .file(file)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.applied").value(1));
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

    private MockMultipartFile buildRiderExcel(String name, String phone, String training, String team)
            throws Exception {
        XSSFWorkbook wb = new XSSFWorkbook();
        Sheet sheet = wb.createSheet();
        sheet.createRow(0);
        sheet.createRow(1);
        Row row = sheet.createRow(2); // DATA_START_ROW = 2
        row.createCell(0).setCellValue(name);
        row.createCell(1).setCellValue(phone);
        row.createCell(2).setCellValue(training);
        row.createCell(3).setCellValue(team);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        wb.write(out);
        wb.close();
        return new MockMultipartFile("file", "riders.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                out.toByteArray());
    }
}
