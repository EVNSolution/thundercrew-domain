package com.thundercrew.opsapi;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
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
class BikeEquipmentCommandApiContractTests extends PostgresContainerSupport {

    private static final ZoneId OPERATION_ZONE = ZoneId.of("Asia/Seoul");
    private static final UUID ADMIN_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final UUID BIKE_ID = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private static final UUID OTHER_BIKE_ID = UUID.fromString("cccccccc-cccc-cccc-cccc-cccccccccccc");
    private static final UUID EQUIPMENT_TYPE_ID = UUID.fromString("dddddddd-dddd-dddd-dddd-dddddddddddd");
    private static final UUID OTHER_EQUIPMENT_TYPE_ID = UUID.fromString("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee");
    private static final UUID BIKE_EQUIPMENT_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID OTHER_BIKE_EQUIPMENT_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
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
    void createBikeEquipmentGeneratesIdentifiersIgnoresSystemFieldsAndComputesStatus() throws Exception {
        seedBike(BIKE_ID, false);
        seedEquipmentType(EQUIPMENT_TYPE_ID, "브레이크", true, null);
        String clientSuppliedId = "99999999-9999-9999-9999-999999999999";
        LocalDate dueSoonDate = today().plusDays(3);

        MvcResult result = mockMvc.perform(post("/api/v1/bike-equipments")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "id":"%s",
                                  "idx":999,
                                  "bikeId":"%s",
                                  "equipmentTypeId":"%s",
                                  "equipmentLabel":"전륜 브레이크",
                                  "modelName":"Brake V1",
                                  "serialNumber":"SER-EQ-001",
                                  "installedAt":"2026-04-30T00:00:00Z",
                                  "removedAt":"2026-05-01T00:00:00Z",
                                  "managementDueDate":"%s",
                                  "managementNote":"3일 뒤 점검",
                                  "memo":"현장 장착",
                                  "deletedAt":"2026-01-01T00:00:00Z"
                                }
                                """.formatted(clientSuppliedId, BIKE_ID, EQUIPMENT_TYPE_ID, dueSoonDate)))
                .andExpect(status().isCreated())
                .andExpect(header().string(HttpHeaders.LOCATION, org.hamcrest.Matchers.startsWith("/api/v1/bike-equipments/")))
                .andExpect(jsonPath("$.id").isString())
                .andExpect(jsonPath("$.id").value(org.hamcrest.Matchers.not(clientSuppliedId)))
                .andExpect(jsonPath("$.idx").isNumber())
                .andExpect(jsonPath("$.bikeId").value(BIKE_ID.toString()))
                .andExpect(jsonPath("$.equipmentTypeId").value(EQUIPMENT_TYPE_ID.toString()))
                .andExpect(jsonPath("$.equipmentLabel").value("전륜 브레이크"))
                .andExpect(jsonPath("$.modelName").value("Brake V1"))
                .andExpect(jsonPath("$.serialNumber").value("SER-EQ-001"))
                .andExpect(jsonPath("$.managementDueDate").value(dueSoonDate.toString()))
                .andExpect(jsonPath("$.managementStatus").value("DUE_SOON"))
                .andReturn();

        mockMvc.perform(get("/api/v1/bike-equipments/{id}", extractId(result))
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.removedAt").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.managementStatus").value("DUE_SOON"));
    }

    @Test
    void createBikeEquipmentValidatesRequiredFieldsAndReferences() throws Exception {
        seedBike(BIKE_ID, false);
        seedBike(OTHER_BIKE_ID, true);
        seedEquipmentType(EQUIPMENT_TYPE_ID, "브레이크", true, null);
        seedEquipmentType(OTHER_EQUIPMENT_TYPE_ID, "삭제타입", true, "now()");
        UUID disabledTypeId = UUID.fromString("33333333-3333-3333-3333-333333333333");
        seedEquipmentType(disabledTypeId, "비활성타입", false, null);

        mockMvc.perform(post("/api/v1/bike-equipments")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));

        UUID missingBikeId = UUID.fromString("44444444-4444-4444-4444-444444444444");
        mockMvc.perform(postCreateRequest(missingBikeId, EQUIPMENT_TYPE_ID, "SER-MISSING-BIKE"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("REFERENCE_NOT_FOUND"));

        mockMvc.perform(postCreateRequest(OTHER_BIKE_ID, EQUIPMENT_TYPE_ID, "SER-DELETED-BIKE"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("REFERENCE_DELETED"));

        UUID missingTypeId = UUID.fromString("55555555-5555-5555-5555-555555555555");
        mockMvc.perform(postCreateRequest(BIKE_ID, missingTypeId, "SER-MISSING-TYPE"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("REFERENCE_NOT_FOUND"));

        mockMvc.perform(postCreateRequest(BIKE_ID, OTHER_EQUIPMENT_TYPE_ID, "SER-DELETED-TYPE"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("REFERENCE_DELETED"));

        mockMvc.perform(postCreateRequest(BIKE_ID, disabledTypeId, "SER-DISABLED-TYPE"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVALID_STATE_TRANSITION"));
    }

    @Test
    void createAllowsSameBikeAndTypeButRejectsDuplicateActiveSerialUntilRemoved() throws Exception {
        seedBike(BIKE_ID, false);
        seedEquipmentType(EQUIPMENT_TYPE_ID, "브레이크", true, null);
        seedBikeEquipment(BIKE_EQUIPMENT_ID, BIKE_ID, EQUIPMENT_TYPE_ID, "SER-DUP", today().plusDays(10), null);

        mockMvc.perform(postCreateRequest(BIKE_ID, EQUIPMENT_TYPE_ID, "SER-SECOND"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.bikeId").value(BIKE_ID.toString()))
                .andExpect(jsonPath("$.equipmentTypeId").value(EQUIPMENT_TYPE_ID.toString()));

        mockMvc.perform(postCreateRequest(BIKE_ID, EQUIPMENT_TYPE_ID, "SER-DUP"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DUPLICATE_ACTIVE_RESOURCE"));

        jdbcTemplate.update("update bike_equipments set removed_at = now() where id = ?", BIKE_EQUIPMENT_ID);

        mockMvc.perform(postCreateRequest(BIKE_ID, EQUIPMENT_TYPE_ID, "SER-DUP"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.serialNumber").value("SER-DUP"));
    }

    @Test
    void updateBikeEquipmentChangesMutableFieldsWithoutMovingBikeOrTypeAndRejectsDuplicateSerial() throws Exception {
        seedBike(BIKE_ID, false);
        seedBike(OTHER_BIKE_ID, false);
        seedEquipmentType(EQUIPMENT_TYPE_ID, "브레이크", true, null);
        seedEquipmentType(OTHER_EQUIPMENT_TYPE_ID, "타이어", true, null);
        seedBikeEquipment(BIKE_EQUIPMENT_ID, BIKE_ID, EQUIPMENT_TYPE_ID, "SER-OLD", today().plusDays(10), null);
        seedBikeEquipment(OTHER_BIKE_EQUIPMENT_ID, OTHER_BIKE_ID, OTHER_EQUIPMENT_TYPE_ID, "SER-OTHER", today().plusDays(10), null);
        Long originalIdx = jdbcTemplate.queryForObject(
                "select idx from bike_equipments where id = ?",
                Long.class,
                BIKE_EQUIPMENT_ID
        );
        LocalDate overdueDate = today().minusDays(1);

        mockMvc.perform(patch("/api/v1/bike-equipments/{id}", BIKE_EQUIPMENT_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "id":"99999999-9999-9999-9999-999999999999",
                                  "idx":999,
                                  "bikeId":"%s",
                                  "equipmentTypeId":"%s",
                                  "installedAt":"2026-05-01T00:00:00Z",
                                  "removedAt":"2026-05-02T00:00:00Z",
                                  "equipmentLabel":"후륜 브레이크",
                                  "modelName":"Brake V2",
                                  "serialNumber":"SER-NEW",
                                  "managementDueDate":"%s",
                                  "managementNote":"기한 초과",
                                  "memo":"수정 메모",
                                  "deletedAt":"2026-01-01T00:00:00Z"
                                }
                                """.formatted(OTHER_BIKE_ID, OTHER_EQUIPMENT_TYPE_ID, overdueDate)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(BIKE_EQUIPMENT_ID.toString()))
                .andExpect(jsonPath("$.idx").value(originalIdx))
                .andExpect(jsonPath("$.bikeId").value(BIKE_ID.toString()))
                .andExpect(jsonPath("$.equipmentTypeId").value(EQUIPMENT_TYPE_ID.toString()))
                .andExpect(jsonPath("$.equipmentLabel").value("후륜 브레이크"))
                .andExpect(jsonPath("$.modelName").value("Brake V2"))
                .andExpect(jsonPath("$.serialNumber").value("SER-NEW"))
                .andExpect(jsonPath("$.managementDueDate").value(overdueDate.toString()))
                .andExpect(jsonPath("$.managementStatus").value("OVERDUE"));

