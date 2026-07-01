package com.thundercrew.opsapi;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
class EquipmentTypeCommandApiContractTests extends PostgresContainerSupport {

    private static final UUID ADMIN_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final UUID EQUIPMENT_TYPE_ID = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private static final UUID BIKE_ID = UUID.fromString("cccccccc-cccc-cccc-cccc-cccccccccccc");
    private static final UUID BIKE_EQUIPMENT_ID = UUID.fromString("dddddddd-dddd-dddd-dddd-dddddddddddd");
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
        jdbcTemplate.update("delete from bike_equipments");
        jdbcTemplate.update("delete from equipment_types");
        jdbcTemplate.update("delete from bikes");
        jdbcTemplate.update("delete from admin_users");
        jdbcTemplate.update("""
                insert into admin_users (id, login_id, email, password_hash, display_name, enabled)
                values (?, 'ops-admin', 'ops@example.test', ?, 'Ops Admin', true)
                """, ADMIN_ID, passwordEncoder.encode("correct-password"));
        accessToken = loginAndExtractToken();
    }

    @Test
    void createEquipmentTypeGeneratesIdentifiersAndIgnoresClientSuppliedSystemFields() throws Exception {
        String clientSuppliedId = "99999999-9999-9999-9999-999999999999";

        MvcResult result = mockMvc.perform(post("/api/v1/equipment-types")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "id":"%s",
                                  "idx":999,
                                  "name":"브레이크 패드",
                                  "description":"소모품",
                                  "enabled":true,
                                  "deletedAt":"2026-01-01T00:00:00Z",
                                  "bikeId":"11111111-1111-1111-1111-111111111111"
                                }
                                """.formatted(clientSuppliedId)))
                .andExpect(status().isCreated())
                .andExpect(header().string(HttpHeaders.LOCATION, org.hamcrest.Matchers.startsWith("/api/v1/equipment-types/")))
                .andExpect(jsonPath("$.id").isString())
                .andExpect(jsonPath("$.id").value(org.hamcrest.Matchers.not(clientSuppliedId)))
                .andExpect(jsonPath("$.idx").isNumber())
                .andExpect(jsonPath("$.name").value("브레이크 패드"))
                .andExpect(jsonPath("$.description").value("소모품"))
                .andExpect(jsonPath("$.enabled").value(true))
                .andReturn();

        mockMvc.perform(get("/api/v1/equipment-types/{id}", extractId(result))
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("브레이크 패드"));
    }

    @Test
    void createEquipmentTypeRejectsMissingNameAndDuplicateActiveName() throws Exception {
        mockMvc.perform(post("/api/v1/equipment-types")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":""}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldViolations").isArray());

        seedEquipmentType(EQUIPMENT_TYPE_ID, "타이어", true, null);
        mockMvc.perform(post("/api/v1/equipment-types")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"타이어"}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DUPLICATE_ACTIVE_RESOURCE"));
    }

    @Test
    void updateEquipmentTypeChangesOperatorFieldsAndRejectsMissingOrDuplicateTargets() throws Exception {
        seedEquipmentType(EQUIPMENT_TYPE_ID, "타이어", true, null);
        UUID otherId = UUID.fromString("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee");
        seedEquipmentType(otherId, "브레이크", true, null);
        Long originalIdx = jdbcTemplate.queryForObject(
                "select idx from equipment_types where id = ?",
                Long.class,
                EQUIPMENT_TYPE_ID
        );

        mockMvc.perform(patch("/api/v1/equipment-types/{id}", EQUIPMENT_TYPE_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "id":"11111111-1111-1111-1111-111111111111",
                                  "idx":999,
                                  "name":"타이어 세트",
                                  "description":"교체 대상",
                                  "enabled":false,
                                  "deletedAt":"2026-01-01T00:00:00Z",
                                  "bikeId":"22222222-2222-2222-2222-222222222222"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(EQUIPMENT_TYPE_ID.toString()))
                .andExpect(jsonPath("$.idx").value(originalIdx))
                .andExpect(jsonPath("$.name").value("타이어 세트"))
                .andExpect(jsonPath("$.description").value("교체 대상"))
                .andExpect(jsonPath("$.enabled").value(false));

        Long updatedIdx = jdbcTemplate.queryForObject(
                "select idx from equipment_types where id = ?",
                Long.class,
                EQUIPMENT_TYPE_ID
        );
        Boolean stillNotDeleted = jdbcTemplate.queryForObject(
                "select deleted_at is null from equipment_types where id = ?",
                Boolean.class,
                EQUIPMENT_TYPE_ID
        );
        assertThat(updatedIdx).isEqualTo(originalIdx);
        assertThat(stillNotDeleted).isTrue();

        UUID missingId = UUID.fromString("11111111-1111-1111-1111-111111111111");
        mockMvc.perform(patch("/api/v1/equipment-types/{id}", missingId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"없는 장비"}
                                """))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"));

        mockMvc.perform(patch("/api/v1/equipment-types/{id}", EQUIPMENT_TYPE_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"브레이크"}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DUPLICATE_ACTIVE_RESOURCE"));
    }

    @Test
    void deleteEquipmentTypeSoftDeletesDisablesAndAllowsNameReuse() throws Exception {
        seedEquipmentType(EQUIPMENT_TYPE_ID, "배터리 커넥터", true, null);

        mockMvc.perform(delete("/api/v1/equipment-types/{id}", EQUIPMENT_TYPE_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isNoContent());

        Boolean enabled = jdbcTemplate.queryForObject(
                "select enabled from equipment_types where id = ?",
                Boolean.class,
                EQUIPMENT_TYPE_ID
        );
        assertThat(enabled).isFalse();

        mockMvc.perform(get("/api/v1/equipment-types/{id}", EQUIPMENT_TYPE_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/v1/equipment-types")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(0));

        mockMvc.perform(post("/api/v1/equipment-types")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"배터리 커넥터"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("배터리 커넥터"));
    }

    @Test
    void deleteEquipmentTypeRejectsActiveBikeEquipmentButAllowsRemovedHistory() throws Exception {
        seedEquipmentType(EQUIPMENT_TYPE_ID, "브레이크", true, null);
        seedBike(BIKE_ID);
        seedBikeEquipment(BIKE_EQUIPMENT_ID, BIKE_ID, EQUIPMENT_TYPE_ID, null);

        mockMvc.perform(delete("/api/v1/equipment-types/{id}", EQUIPMENT_TYPE_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVALID_STATE_TRANSITION"));

        jdbcTemplate.update("update bike_equipments set removed_at = now() where id = ?", BIKE_EQUIPMENT_ID);

        mockMvc.perform(delete("/api/v1/equipment-types/{id}", EQUIPMENT_TYPE_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isNoContent());
    }

    @Test
    void commandRequestsRequireBearerAuthentication() throws Exception {
        mockMvc.perform(post("/api/v1/equipment-types")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_FAILED"));

        mockMvc.perform(patch("/api/v1/equipment-types/{id}", EQUIPMENT_TYPE_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_FAILED"));

        mockMvc.perform(delete("/api/v1/equipment-types/{id}", EQUIPMENT_TYPE_ID))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_FAILED"));
    }

    private void seedBike(UUID id) {
        jdbcTemplate.update("""
                insert into bikes (id, plate_number, vin, model_name, operation_status)
                values (?, ?, ?, 'Thunder M1', 'READY')
                """, id, "서울E-" + id.toString().substring(0, 4), "VIN-EQ-" + id);
    }

    private void seedEquipmentType(UUID id, String name, boolean enabled, String deletedAtSql) {
        String deletedAtExpression = deletedAtSql == null ? "null" : deletedAtSql;
        jdbcTemplate.update("""
                insert into equipment_types (id, name, description, enabled, deleted_at)
                values (?, ?, 'fixture type', ?, %s)
                """.formatted(deletedAtExpression), id, name, enabled);
    }

    private void seedBikeEquipment(UUID id, UUID bikeId, UUID equipmentTypeId, String removedAtSql) {
        String removedAtExpression = removedAtSql == null ? "null" : removedAtSql;
        jdbcTemplate.update("""
                insert into bike_equipments (
                    id, bike_id, equipment_type_id, equipment_label, model_name, serial_number,
                    installed_at, removed_at, management_due_date, management_note, memo
                ) values (?, ?, ?, 'fixture equipment', 'EQ-100', 'SER-TYPE-GUARD', now(), %s, current_date + interval '30 day', 'fixture note', 'fixture memo')
                """.formatted(removedAtExpression), id, bikeId, equipmentTypeId);
    }

    private String loginAndExtractToken() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"loginId":"ops-admin","password":"correct-password"}
                                """))
                .andExpect(status().isOk())
                .andReturn();
        return extractAccessToken(result);
    }

    private String extractAccessToken(MvcResult result) throws Exception {
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
