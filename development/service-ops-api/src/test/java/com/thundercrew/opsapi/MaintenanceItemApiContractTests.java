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
        jdbcTemplate.update("delete from maintenance_items where parent_item_id is not null");
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
    // create / update persists appliesToWheel
    // -----------------------------------------------------------------------

    @Test
    void createItemPersistsAppliesToWheel() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/maintenance-items")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name":"브레이크 패드(앞)",
                                  "appliesTo":"BOTH",
                                  "appliesToWheel":"TWO_WHEEL",
                                  "cycleKm":4000,
                                  "displayOrder":10
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.appliesToWheel").value("TWO_WHEEL"))
                .andReturn();

        // verify DB value
        UUID id = UUID.fromString(extractId(result));
        String wheel = jdbcTemplate.queryForObject(
                "select applies_to_wheel from maintenance_items where id = ?",
                String.class, id);
        assertThat(wheel).isEqualTo("TWO_WHEEL");
    }

    @Test
    void updateItemPersistsAppliesToWheel() throws Exception {
        // seed an item with TWO_WHEEL
        UUID itemId = UUID.randomUUID();
        seedItem(itemId, "타이어(앞)", "BOTH", "TWO_WHEEL", 15000, 10);

        mockMvc.perform(patch("/api/v1/maintenance-items/{id}", itemId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "appliesToWheel":"FOUR_WHEEL"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.appliesToWheel").value("FOUR_WHEEL"));

        String wheel = jdbcTemplate.queryForObject(
                "select applies_to_wheel from maintenance_items where id = ?",
                String.class, itemId);
        assertThat(wheel).isEqualTo("FOUR_WHEEL");
    }

    @Test
    void updateItemLeavesAppliesToWheelUnchangedWhenNotProvided() throws Exception {
        UUID itemId = UUID.randomUUID();
        seedItem(itemId, "타이어(앞)", "BOTH", "TWO_WHEEL", 15000, 10);

        mockMvc.perform(patch("/api/v1/maintenance-items/{id}", itemId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name":"타이어(앞) 수정"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.appliesToWheel").value("TWO_WHEEL"));
    }

    // -----------------------------------------------------------------------
    // 2-axis filter: listItemsForBike
    // -----------------------------------------------------------------------

    /**
     * 2륜·전기 바이크 → engine ∈ {ELECTRIC,BOTH} AND wheel ∈ {TWO_WHEEL,BOTH}.
     *
     * 시드:
     *   A  (ELECTRIC, TWO_WHEEL)  → 포함 ✓
     *   B  (ICE,      FOUR_WHEEL) → 제외 ✗ (엔진 불일치, 휠 불일치)
     *   C  (BOTH,     BOTH)       → 포함 ✓
     *   D  (ELECTRIC, BOTH)       → 포함 ✓
     *   E  (BOTH,     TWO_WHEEL)  → 포함 ✓
     *   F  (ELECTRIC, FOUR_WHEEL) → 제외 ✗ (엔진 일치, 휠 불일치)
     *   G  (ICE,      TWO_WHEEL)  → 제외 ✗ (엔진 불일치, 휠 일치)
     */
    @Test
    void listItemsForBikeFiltersOnBothEngineAndWheelAxes() throws Exception {
        UUID itemA = seedItem(UUID.randomUUID(), "A 전기+2륜",  "ELECTRIC", "TWO_WHEEL",  1000, 1);
        UUID itemB = seedItem(UUID.randomUUID(), "B ICE+4륜",   "ICE",      "FOUR_WHEEL", 2000, 2);
        UUID itemC = seedItem(UUID.randomUUID(), "C BOTH+BOTH", "BOTH",     "BOTH",       3000, 3);
        UUID itemD = seedItem(UUID.randomUUID(), "D 전기+BOTH", "ELECTRIC", "BOTH",       4000, 4);
        UUID itemE = seedItem(UUID.randomUUID(), "E BOTH+2륜",  "BOTH",     "TWO_WHEEL",  5000, 5);
        UUID itemF = seedItem(UUID.randomUUID(), "F 전기+4륜",  "ELECTRIC", "FOUR_WHEEL", 6000, 6);
        UUID itemG = seedItem(UUID.randomUUID(), "G ICE+2륜",   "ICE",      "TWO_WHEEL",  7000, 7);

        // 2륜·전기 바이크
        seedBike(BIKE_ID, "ELECTRIC", "TWO_WHEEL");

        MvcResult result = mockMvc.perform(get("/api/v1/bikes/{bikeId}/maintenance-items", BIKE_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andReturn();

        String body = result.getResponse().getContentAsString();

        // 포함
        assertThat(body).contains(itemA.toString()); // ELECTRIC + TWO_WHEEL
        assertThat(body).contains(itemC.toString()); // BOTH     + BOTH
        assertThat(body).contains(itemD.toString()); // ELECTRIC + BOTH
        assertThat(body).contains(itemE.toString()); // BOTH     + TWO_WHEEL

        // 제외
        assertThat(body).doesNotContain(itemB.toString()); // ICE      + FOUR_WHEEL
        assertThat(body).doesNotContain(itemF.toString()); // ELECTRIC + FOUR_WHEEL
        assertThat(body).doesNotContain(itemG.toString()); // ICE      + TWO_WHEEL
    }

    @Test
    void listItemsForFourWheelElectricBikeFiltersCorrectly() throws Exception {
        UUID itemA = seedItem(UUID.randomUUID(), "A 전기+4륜",  "ELECTRIC", "FOUR_WHEEL", 1000, 1);
        UUID itemB = seedItem(UUID.randomUUID(), "B 전기+2륜",  "ELECTRIC", "TWO_WHEEL",  2000, 2);
        UUID itemC = seedItem(UUID.randomUUID(), "C BOTH+4륜",  "BOTH",     "FOUR_WHEEL", 3000, 3);
        UUID itemD = seedItem(UUID.randomUUID(), "D BOTH+BOTH", "BOTH",     "BOTH",       4000, 4);
        UUID itemE = seedItem(UUID.randomUUID(), "E ICE+4륜",   "ICE",      "FOUR_WHEEL", 5000, 5);

        // 4륜·전기 바이크
        seedBike(BIKE_ID, "ELECTRIC", "FOUR_WHEEL");

        MvcResult result = mockMvc.perform(get("/api/v1/bikes/{bikeId}/maintenance-items", BIKE_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andReturn();

        String body = result.getResponse().getContentAsString();

        assertThat(body).contains(itemA.toString()); // ELECTRIC + FOUR_WHEEL
        assertThat(body).contains(itemC.toString()); // BOTH     + FOUR_WHEEL
        assertThat(body).contains(itemD.toString()); // BOTH     + BOTH

        assertThat(body).doesNotContain(itemB.toString()); // ELECTRIC + TWO_WHEEL
        assertThat(body).doesNotContain(itemE.toString()); // ICE      + FOUR_WHEEL
    }

    // -----------------------------------------------------------------------
    // helpers
    // -----------------------------------------------------------------------

    /** Seeds a maintenance item. Returns its id. */
    private UUID seedItem(UUID id, String name, String appliesTo, String appliesToWheel,
                          int cycleKm, int displayOrder) {
        jdbcTemplate.update("""
                insert into maintenance_items
                    (id, name, applies_to, applies_to_wheel, cycle_km, display_order, enabled)
                values (?, ?, ?, ?, ?, ?, true)
                """, id, name, appliesTo, appliesToWheel, cycleKm, displayOrder);
        return id;
    }

    private void seedBike(UUID id, String engineType, String wheelType) {
        jdbcTemplate.update("""
                insert into bikes
                    (id, plate_number, vin, model_name, engine_type, wheel_type, service_type, operation_status, memo)
                values (?, ?, ?, 'Thunder M1', ?, ?, 'SINGLE', 'READY', 'fixture bike')
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