        Boolean stillNotDeleted = jdbcTemplate.queryForObject(
                "select deleted_at is null from bike_equipments where id = ?",
                Boolean.class,
                BIKE_EQUIPMENT_ID
        );
        Instant installedAt = jdbcTemplate.queryForObject(
                "select installed_at from bike_equipments where id = ?",
                Instant.class,
                BIKE_EQUIPMENT_ID
        );
        Boolean stillNotRemoved = jdbcTemplate.queryForObject(
                "select removed_at is null from bike_equipments where id = ?",
                Boolean.class,
                BIKE_EQUIPMENT_ID
        );
        assertThat(stillNotDeleted).isTrue();
        assertThat(installedAt).isEqualTo(Instant.parse("2026-04-30T00:00:00Z"));
        assertThat(stillNotRemoved).isTrue();

        mockMvc.perform(patch("/api/v1/bike-equipments/{id}", BIKE_EQUIPMENT_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"serialNumber":"SER-OTHER"}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DUPLICATE_ACTIVE_RESOURCE"));

        UUID missingId = UUID.fromString("66666666-6666-6666-6666-666666666666");
        mockMvc.perform(patch("/api/v1/bike-equipments/{id}", missingId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"memo":"missing"}
                                """))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"));
    }

    @Test
    void removeBikeEquipmentPreservesHistoryRejectsInvalidTransitionsAndStopsSerialBlocking() throws Exception {
        seedBike(BIKE_ID, false);
        seedEquipmentType(EQUIPMENT_TYPE_ID, "브레이크", true, null);
        seedBikeEquipment(BIKE_EQUIPMENT_ID, BIKE_ID, EQUIPMENT_TYPE_ID, "SER-REMOVE", today().plusDays(10), null);
        Instant removedAt = Instant.parse("2026-05-01T00:00:00Z");

        mockMvc.perform(patch("/api/v1/bike-equipments/{id}/remove", BIKE_EQUIPMENT_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"removedAt":"%s","memo":"탈거 완료"}
                                """.formatted(removedAt)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(BIKE_EQUIPMENT_ID.toString()))
                .andExpect(jsonPath("$.removedAt").value("2026-05-01T00:00:00Z"))
                .andExpect(jsonPath("$.memo").value("탈거 완료"));

        mockMvc.perform(get("/api/v1/bike-equipments/{id}", BIKE_EQUIPMENT_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.removedAt").value("2026-05-01T00:00:00Z"));

        mockMvc.perform(postCreateRequest(BIKE_ID, EQUIPMENT_TYPE_ID, "SER-REMOVE"))
                .andExpect(status().isCreated());

        mockMvc.perform(patch("/api/v1/bike-equipments/{id}/remove", BIKE_EQUIPMENT_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVALID_STATE_TRANSITION"));

        UUID anotherId = UUID.fromString("77777777-7777-7777-7777-777777777777");
        seedBikeEquipment(anotherId, BIKE_ID, EQUIPMENT_TYPE_ID, "SER-INVALID-REMOVE", today().plusDays(10), null);
        mockMvc.perform(patch("/api/v1/bike-equipments/{id}/remove", anotherId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"removedAt":"2026-04-29T00:00:00Z"}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVALID_STATE_TRANSITION"));
    }

    @Test
    void commandRequestsRequireBearerAuthentication() throws Exception {
        mockMvc.perform(post("/api/v1/bike-equipments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_FAILED"));

        mockMvc.perform(patch("/api/v1/bike-equipments/{id}", BIKE_EQUIPMENT_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_FAILED"));

        mockMvc.perform(patch("/api/v1/bike-equipments/{id}/remove", BIKE_EQUIPMENT_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_FAILED"));
    }

    private org.springframework.test.web.servlet.RequestBuilder postCreateRequest(
            UUID bikeId,
            UUID equipmentTypeId,
            String serialNumber
    ) {
        return post("/api/v1/bike-equipments")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {
                          "bikeId":"%s",
                          "equipmentTypeId":"%s",
                          "equipmentLabel":"전륜 브레이크",
                          "modelName":"Brake V1",
                          "serialNumber":"%s",
                          "installedAt":"2026-04-30T00:00:00Z",
                          "managementDueDate":"%s",
                          "managementNote":"정기 관리",
                          "memo":"장착 메모"
                        }
                        """.formatted(bikeId, equipmentTypeId, serialNumber, today().plusDays(14)));
    }

    private void seedBike(UUID id, boolean deleted) {
        jdbcTemplate.update("""
                insert into bikes (id, plate_number, vin, model_name, operation_status, deleted_at)
                values (?, ?, ?, 'Thunder M1', 'READY', %s)
                """.formatted(deleted ? "now()" : "null"), id, "서울E-" + id.toString().substring(0, 4), "VIN-EQ-" + id);
    }

    private void seedEquipmentType(UUID id, String name, boolean enabled, String deletedAtSql) {
        String deletedAtExpression = deletedAtSql == null ? "null" : deletedAtSql;
        jdbcTemplate.update("""
                insert into equipment_types (id, name, description, enabled, deleted_at)
                values (?, ?, 'fixture type', ?, %s)
                """.formatted(deletedAtExpression), id, name, enabled);
    }

    private void seedBikeEquipment(
            UUID id,
            UUID bikeId,
            UUID equipmentTypeId,
            String serialNumber,
            LocalDate managementDueDate,
            String removedAtSql
    ) {
        String removedAtExpression = removedAtSql == null ? "null" : removedAtSql;
        jdbcTemplate.update("""
                insert into bike_equipments (
                    id, bike_id, equipment_type_id, equipment_label, model_name, serial_number,
                    installed_at, removed_at, management_due_date, management_note, memo
                ) values (?, ?, ?, 'fixture equipment', 'EQ-100', ?, '2026-04-30T00:00:00Z', %s, ?, 'fixture note', 'fixture memo')
                """.formatted(removedAtExpression), id, bikeId, equipmentTypeId, serialNumber, managementDueDate);
    }

    private LocalDate today() {
        return LocalDate.now(OPERATION_ZONE);
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
