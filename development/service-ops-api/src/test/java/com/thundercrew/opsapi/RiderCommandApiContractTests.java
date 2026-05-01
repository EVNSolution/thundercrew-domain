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
class RiderCommandApiContractTests extends PostgresContainerSupport {

    private static final UUID ADMIN_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final UUID RIDER_ID = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private static final UUID OTHER_RIDER_ID = UUID.fromString("cccccccc-cccc-cccc-cccc-cccccccccccc");
    private static final UUID APP_ACCOUNT_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
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
        jdbcTemplate.update("delete from rider_insurances");
        jdbcTemplate.update("delete from insurance_items");
        jdbcTemplate.update("delete from rider_bike_contracts");
        jdbcTemplate.update("delete from bikes");
        jdbcTemplate.update("delete from riders");
        jdbcTemplate.update("delete from admin_users");
        jdbcTemplate.update("""
                insert into admin_users (id, login_id, email, password_hash, display_name, enabled)
                values (?, 'ops-admin', 'ops@example.test', ?, 'Ops Admin', true)
                """, ADMIN_ID, passwordEncoder.encode("correct-password"));
        accessToken = loginAndExtractToken();
    }

    @Test
    void createRiderGeneratesIdentifiersAndIgnoresClientSuppliedSystemFields() throws Exception {
        String clientSuppliedId = "99999999-9999-9999-9999-999999999999";

        MvcResult result = mockMvc.perform(post("/api/v1/riders")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "id":"%s",
                                  "idx":999,
                                  "name":"신규 라이더",
                                  "phoneNumber":"010-3000-4000",
                                  "teamName":"서초팀",
                                  "areaName":"서울 서초",
                                  "memo":"현장 등록",
                                  "appAccountLinked":true,
                                  "appAccountId":"11111111-1111-1111-1111-111111111111",
                                  "bikeId":"22222222-2222-2222-2222-222222222222",
                                  "contractId":"33333333-3333-3333-3333-333333333333",
                                  "insuranceId":"44444444-4444-4444-4444-444444444444",
                                  "deletedAt":"2026-01-01T00:00:00Z"
                                }
                                """.formatted(clientSuppliedId)))
                .andExpect(status().isCreated())
                .andExpect(header().string(HttpHeaders.LOCATION, org.hamcrest.Matchers.startsWith("/api/v1/riders/")))
                .andExpect(jsonPath("$.id").isString())
                .andExpect(jsonPath("$.id").value(org.hamcrest.Matchers.not(clientSuppliedId)))
                .andExpect(jsonPath("$.idx").isNumber())
                .andExpect(jsonPath("$.name").value("신규 라이더"))
                .andExpect(jsonPath("$.phoneNumber").value("010-3000-4000"))
                .andExpect(jsonPath("$.teamName").value("서초팀"))
                .andExpect(jsonPath("$.areaName").value("서울 서초"))
                .andExpect(jsonPath("$.appAccountLinked").value(false))
                .andExpect(jsonPath("$.appLinkStatus").value("NOT_LINKED"))
                .andReturn();

        String createdId = extractId(result);
        mockMvc.perform(get("/api/v1/riders/{id}", createdId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.phoneNumber").value("010-3000-4000"));
    }

    @Test
    void createRiderRejectsMissingHumanRequiredFields() throws Exception {
        mockMvc.perform(post("/api/v1/riders")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"","phoneNumber":""}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldViolations").isArray());
    }

    @Test
    void createRiderRejectsDuplicateActivePhoneNumber() throws Exception {
        seedRider(RIDER_ID, "기존 라이더", "010-1000-2000", null);

        mockMvc.perform(post("/api/v1/riders")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"중복 라이더","phoneNumber":"010-1000-2000"}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DUPLICATE_ACTIVE_RESOURCE"))
                .andExpect(jsonPath("$.path").value("/api/v1/riders"));
    }

    @Test
    void updateRiderChangesOnlyBasicProfileFields() throws Exception {
        seedRider(RIDER_ID, "기존 라이더", "010-1000-2000", null);

        mockMvc.perform(patch("/api/v1/riders/{id}", RIDER_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name":"수정 라이더",
                                  "phoneNumber":"010-5555-6666",
                                  "teamName":"강동팀",
                                  "areaName":"서울 강동",
                                  "memo":"수정 완료",
                                  "appAccountLinked":true,
                                  "bikeId":"22222222-2222-2222-2222-222222222222",
                                  "contractId":"33333333-3333-3333-3333-333333333333",
                                  "insuranceId":"44444444-4444-4444-4444-444444444444"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(RIDER_ID.toString()))
                .andExpect(jsonPath("$.name").value("수정 라이더"))
                .andExpect(jsonPath("$.phoneNumber").value("010-5555-6666"))
                .andExpect(jsonPath("$.teamName").value("강동팀"))
                .andExpect(jsonPath("$.areaName").value("서울 강동"))
                .andExpect(jsonPath("$.memo").value("수정 완료"))
                .andExpect(jsonPath("$.appAccountLinked").value(false));
    }

    @Test
    void updateRiderRejectsMissingOrDuplicateTargets() throws Exception {
        seedRider(RIDER_ID, "기존 라이더", "010-1000-2000", null);
        seedRider(OTHER_RIDER_ID, "다른 라이더", "010-2222-3333", null);

        UUID missingId = UUID.fromString("dddddddd-dddd-dddd-dddd-dddddddddddd");
        mockMvc.perform(patch("/api/v1/riders/{id}", missingId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"없음","phoneNumber":"010-0000-0000"}
                                """))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"));

        mockMvc.perform(patch("/api/v1/riders/{id}", RIDER_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"phoneNumber":"010-2222-3333"}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DUPLICATE_ACTIVE_RESOURCE"));
    }


    @Test
    void updateRiderRejectsBlankBasicRequiredFieldsWhenProvided() throws Exception {
        seedRider(RIDER_ID, "기존 라이더", "010-1000-2000", null);

        mockMvc.perform(patch("/api/v1/riders/{id}", RIDER_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"","phoneNumber":""}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldViolations").isArray());
    }

    @Test
    void linkRiderAppAccountUsesSelectorProducedReferenceAndServerOwnedTimestamp() throws Exception {
        seedRider(RIDER_ID, "앱 연동 라이더", "010-1000-2000", null);

        mockMvc.perform(patch("/api/v1/riders/{id}/app-account/link", RIDER_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "appAccountId":"%s",
                                  "appLinkedAt":"2026-04-30T01:02:03Z",
                                  "id":"99999999-9999-9999-9999-999999999999",
                                  "riderId":"88888888-8888-8888-8888-888888888888"
                                }
                                """.formatted(APP_ACCOUNT_ID)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(RIDER_ID.toString()))
                .andExpect(jsonPath("$.appAccountLinked").value(true))
                .andExpect(jsonPath("$.appAccountId").value(APP_ACCOUNT_ID.toString()))
                .andExpect(jsonPath("$.appLinkStatus").value("LINKED"))
                .andExpect(jsonPath("$.appLinkedAt").isString())
                .andExpect(jsonPath("$.appLinkedAt").value(org.hamcrest.Matchers.not("2026-04-30T01:02:03Z")));

        mockMvc.perform(get("/api/v1/riders/{id}", RIDER_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.appAccountLinked").value(true))
                .andExpect(jsonPath("$.appAccountId").value(APP_ACCOUNT_ID.toString()));
    }

    @Test
    void unlinkRiderAppAccountClearsLinkFieldsAndIsIdempotent() throws Exception {
        seedLinkedRider(RIDER_ID, "앱 해제 라이더", "010-1000-2000", APP_ACCOUNT_ID, null);

        mockMvc.perform(patch("/api/v1/riders/{id}/app-account/unlink", RIDER_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(RIDER_ID.toString()))
                .andExpect(jsonPath("$.appAccountLinked").value(false))
                .andExpect(jsonPath("$.appAccountId").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.appLinkedAt").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.appLinkStatus").value("NOT_LINKED"));

        mockMvc.perform(patch("/api/v1/riders/{id}/app-account/unlink", RIDER_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.appAccountLinked").value(false))
                .andExpect(jsonPath("$.appAccountId").value(org.hamcrest.Matchers.nullValue()));
    }

    @Test
    void linkRiderAppAccountRejectsDuplicateOrConflictingActiveLinks() throws Exception {
        UUID otherAppAccountId = UUID.fromString("22222222-2222-2222-2222-222222222222");
        seedLinkedRider(RIDER_ID, "기존 앱 라이더", "010-1000-2000", APP_ACCOUNT_ID, null);
        seedRider(OTHER_RIDER_ID, "다른 라이더", "010-2222-3333", null);

        mockMvc.perform(patch("/api/v1/riders/{id}/app-account/link", OTHER_RIDER_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"appAccountId":"%s"}
                                """.formatted(APP_ACCOUNT_ID)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DUPLICATE_ACTIVE_RESOURCE"));

        mockMvc.perform(patch("/api/v1/riders/{id}/app-account/link", RIDER_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"appAccountId":"%s"}
                                """.formatted(otherAppAccountId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVALID_STATE_TRANSITION"));

        mockMvc.perform(patch("/api/v1/riders/{id}/app-account/link", RIDER_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"appAccountId":"%s"}
                                """.formatted(APP_ACCOUNT_ID)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.appAccountId").value(APP_ACCOUNT_ID.toString()));
    }

    @Test
    void linkAndUnlinkRiderAppAccountRejectMissingOrDeletedRidersAndInvalidRequest() throws Exception {
        seedRider(RIDER_ID, "삭제 앱 라이더", "010-1000-2000", "now()");
        UUID missingId = UUID.fromString("dddddddd-dddd-dddd-dddd-dddddddddddd");

        mockMvc.perform(patch("/api/v1/riders/{id}/app-account/link", missingId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"appAccountId":"%s"}
                                """.formatted(APP_ACCOUNT_ID)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"));

        mockMvc.perform(patch("/api/v1/riders/{id}/app-account/unlink", RIDER_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"));

        mockMvc.perform(patch("/api/v1/riders/{id}/app-account/link", RIDER_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    @Test
    void deleteRiderSoftDeletesAndAllowsPhoneReuse() throws Exception {
        seedRider(RIDER_ID, "기존 라이더", "010-1000-2000", null);

        mockMvc.perform(delete("/api/v1/riders/{id}", RIDER_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/riders/{id}", RIDER_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/v1/riders")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(0));

        mockMvc.perform(post("/api/v1/riders")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"재사용 라이더","phoneNumber":"010-1000-2000"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.phoneNumber").value("010-1000-2000"));
    }


    @Test
    void deleteRiderRejectsActiveContractOrInsuranceReferences() throws Exception {
        seedRider(RIDER_ID, "계약 라이더", "010-1000-2000", null);
        UUID bikeId = UUID.fromString("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee");
        UUID contractId = UUID.fromString("ffffffff-ffff-ffff-ffff-ffffffffffff");
        jdbcTemplate.update("""
                insert into bikes (id, plate_number, vin, model_name, operation_status)
                values (?, 'TH-DEL', 'VIN-DELETE-001', 'Thunder M1', 'READY')
                """, bikeId);
        jdbcTemplate.update("""
                insert into rider_bike_contracts (id, rider_id, bike_id, contract_template_id, start_at)
                values (?, ?, ?, '00000000-0000-0000-0000-000000000001', now())
                """, contractId, RIDER_ID, bikeId);

        mockMvc.perform(delete("/api/v1/riders/{id}", RIDER_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVALID_STATE_TRANSITION"));

        jdbcTemplate.update("delete from rider_bike_contracts");
        UUID insuranceItemId = UUID.fromString("12121212-1212-1212-1212-121212121212");
        UUID riderInsuranceId = UUID.fromString("34343434-3434-3434-3434-343434343434");
        jdbcTemplate.update("""
                insert into insurance_items (id, name, enabled)
                values (?, '삭제 차단 보험', true)
                """, insuranceItemId);
        jdbcTemplate.update("""
                insert into rider_insurances (id, rider_id, insurance_item_id, enabled)
                values (?, ?, ?, true)
                """, riderInsuranceId, RIDER_ID, insuranceItemId);

        mockMvc.perform(delete("/api/v1/riders/{id}", RIDER_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVALID_STATE_TRANSITION"));

        mockMvc.perform(get("/api/v1/riders/{id}", RIDER_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk());
    }

    @Test
    void deleteMissingOrAlreadyDeletedRiderReturnsNotFound() throws Exception {
        seedRider(RIDER_ID, "삭제 라이더", "010-1000-2000", "now()");

        mockMvc.perform(delete("/api/v1/riders/{id}", RIDER_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"));
    }

    @Test
    void commandRequestsRequireBearerAuthentication() throws Exception {
        mockMvc.perform(post("/api/v1/riders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"무인증","phoneNumber":"010-9999-0000"}
                                """))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_FAILED"));

        mockMvc.perform(patch("/api/v1/riders/{id}/app-account/link", RIDER_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"appAccountId":"%s"}
                                """.formatted(APP_ACCOUNT_ID)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_FAILED"));

        mockMvc.perform(patch("/api/v1/riders/{id}/app-account/unlink", RIDER_ID))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_FAILED"));
    }

    private void seedRider(UUID id, String name, String phoneNumber, String deletedAtSql) {
        String deletedAtExpression = deletedAtSql == null ? "null" : deletedAtSql;
        jdbcTemplate.update("""
                insert into riders (id, name, phone_number, team_name, area_name, app_account_linked, memo, deleted_at)
                values (?, ?, ?, '강남팀', '서울 강남', false, 'fixture rider', %s)
                """.formatted(deletedAtExpression), id, name, phoneNumber);
    }

    private void seedLinkedRider(
            UUID id,
            String name,
            String phoneNumber,
            UUID appAccountId,
            String deletedAtSql
    ) {
        String deletedAtExpression = deletedAtSql == null ? "null" : deletedAtSql;
        jdbcTemplate.update("""
                insert into riders (
                    id, name, phone_number, team_name, area_name,
                    app_account_linked, app_account_id, app_linked_at, memo, deleted_at
                ) values (?, ?, ?, '강남팀', '서울 강남', true, ?, now(), 'fixture rider', %s)
                """.formatted(deletedAtExpression), id, name, phoneNumber, appAccountId);
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
