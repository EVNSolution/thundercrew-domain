package com.thundercrew.opsapi;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
class MaintenanceItemApiContractTests extends PostgresContainerSupport {

    private static final UUID ADMIN_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final UUID BIKE_ID  = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private static final Pattern ACCESS_TOKEN_PATTERN = Pattern.compile("\"accessToken\"\\s*:\\s*\"([^\"]+)\"");

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
        jdbcTemplate.update("delete from vehicle_maintenance_records");
        jdbcTemplate.update("delete from maintenance_item_categories");
        jdbcTemplate.update("delete from maintenance_items");
        jdbcTemplate.update("delete from bike_device_installations");
        jdbcTemplate.update("delete from devices");
        jdbcTemplate.update("delete from bike_equipments");
        jdbcTemplate.update("delete from equipment_types");
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

    // -----------------------------------------------------------------------
    // create — multi-category item persisted to join table
    // -----------------------------------------------------------------------

    @Test
    void createItemPersistsMultipleCategories() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/maintenance-items")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "브레이크 패드(앞)",
                                  "categories": ["TWO_WHEEL_ELECTRIC", "FOUR_WHEEL_ELECTRIC"],
                                  "cycleKm": 4000
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("브레이크 패드(앞)"))
                .andExpect(jsonPath("$.cycleKm").value(4000))
                .andReturn();

        UUID id = UUID.fromString(extractId(result));

        // verify join table rows
        List<String> cats = jdbcTemplate.queryForList(
                "select category from maintenance_item_categories where maintenance_item_id = ? order by category",
                String.class, id);
        assertThat(cats).containsExactlyInAnyOrder("TWO_WHEEL_ELECTRIC", "FOUR_WHEEL_ELECTRIC");

        // verify response contains both categories
        String body = result.getResponse().getContentAsString();
        assertThat(body).contains("TWO_WHEEL_ELECTRIC");
        assertThat(body).contains("FOUR_WHEEL_ELECTRIC");
    }

    // -----------------------------------------------------------------------
    // update — replaces categories
    // -----------------------------------------------------------------------

    @Test
    void updateItemReplacesCategories() throws Exception {
        UUID itemId = UUID.randomUUID();
        seedItem(itemId, "타이어(앞)", 15000, "TWO_WHEEL_ELECTRIC");

        mockMvc.perform(patch("/api/v1/maintenance-items/{id}", itemId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "categories": ["FOUR_WHEEL_ICE", "TWO_WHEEL_ICE"]
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("타이어(앞)"));

        List<String> cats = jdbcTemplate.queryForList(
                "select category from maintenance_item_categories where maintenance_item_id = ? order by category",
                String.class, itemId);
        assertThat(cats).containsExactlyInAnyOrder("FOUR_WHEEL_ICE", "TWO_WHEEL_ICE");
    }

    @Test
    void updateItemLeavesCategoriésUnchangedWhenNotProvided() throws Exception {
        UUID itemId = UUID.randomUUID();
        seedItem(itemId, "타이어(뒤)", 12000, "TWO_WHEEL_ELECTRIC");

        mockMvc.perform(patch("/api/v1/maintenance-items/{id}", itemId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "타이어(뒤) 수정"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("타이어(뒤) 수정"));

        List<String> cats = jdbcTemplate.queryForList(
                "select category from maintenance_item_categories where maintenance_item_id = ? order by category",
                String.class, itemId);
        assertThat(cats).containsExactly("TWO_WHEEL_ELECTRIC");
    }

    // -----------------------------------------------------------------------
    // listItemsForBike — per-bike category filter
    // -----------------------------------------------------------------------

    /**
     * 2륜·전기 바이크 → TWO_WHEEL_ELECTRIC 카테고리에 속하는 품목만 반환.
     *
     * 시드:
     *   A  (TWO_WHEEL_ELECTRIC, FOUR_WHEEL_ELECTRIC)  → 포함 ✓ (카테고리에 TWO_WHEEL_ELECTRIC 있음)
     *   B  (TWO_WHEEL_ELECTRIC, TWO_WHEEL_ICE, FOUR_WHEEL_ELECTRIC, FOUR_WHEEL_ICE) → 포함 ✓
     *   C  (TWO_WHEEL_ICE)    → 제외 ✗ (TWO_WHEEL_ELECTRIC 없음)
     *   D  (FOUR_WHEEL_ELECTRIC) → 제외 ✗ (TWO_WHEEL_ELECTRIC 없음)
     * 결과 정렬: 이름 오름차순.
     */
    @Test
    void listItemsForBikeFiltersOnSingleCategory() throws Exception {
        UUID itemA = seedItem(UUID.randomUUID(), "A 전기공용",  4000, "TWO_WHEEL_ELECTRIC", "FOUR_WHEEL_ELECTRIC");
        UUID itemB = seedItem(UUID.randomUUID(), "B 전품목",    5000,
                "TWO_WHEEL_ELECTRIC", "TWO_WHEEL_ICE", "FOUR_WHEEL_ELECTRIC", "FOUR_WHEEL_ICE");
        UUID itemC = seedItem(UUID.randomUUID(), "C ICE2륜",   7000, "TWO_WHEEL_ICE");
        UUID itemD = seedItem(UUID.randomUUID(), "D 전기4륜",  1000, "FOUR_WHEEL_ELECTRIC");

        seedBike(BIKE_ID, "ELECTRIC", "TWO_WHEEL");

        MvcResult result = mockMvc.perform(get("/api/v1/bikes/{bikeId}/maintenance-items", BIKE_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andReturn();

        String body = result.getResponse().getContentAsString();

        // 포함
        assertThat(body).contains(itemA.toString());
        assertThat(body).contains(itemB.toString());

        // 제외
        assertThat(body).doesNotContain(itemC.toString());
        assertThat(body).doesNotContain(itemD.toString());
    }

    @Test
    void listItemsForBikeReturnsOrderedByNameAsc() throws Exception {
        UUID itemZ = seedItem(UUID.randomUUID(), "Z 항목", 1000, "TWO_WHEEL_ELECTRIC");
        UUID itemA = seedItem(UUID.randomUUID(), "A 항목", 2000, "TWO_WHEEL_ELECTRIC");
        UUID itemM = seedItem(UUID.randomUUID(), "M 항목", 3000, "TWO_WHEEL_ELECTRIC");

        seedBike(BIKE_ID, "ELECTRIC", "TWO_WHEEL");

        MvcResult result = mockMvc.perform(get("/api/v1/bikes/{bikeId}/maintenance-items", BIKE_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andReturn();

        String body = result.getResponse().getContentAsString();
        int posA = body.indexOf(itemA.toString());
        int posM = body.indexOf(itemM.toString());
        int posZ = body.indexOf(itemZ.toString());
        assertThat(posA).isLessThan(posM);
        assertThat(posM).isLessThan(posZ);
    }

    // -----------------------------------------------------------------------
    // validation — empty categories → 400
    // -----------------------------------------------------------------------

    @Test
    void createWithEmptyCategoriesReturns4xx() throws Exception {
        mockMvc.perform(post("/api/v1/maintenance-items")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "테스트 항목",
                                  "categories": [],
                                  "cycleKm": 1000
                                }
                                """))
                .andExpect(status().is4xxClientError());
    }

    @Test
    void createWithNullCategoriesReturns4xx() throws Exception {
        mockMvc.perform(post("/api/v1/maintenance-items")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "테스트 항목",
                                  "cycleKm": 1000
                                }
                                """))
                .andExpect(status().is4xxClientError());
    }

    // -----------------------------------------------------------------------
    // helpers
    // -----------------------------------------------------------------------

    /** Seeds a maintenance item with a single category. Returns its id. */
    private UUID seedItem(UUID id, String name, int cycleKm, String... categories) {
        jdbcTemplate.update("""
                insert into maintenance_items (id, name, cycle_km)
                values (?, ?, ?)
                """, id, name, cycleKm);
        for (String cat : categories) {
            jdbcTemplate.update("""
                    insert into maintenance_item_categories (maintenance_item_id, category)
                    values (?, ?)
                    """, id, cat);
        }
        return id;
    }

    private void seedBike(UUID id, String engineType, String wheelType) {
        jdbcTemplate.update("""
                insert into bikes
                    (id, plate_number, vin, model_name, engine_type, wheel_type, operation_status, memo)
                values (?, ?, ?, 'Thunder M1', ?, ?, 'READY', 'fixture bike')
                """, id,
                "서울A-" + id.toString().substring(0, 4),
                "VIN-" + id.toString().substring(0, 8),
                engineType, wheelType);
    }

    private String loginAndExtractToken() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"loginId":"ops-admin","password":"correct-password"}
                                """))
                .andExpect(status().isOk())
                .andReturn();
        Matcher matcher = ACCESS_TOKEN_PATTERN.matcher(result.getResponse().getContentAsString());
        assertThat(matcher.find()).isTrue();
        return matcher.group(1);
    }

    private String extractId(MvcResult result) throws Exception {
        Matcher matcher = Pattern.compile("\"id\"\\s*:\\s*\"([^\"]+)\"")
                .matcher(result.getResponse().getContentAsString());
        assertThat(matcher.find()).isTrue();
        return matcher.group(1);
    }
}
