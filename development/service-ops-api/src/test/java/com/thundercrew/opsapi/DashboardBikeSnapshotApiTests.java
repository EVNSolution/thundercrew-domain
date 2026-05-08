package com.thundercrew.opsapi;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
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
 * Slice ③-1: backend dashboard bike snapshot aggregate endpoint.
 * Verifies the four-query join + nullable contract / rider sections + active
 * insurance and equipment lists.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class DashboardBikeSnapshotApiTests extends PostgresContainerSupport {

    private static final UUID ADMIN_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final UUID RIDER_ID = UUID.fromString("bbbb1234-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private static final UUID BIKE_ID = UUID.fromString("cccc1234-cccc-cccc-cccc-cccccccccccc");
    private static final UUID OTHER_BIKE_ID = UUID.fromString("cccc5678-cccc-cccc-cccc-cccccccccccc");
    private static final UUID CONTRACT_TEMPLATE_ID = UUID.fromString("dddd1234-dddd-4000-8000-000000000001");
    private static final UUID CONTRACT_ID = UUID.fromString("dddd2222-dddd-4000-8000-000000000001");
    private static final UUID INSURANCE_ITEM_ID = UUID.fromString("22222222-2222-2222-2222-000000000001");
    private static final UUID RIDER_INSURANCE_ID = UUID.fromString("ffff1234-ffff-ffff-ffff-ffffffffffff");
    private static final UUID EQUIPMENT_TYPE_ID = UUID.fromString("eeee1234-eeee-eeee-eeee-eeeeeeeeeeee");
    private static final UUID BIKE_EQUIPMENT_ID = UUID.fromString("eeee5678-eeee-eeee-eeee-eeeeeeeeeeee");
    private static final UUID EDUCATION_RECORD_ID = UUID.fromString("eeed0001-eeed-eeed-eeed-eeeeeeeeeeee");
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
        jdbcTemplate.update("delete from rider_education_records");
        jdbcTemplate.update("delete from rider_insurances");
        jdbcTemplate.update("delete from rider_bike_contracts");
        jdbcTemplate.update("delete from bike_equipments");
        jdbcTemplate.update("delete from equipment_types");
        jdbcTemplate.update("delete from bike_current_states");
        jdbcTemplate.update("delete from bikes");
        jdbcTemplate.update("delete from riders");
        jdbcTemplate.update("delete from contract_templates where system_template = false");
        jdbcTemplate.update("delete from admin_users");
        jdbcTemplate.update("""
                insert into admin_users (id, login_id, email, password_hash, display_name, enabled)
                values (?, 'ops-admin', 'ops@example.test', ?, 'Ops Admin', true)
                """, ADMIN_ID, passwordEncoder.encode("correct-password"));
        accessToken = loginAndExtractToken();
    }

    @Test
    void fullSnapshotReturnsAllJoinedSections() throws Exception {
        Instant now = Instant.now();
        seedRider(RIDER_ID, "스냅샷 라이더", "010-7000-8000", "강남팀", "강남구");
        seedBike(BIKE_ID, "SNAP-001", "VIN-SNAP-001", "Thunder M1", "IN_SERVICE");
        seedSubscriptionTemplate(CONTRACT_TEMPLATE_ID, "Snap Template", true, INSURANCE_ITEM_ID);
        seedActiveContract(CONTRACT_ID, RIDER_ID, BIKE_ID, CONTRACT_TEMPLATE_ID, now.minus(7, ChronoUnit.DAYS));
        seedRiderInsurance(RIDER_INSURANCE_ID, RIDER_ID, INSURANCE_ITEM_ID,
                now.minus(7, ChronoUnit.DAYS), now.plus(358, ChronoUnit.DAYS), CONTRACT_ID);
        seedEquipmentType(EQUIPMENT_TYPE_ID, "헬멧");
        seedBikeEquipment(BIKE_EQUIPMENT_ID, BIKE_ID, EQUIPMENT_TYPE_ID, "메인 헬멧",
                "TC-Helmet-V2", "HELMET-SN-001", now.minus(30, ChronoUnit.DAYS));
        seedEducationRecord(EDUCATION_RECORD_ID, RIDER_ID, "ONLINE",
                now.minus(20, ChronoUnit.DAYS), now.plus(345, ChronoUnit.DAYS));

        mockMvc.perform(get("/api/v1/dashboard/bikes/{bikeId}/snapshot", BIKE_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bikeId").value(BIKE_ID.toString()))
                .andExpect(jsonPath("$.bike.plateNumber").value("SNAP-001"))
                .andExpect(jsonPath("$.bike.modelName").value("Thunder M1"))
                .andExpect(jsonPath("$.bike.operationStatus").value("IN_SERVICE"))
                .andExpect(jsonPath("$.activeContract.id").value(CONTRACT_ID.toString()))
                .andExpect(jsonPath("$.activeContract.contractTemplateId").value(CONTRACT_TEMPLATE_ID.toString()))
                .andExpect(jsonPath("$.activeContract.templateName").value("Snap Template"))
                .andExpect(jsonPath("$.activeContract.templateCategory").value("SUBSCRIPTION"))
                .andExpect(jsonPath("$.activeContract.templateReturnType").value("TAKEOVER"))
                .andExpect(jsonPath("$.activeContract.templateDurationUnit").value("MONTH"))
                .andExpect(jsonPath("$.activeContract.templateDurationValue").value(12))
                .andExpect(jsonPath("$.activeContract.templateIncludesInsurance").value(true))
                .andExpect(jsonPath("$.rider.id").value(RIDER_ID.toString()))
                .andExpect(jsonPath("$.rider.name").value("스냅샷 라이더"))
                .andExpect(jsonPath("$.rider.phoneNumber").value("010-7000-8000"))
                .andExpect(jsonPath("$.rider.teamName").value("강남팀"))
                .andExpect(jsonPath("$.rider.areaName").value("강남구"))
                .andExpect(jsonPath("$.rider.educationCompleted").value(true))
                .andExpect(jsonPath("$.rider.latestEducationType").value("ONLINE"))
                .andExpect(jsonPath("$.rider.educationExpired").value(false))
                .andExpect(jsonPath("$.insurances.length()").value(1))
                .andExpect(jsonPath("$.insurances[0].id").value(RIDER_INSURANCE_ID.toString()))
                .andExpect(jsonPath("$.insurances[0].insuranceItemId").value(INSURANCE_ITEM_ID.toString()))
                .andExpect(jsonPath("$.insurances[0].itemName").value("유상운송종합보험"))
                .andExpect(jsonPath("$.insurances[0].category").value("PRIMARY"))
                .andExpect(jsonPath("$.insurances[0].coverageType").value("GENERAL_PAID_TRANSPORT"))
                .andExpect(jsonPath("$.insurances[0].riderBikeContractId").value(CONTRACT_ID.toString()))
                .andExpect(jsonPath("$.equipments.length()").value(1))
                .andExpect(jsonPath("$.equipments[0].id").value(BIKE_EQUIPMENT_ID.toString()))
                .andExpect(jsonPath("$.equipments[0].typeName").value("헬멧"))
                .andExpect(jsonPath("$.equipments[0].equipmentLabel").value("메인 헬멧"))
                .andExpect(jsonPath("$.equipments[0].serialNumber").value("HELMET-SN-001"));
    }

    @Test
    void snapshotWithoutActiveContractHasNullContractAndRiderAndEmptyInsurances() throws Exception {
        seedBike(BIKE_ID, "SNAP-002", "VIN-SNAP-002", "Thunder M1", "READY");
        seedEquipmentType(EQUIPMENT_TYPE_ID, "잠금장치");
        seedBikeEquipment(BIKE_EQUIPMENT_ID, BIKE_ID, EQUIPMENT_TYPE_ID, "후륜 잠금",
                "TC-Lock-A1", "LOCK-SN-001", Instant.now().minus(10, ChronoUnit.DAYS));

        mockMvc.perform(get("/api/v1/dashboard/bikes/{bikeId}/snapshot", BIKE_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bike.plateNumber").value("SNAP-002"))
                .andExpect(jsonPath("$.activeContract").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.rider").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.insurances.length()").value(0))
                .andExpect(jsonPath("$.equipments.length()").value(1));
    }

    @Test
    void snapshotWithoutInsurancesReturnsEmptyList() throws Exception {
        Instant now = Instant.now();
        seedRider(RIDER_ID, "보험 없는 라이더", "010-7100-8000", null, null);
        seedBike(BIKE_ID, "SNAP-003", "VIN-SNAP-003", "Thunder M1", "IN_SERVICE");
        seedSubscriptionTemplate(CONTRACT_TEMPLATE_ID, "No Insurance Template", false, null);
        seedActiveContract(CONTRACT_ID, RIDER_ID, BIKE_ID, CONTRACT_TEMPLATE_ID, now.minus(1, ChronoUnit.DAYS));

        mockMvc.perform(get("/api/v1/dashboard/bikes/{bikeId}/snapshot", BIKE_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activeContract.id").value(CONTRACT_ID.toString()))
                .andExpect(jsonPath("$.rider.id").value(RIDER_ID.toString()))
                .andExpect(jsonPath("$.insurances.length()").value(0))
                .andExpect(jsonPath("$.equipments.length()").value(0));
    }

    @Test
    void snapshotIgnoresRemovedEquipmentsAndDisabledInsurances() throws Exception {
        Instant now = Instant.now();
        seedRider(RIDER_ID, "필터 라이더", "010-7200-8000", null, null);
        seedBike(BIKE_ID, "SNAP-004", "VIN-SNAP-004", "Thunder M1", "IN_SERVICE");
        seedSubscriptionTemplate(CONTRACT_TEMPLATE_ID, "Filter Template", true, INSURANCE_ITEM_ID);
        seedActiveContract(CONTRACT_ID, RIDER_ID, BIKE_ID, CONTRACT_TEMPLATE_ID, now.minus(2, ChronoUnit.DAYS));

        // Disabled rider_insurance should not appear.
        seedRiderInsuranceWithEnabled(RIDER_INSURANCE_ID, RIDER_ID, INSURANCE_ITEM_ID,
                now.minus(2, ChronoUnit.DAYS), null, CONTRACT_ID, false);

        // Removed bike_equipment should not appear.
        seedEquipmentType(EQUIPMENT_TYPE_ID, "리어캐리어");
        UUID removedEquipmentId = UUID.fromString("eeee9999-eeee-eeee-eeee-eeeeeeeeeeee");
        seedRemovedBikeEquipment(removedEquipmentId, BIKE_ID, EQUIPMENT_TYPE_ID, "분리된 캐리어",
                now.minus(60, ChronoUnit.DAYS), now.minus(10, ChronoUnit.DAYS));

        mockMvc.perform(get("/api/v1/dashboard/bikes/{bikeId}/snapshot", BIKE_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.insurances.length()").value(0))
                .andExpect(jsonPath("$.equipments.length()").value(0));
    }

    @Test
    void unknownBikeReturnsNotFound() throws Exception {
        UUID missing = UUID.fromString("ffff9999-9999-9999-9999-999999999999");
        mockMvc.perform(get("/api/v1/dashboard/bikes/{bikeId}/snapshot", missing)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"));
    }

    @Test
    void snapshotRequiresAuthentication() throws Exception {
        seedBike(BIKE_ID, "SNAP-AUTH", "VIN-SNAP-AUTH", "Thunder M1", "READY");

        mockMvc.perform(get("/api/v1/dashboard/bikes/{bikeId}/snapshot", BIKE_ID))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_FAILED"));
    }

    @Test
    void educationSummaryReportsExpiredWhenLatestRecordExpired() throws Exception {
        Instant now = Instant.now();
        seedRider(RIDER_ID, "만료 라이더", "010-7300-8000", null, null);
        seedBike(BIKE_ID, "SNAP-EXP", "VIN-SNAP-EXP", "Thunder M1", "IN_SERVICE");
        seedSubscriptionTemplate(CONTRACT_TEMPLATE_ID, "Expired Education Template", false, null);
        seedActiveContract(CONTRACT_ID, RIDER_ID, BIKE_ID, CONTRACT_TEMPLATE_ID, now.minus(3, ChronoUnit.DAYS));
        seedEducationRecord(EDUCATION_RECORD_ID, RIDER_ID, "OFFLINE",
                now.minus(400, ChronoUnit.DAYS), now.minus(35, ChronoUnit.DAYS));

        mockMvc.perform(get("/api/v1/dashboard/bikes/{bikeId}/snapshot", BIKE_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rider.educationCompleted").value(true))
                .andExpect(jsonPath("$.rider.latestEducationType").value("OFFLINE"))
                .andExpect(jsonPath("$.rider.educationExpired").value(true));
    }

    private void seedRider(UUID id, String name, String phoneNumber, String teamName, String areaName) {
        jdbcTemplate.update("""
                insert into riders (id, name, phone_number, team_name, area_name, app_account_linked)
                values (?, ?, ?, ?, ?, false)
                """, id, name, phoneNumber, teamName, areaName);
    }

    private void seedBike(UUID id, String plateNumber, String vin, String modelName, String operationStatus) {
        jdbcTemplate.update("""
                insert into bikes (id, plate_number, vin, model_name, operation_status)
                values (?, ?, ?, ?, ?)
                """, id, plateNumber, vin, modelName, operationStatus);
    }

    private void seedSubscriptionTemplate(UUID id, String name, boolean includesInsurance, UUID defaultInsuranceItemId) {
        jdbcTemplate.update("""
                insert into contract_templates (
                    id, name, duration_minutes, description, enabled, system_template,
                    category, return_type, duration_unit, duration_value,
                    includes_insurance, default_insurance_item_id
                ) values (?, ?, ?, 'snapshot fixture template', true, false,
                          'SUBSCRIPTION', 'TAKEOVER', 'MONTH', 12, ?, ?)
                """, id, name, 12 * 30 * 1440, includesInsurance, defaultInsuranceItemId);
    }

    private void seedActiveContract(UUID id, UUID riderId, UUID bikeId, UUID templateId, Instant startAt) {
        jdbcTemplate.update("""
                insert into rider_bike_contracts (id, rider_id, bike_id, contract_template_id, start_at)
                values (?, ?, ?, ?, ?::timestamptz)
                """, id, riderId, bikeId, templateId, startAt.toString());
    }

    private void seedRiderInsurance(
            UUID id, UUID riderId, UUID insuranceItemId,
            Instant startsAt, Instant endsAt, UUID riderBikeContractId
    ) {
        seedRiderInsuranceWithEnabled(id, riderId, insuranceItemId, startsAt, endsAt, riderBikeContractId, true);
    }

    private void seedRiderInsuranceWithEnabled(
            UUID id, UUID riderId, UUID insuranceItemId,
            Instant startsAt, Instant endsAt, UUID riderBikeContractId, boolean enabled
    ) {
        jdbcTemplate.update("""
                insert into rider_insurances (
                    id, rider_id, insurance_item_id, enabled, starts_at, ends_at, rider_bike_contract_id, memo
                ) values (?, ?, ?, ?, ?::timestamptz, ?::timestamptz, ?, 'snapshot fixture insurance')
                """,
                id, riderId, insuranceItemId, enabled,
                startsAt == null ? null : startsAt.toString(),
                endsAt == null ? null : endsAt.toString(),
                riderBikeContractId);
    }

    private void seedEquipmentType(UUID id, String name) {
        jdbcTemplate.update("""
                insert into equipment_types (id, name)
                values (?, ?)
                on conflict (id) do nothing
                """, id, name);
    }

    private void seedBikeEquipment(
            UUID id, UUID bikeId, UUID equipmentTypeId,
            String label, String modelName, String serialNumber, Instant installedAt
    ) {
        jdbcTemplate.update("""
                insert into bike_equipments (
                    id, bike_id, equipment_type_id, equipment_label, model_name, serial_number,
                    installed_at, management_due_date, memo
                ) values (?, ?, ?, ?, ?, ?, ?::timestamptz, current_date + interval '1 year',
                          'snapshot fixture equipment')
                """, id, bikeId, equipmentTypeId, label, modelName, serialNumber, installedAt.toString());
    }

    private void seedRemovedBikeEquipment(
            UUID id, UUID bikeId, UUID equipmentTypeId, String label,
            Instant installedAt, Instant removedAt
    ) {
        jdbcTemplate.update("""
                insert into bike_equipments (
                    id, bike_id, equipment_type_id, equipment_label,
                    installed_at, removed_at, management_due_date, memo
                ) values (?, ?, ?, ?, ?::timestamptz, ?::timestamptz, current_date,
                          'snapshot removed equipment')
                """, id, bikeId, equipmentTypeId, label, installedAt.toString(), removedAt.toString());
    }

    private void seedEducationRecord(
            UUID id, UUID riderId, String type, Instant completedAt, Instant expiresAt
    ) {
        jdbcTemplate.update("""
                insert into rider_education_records (
                    id, rider_id, education_type, completed_at, expires_at
                ) values (?, ?, ?, ?::timestamptz, ?::timestamptz)
                """,
                id, riderId, type,
                completedAt.toString(),
                expiresAt == null ? null : expiresAt.toString());
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

    @SuppressWarnings("unused")
    private void unusedReferenceToOtherBike() {
        UUID ignored = OTHER_BIKE_ID;
        ignored.toString();
    }
}
