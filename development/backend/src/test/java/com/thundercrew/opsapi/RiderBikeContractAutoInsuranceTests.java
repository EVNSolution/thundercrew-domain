package com.thundercrew.opsapi;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.List;
import java.util.Map;
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

/**
 * Slice D: rider-bike contract creation auto-issues a rider insurance row
 * when the contract template opts in (\`includes_insurance=true\` +
 * \`default_insurance_item_id\`). Each early-return path in the service is
 * mirrored as a SKIP token in the response.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class RiderBikeContractAutoInsuranceTests extends PostgresContainerSupport {

    private static final UUID ADMIN_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final UUID RIDER_ID = UUID.fromString("bbbb1111-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private static final UUID BIKE_ID = UUID.fromString("cccc1111-cccc-cccc-cccc-cccccccccccc");
    private static final UUID INSURANCE_ITEM_ID = UUID.fromString("eeee1111-eeee-eeee-eeee-eeeeeeeeeeee");
    private static final UUID DISABLED_INSURANCE_ITEM_ID = UUID.fromString("eeee2222-eeee-eeee-eeee-eeeeeeeeeeee");
    private static final UUID DELETED_INSURANCE_ITEM_ID = UUID.fromString("eeee3333-eeee-eeee-eeee-eeeeeeeeeeee");
    private static final UUID PHANTOM_INSURANCE_ITEM_ID = UUID.fromString("eeee9999-eeee-eeee-eeee-eeeeeeeeeeee");
    private static final Instant CONTRACT_START = Instant.parse("2030-01-01T00:00:00Z");
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
        jdbcTemplate.update("delete from rider_bike_contracts");
        jdbcTemplate.update("delete from riders");
        jdbcTemplate.update("delete from bikes");
        jdbcTemplate.update("delete from contract_templates where system_template = false");
        jdbcTemplate.update("""
                delete from insurance_items
                where id not in (
                    '22222222-2222-2222-2222-000000000001',
                    '22222222-2222-2222-2222-000000000002',
                    '22222222-2222-2222-2222-000000000003',
                    '22222222-2222-2222-2222-000000000004'
                )
                """);
        jdbcTemplate.update("delete from admin_users");
        jdbcTemplate.update("""
                insert into admin_users (id, login_id, email, password_hash, display_name, enabled)
                values (?, 'ops-admin', 'ops@example.test', ?, 'Ops Admin', true)
                """, ADMIN_ID, passwordEncoder.encode("correct-password"));
        seedRider(RIDER_ID, "자동 보험 라이더", "010-9000-1000");
        seedBike(BIKE_ID, "AUTO-INS-001", "VIN-AUTO-INS-001");
        seedInsuranceItem(INSURANCE_ITEM_ID, "자동 발급 보험", true, false);
        seedInsuranceItem(DISABLED_INSURANCE_ITEM_ID, "비활성 보험", false, false);
        seedInsuranceItem(DELETED_INSURANCE_ITEM_ID, "삭제된 보험", true, true);
        accessToken = loginAndExtractToken();
    }

    @Test
    void subscriptionTemplateAutoIssuesInsuranceWhenIncludesInsuranceWithItem() throws Exception {
        UUID templateId = seedSubscriptionTemplate("Subs Auto-Issue", true, INSURANCE_ITEM_ID);

        MvcResult result = mockMvc.perform(post("/api/v1/rider-bike-contracts")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(contractBody(RIDER_ID, BIKE_ID, templateId, CONTRACT_START)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.autoIssuedRiderInsuranceId").isString())
                .andExpect(jsonPath("$.autoInsuranceSkipReason").value(org.hamcrest.Matchers.nullValue()))
                .andReturn();

        UUID autoIssuedId = UUID.fromString(extractTextField(result, "autoIssuedRiderInsuranceId"));
        Map<String, Object> riderInsurance = jdbcTemplate.queryForMap("""
                select rider_id, insurance_item_id, rider_bike_contract_id,
                       starts_at, ends_at, enabled
                from rider_insurances
                where id = ?
                """, autoIssuedId);
        assertThat(riderInsurance.get("rider_id")).isEqualTo(RIDER_ID);
        assertThat(riderInsurance.get("insurance_item_id")).isEqualTo(INSURANCE_ITEM_ID);
        assertThat(riderInsurance.get("rider_bike_contract_id"))
                .isEqualTo(UUID.fromString(extractTextField(result, "id")));
        assertThat(riderInsurance.get("enabled")).isEqualTo(true);
    }

    @Test
    void templateThatDoesNotOptInSkipsAutoIssuance() throws Exception {
        UUID templateId = seedSubscriptionTemplate("Subs No-Insurance", false, null);

        mockMvc.perform(post("/api/v1/rider-bike-contracts")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(contractBody(RIDER_ID, BIKE_ID, templateId, CONTRACT_START)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.autoIssuedRiderInsuranceId").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.autoInsuranceSkipReason").value("TEMPLATE_NOT_OPTED_IN"));
    }

    @Test
    void templateOptedInWithoutDefaultItemSkipsAutoIssuance() throws Exception {
        UUID templateId = seedSubscriptionTemplate("Subs Missing Item", true, null);

        mockMvc.perform(post("/api/v1/rider-bike-contracts")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(contractBody(RIDER_ID, BIKE_ID, templateId, CONTRACT_START)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.autoInsuranceSkipReason").value("DEFAULT_INSURANCE_ITEM_MISSING"));
    }

    @Test
    void templatePointingAtMissingInsuranceItemSkipsAutoIssuance() throws Exception {
        UUID templateId = seedSubscriptionTemplate("Subs Phantom Item", true, PHANTOM_INSURANCE_ITEM_ID);

        mockMvc.perform(post("/api/v1/rider-bike-contracts")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(contractBody(RIDER_ID, BIKE_ID, templateId, CONTRACT_START)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.autoInsuranceSkipReason").value("DEFAULT_INSURANCE_ITEM_NOT_FOUND"));
    }

    @Test
    void templatePointingAtDisabledItemSkipsAutoIssuance() throws Exception {
        UUID templateId = seedSubscriptionTemplate("Subs Disabled Item", true, DISABLED_INSURANCE_ITEM_ID);

        mockMvc.perform(post("/api/v1/rider-bike-contracts")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(contractBody(RIDER_ID, BIKE_ID, templateId, CONTRACT_START)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.autoInsuranceSkipReason").value("DEFAULT_INSURANCE_ITEM_DISABLED"));
    }

    @Test
    void templatePointingAtDeletedItemSkipsAutoIssuance() throws Exception {
        UUID templateId = seedSubscriptionTemplate("Subs Deleted Item", true, DELETED_INSURANCE_ITEM_ID);

        mockMvc.perform(post("/api/v1/rider-bike-contracts")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(contractBody(RIDER_ID, BIKE_ID, templateId, CONTRACT_START)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.autoInsuranceSkipReason").value("DEFAULT_INSURANCE_ITEM_DELETED"));
    }

    @Test
    void riderAlreadyLinkedToSameItemSkipsAutoIssuance() throws Exception {
        UUID templateId = seedSubscriptionTemplate("Subs Already Linked", true, INSURANCE_ITEM_ID);
        UUID existingLinkId = UUID.fromString("ffff1111-ffff-ffff-ffff-ffffffffffff");
        jdbcTemplate.update("""
                insert into rider_insurances (id, rider_id, insurance_item_id, enabled)
                values (?, ?, ?, true)
                """, existingLinkId, RIDER_ID, INSURANCE_ITEM_ID);

        MvcResult result = mockMvc.perform(post("/api/v1/rider-bike-contracts")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(contractBody(RIDER_ID, BIKE_ID, templateId, CONTRACT_START)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.autoIssuedRiderInsuranceId").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.autoInsuranceSkipReason").value("RIDER_INSURANCE_ALREADY_LINKED"))
                .andReturn();

        // Existing rider insurance row is the only active row; no second row
        // got inserted.
        Integer count = jdbcTemplate.queryForObject("""
                select count(*) from rider_insurances
                where rider_id = ? and insurance_item_id = ? and deleted_at is null
                """, Integer.class, RIDER_ID, INSURANCE_ITEM_ID);
        assertThat(count).isEqualTo(1);
        // And the contract was still created.
        UUID contractId = UUID.fromString(extractTextField(result, "id"));
        Integer contractCount = jdbcTemplate.queryForObject(
                "select count(*) from rider_bike_contracts where id = ?",
                Integer.class, contractId);
        assertThat(contractCount).isEqualTo(1);
    }

    private UUID seedSubscriptionTemplate(String name, boolean includesInsurance, UUID defaultInsuranceItemId) {
        UUID templateId = UUID.randomUUID();
        jdbcTemplate.update("""
                insert into contract_templates (
                    id, name, duration_minutes, description, enabled, system_template,
                    category, return_type, duration_unit, duration_value,
                    includes_insurance, default_insurance_item_id
                ) values (?, ?, ?, '계약 자동 보험 fixture', true, false,
                          'SUBSCRIPTION', 'TAKEOVER', 'MONTH', 12, ?, ?)
                """,
                templateId,
                name,
                12 * 30 * 1440,
                includesInsurance,
                defaultInsuranceItemId);
        return templateId;
    }

    private void seedRider(UUID id, String name, String phoneNumber) {
        jdbcTemplate.update("""
                insert into riders (id, name, phone_number, app_account_linked)
                values (?, ?, ?, false)
                """, id, name, phoneNumber);
    }

    private void seedBike(UUID id, String plateNumber, String vin) {
        jdbcTemplate.update("""
                insert into bikes (id, plate_number, vin, operation_status)
                values (?, ?, ?, 'READY')
                """, id, plateNumber, vin);
    }

    private void seedInsuranceItem(UUID id, String name, boolean enabled, boolean deleted) {
        jdbcTemplate.update("""
                insert into insurance_items (id, name, description, enabled, deleted_at)
                values (?, ?, '자동 발급 fixture', ?, %s)
                """.formatted(deleted ? "now()" : "null"), id, name, enabled);
    }

    private String contractBody(UUID riderId, UUID bikeId, UUID contractTemplateId, Instant startAt) {
        return """
                {
                  "riderId":"%s",
                  "bikeId":"%s",
                  "contractTemplateId":"%s",
                  "startAt":"%s"
                }
                """.formatted(riderId, bikeId, contractTemplateId, startAt);
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

    private String extractTextField(MvcResult result, String fieldName) throws Exception {
        Pattern pattern = Pattern.compile("\"" + fieldName + "\"\\s*:\\s*\"([^\"]+)\"");
        Matcher matcher = pattern.matcher(result.getResponse().getContentAsString());
        assertThat(matcher.find())
                .as("expected field %s in response: %s", fieldName, result.getResponse().getContentAsString())
                .isTrue();
        return matcher.group(1);
    }

    @SuppressWarnings("unused")
    private static List<String> noop() {
        return List.of();
    }
}
