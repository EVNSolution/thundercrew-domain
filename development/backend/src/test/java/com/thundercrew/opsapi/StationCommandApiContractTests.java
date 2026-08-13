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
class StationCommandApiContractTests extends PostgresContainerSupport {

    private static final UUID ADMIN_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final UUID STATION_ID = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private static final UUID OTHER_STATION_ID = UUID.fromString("cccccccc-cccc-cccc-cccc-cccccccccccc");
    private static final UUID COUNT_LOG_ID = UUID.fromString("dddddddd-dddd-dddd-dddd-dddddddddddd");
    private static final Pattern ACCESS_TOKEN_PATTERN = Pattern.compile("\\\"accessToken\\\"\\s*:\\s*\\\"([^\\\"]+)\\\"");

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
        jdbcTemplate.update("delete from station_battery_count_logs");
        jdbcTemplate.update("delete from battery_stations");
        jdbcTemplate.update("delete from admin_users");
        jdbcTemplate.update("""
                insert into admin_users (id, login_id, email, password_hash, display_name, enabled)
                values (?, 'ops-admin', 'ops@example.test', ?, 'Ops Admin', true)
                """, ADMIN_ID, passwordEncoder.encode("correct-password"));
        accessToken = loginAndExtractToken();
    }

    @Test
    void createStationGeneratesIdentifiersAndIgnoresClientSuppliedSystemAndLogFields() throws Exception {
        String clientSuppliedId = "99999999-9999-9999-9999-999999999999";

        MvcResult result = mockMvc.perform(post("/api/v1/battery-stations")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "id":"%s",
                                  "idx":999,
                                  "name":"서울 강남 스테이션",
                                  "address":"서울 강남구 테헤란로 1",
                                  "latitude":37.5665000,
                                  "longitude":126.9780000,
                                  "status":"ACTIVE",
                                  "maxBatteryCapacity":8,
                                  "currentBatteryCount":6,
                                  "availableBatteryCount":3,
                                  "availableBatteryLabel":"999/999",
                                  "capacityPercentage":999,
                                  "memo":"지도 핀 기준",
                                  "stationBatteryCountLogId":"11111111-1111-1111-1111-111111111111",
                                  "deletedAt":"2026-01-01T00:00:00Z"
                                }
                                """.formatted(clientSuppliedId)))
                .andExpect(status().isCreated())
                .andExpect(header().string(HttpHeaders.LOCATION, org.hamcrest.Matchers.startsWith("/api/v1/battery-stations/")))
                .andExpect(jsonPath("$.id").isString())
                .andExpect(jsonPath("$.id").value(org.hamcrest.Matchers.not(clientSuppliedId)))
                .andExpect(jsonPath("$.idx").isNumber())
                .andExpect(jsonPath("$.name").value("서울 강남 스테이션"))
                .andExpect(jsonPath("$.address").value("서울 강남구 테헤란로 1"))
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.maxBatteryCapacity").value(8))
                .andExpect(jsonPath("$.currentBatteryCount").value(6))
                .andExpect(jsonPath("$.availableBatteryCount").value(3))
                .andExpect(jsonPath("$.availableBatteryLabel").value("3/8"))
                .andExpect(jsonPath("$.capacityPercentage").value(75))
                .andExpect(jsonPath("$.memo").value("지도 핀 기준"))
                .andReturn();

        String createdId = extractId(result);
        mockMvc.perform(get("/api/v1/battery-stations/{id}", createdId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("서울 강남 스테이션"));

        Integer logCount = jdbcTemplate.queryForObject("select count(*) from station_battery_count_logs", Integer.class);
        assertThat(logCount).isZero();
    }

    @Test
    void createStationRejectsMissingHumanRequiredFieldsAndInvalidCounts() throws Exception {
        mockMvc.perform(post("/api/v1/battery-stations")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"","address":"","status":"ACTIVE"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldViolations").isArray());

        mockMvc.perform(post("/api/v1/battery-stations")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name":"잘못된 스테이션",
                                  "address":"서울 중구 세종대로 1",
                                  "latitude":37.5665000,
                                  "longitude":126.9780000,
                                  "status":"ACTIVE",
                                  "maxBatteryCapacity":5,
                                  "currentBatteryCount":6,
                                  "availableBatteryCount":2
                                }
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVALID_STATE_TRANSITION"));
    }

    @Test
    /**
     * 중복 판정 기준은 **주소**다. 이름은 중복돼도 된다.
     *
     * 전에는 이름이 유니크였지만 V17 이 `ux_battery_stations_name_active` 를 지우고
     * 주소 유니크로 바꿨다(V17__switch_battery_stations_unique_to_address). 서비스도
     * `DuplicateActiveResourceException("BatteryStation", "address")` 를 던진다.
     * 이 테스트는 이름 기준이던 옛 계약에 멈춰 있었다.
     */
    void createStationRejectsDuplicateActiveAddress() throws Exception {
        seedStation(STATION_ID, "강남 스테이션", "ACTIVE", 10, 7, 4, null);

        mockMvc.perform(post("/api/v1/battery-stations")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name":"이름은 달라도 된다",
                                  "address":"서울 테스트로 %s",
                                  "latitude":37.5000000,
                                  "longitude":127.0300000,
                                  "status":"ACTIVE",
                                  "maxBatteryCapacity":10,
                                  "currentBatteryCount":5,
                                  "availableBatteryCount":2
                                }
                                """.formatted(STATION_ID)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DUPLICATE_ACTIVE_RESOURCE"));
    }

    @Test
    void updateStationChangesOnlyOperatorManagedFieldsAndIgnoresCountFields() throws Exception {
        seedStation(STATION_ID, "수정 전 스테이션", "ACTIVE", 10, 7, 4, null);

        mockMvc.perform(patch("/api/v1/battery-stations/{id}", STATION_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "id":"99999999-9999-9999-9999-999999999999",
                                  "idx":999,
                                  "name":"수정 후 스테이션",
                                  "address":"서울 마포구 월드컵북로 1",
                                  "latitude":37.5500000,
                                  "longitude":126.9100000,
                                  "status":"MAINTENANCE",
                                  "maxBatteryCapacity":99,
                                  "currentBatteryCount":88,
                                  "availableBatteryCount":77,
                                  "memo":"운영자 정보 수정"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(STATION_ID.toString()))
                .andExpect(jsonPath("$.name").value("수정 후 스테이션"))
                .andExpect(jsonPath("$.address").value("서울 마포구 월드컵북로 1"))
                .andExpect(jsonPath("$.status").value("MAINTENANCE"))
                .andExpect(jsonPath("$.maxBatteryCapacity").value(10))
                .andExpect(jsonPath("$.currentBatteryCount").value(7))
                .andExpect(jsonPath("$.availableBatteryCount").value(4))
                .andExpect(jsonPath("$.memo").value("운영자 정보 수정"));
    }

    @Test
    void updateStationRejectsMissingOrDuplicateTargets() throws Exception {
        seedStation(STATION_ID, "강남 스테이션", "ACTIVE", 10, 7, 4, null);
        seedStation(OTHER_STATION_ID, "마포 스테이션", "ACTIVE", 12, 8, 3, null);

        UUID missingId = UUID.fromString("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee");
        mockMvc.perform(patch("/api/v1/battery-stations/{id}", missingId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"없는 스테이션"}
                                """))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"));

        mockMvc.perform(patch("/api/v1/battery-stations/{id}", STATION_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"마포 스테이션"}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DUPLICATE_ACTIVE_RESOURCE"));
    }

    @Test
    void updateBatteryCountsChangesStationAndWritesHistoryLog() throws Exception {
        seedStation(STATION_ID, "강남 스테이션", "ACTIVE", 10, 6, 3, null);

        mockMvc.perform(patch("/api/v1/battery-stations/{id}/battery-counts", STATION_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "maxBatteryCapacity":12,
                                  "currentBatteryCount":7,
                                  "availableBatteryCount":5,
                                  "reason":"현장 재고 조정",
                                  "memo":"오전 실사 반영",
                                  "changedAt":"2026-04-30T01:02:03Z",
                                  "id":"99999999-9999-9999-9999-999999999999"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(STATION_ID.toString()))
                .andExpect(jsonPath("$.maxBatteryCapacity").value(12))
                .andExpect(jsonPath("$.currentBatteryCount").value(7))
                .andExpect(jsonPath("$.availableBatteryCount").value(5))
                .andExpect(jsonPath("$.availableBatteryLabel").value("5/12"))
                .andExpect(jsonPath("$.capacityPercentage").value(58));

        mockMvc.perform(get("/api/v1/station-battery-count-logs")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].stationId").value(STATION_ID.toString()))
                .andExpect(jsonPath("$.items[0].beforeMaxBatteryCapacity").value(10))
                .andExpect(jsonPath("$.items[0].afterMaxBatteryCapacity").value(12))
                .andExpect(jsonPath("$.items[0].beforeCurrentBatteryCount").value(6))
                .andExpect(jsonPath("$.items[0].afterCurrentBatteryCount").value(7))
                .andExpect(jsonPath("$.items[0].beforeAvailableBatteryCount").value(3))
                .andExpect(jsonPath("$.items[0].afterAvailableBatteryCount").value(5))
                .andExpect(jsonPath("$.items[0].reason").value("현장 재고 조정"))
                .andExpect(jsonPath("$.items[0].memo").value("오전 실사 반영"))
                .andExpect(jsonPath("$.items[0].changedAt").isString())
                .andExpect(jsonPath("$.items[0].changedAt").value(org.hamcrest.Matchers.not("2026-04-30T01:02:03Z")));
    }

    @Test
    void updateBatteryCountsRejectsMissingStationsAndInvalidCountInvariants() throws Exception {
        seedStation(STATION_ID, "강남 스테이션", "ACTIVE", 10, 6, 3, null);
        UUID missingId = UUID.fromString("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee");

        mockMvc.perform(patch("/api/v1/battery-stations/{id}/battery-counts", missingId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"maxBatteryCapacity":12,"currentBatteryCount":7,"availableBatteryCount":5}
                                """))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"));

        mockMvc.perform(patch("/api/v1/battery-stations/{id}/battery-counts", STATION_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"maxBatteryCapacity":12,"currentBatteryCount":7,"availableBatteryCount":8}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVALID_STATE_TRANSITION"));
    }

    @Test
    void deleteStationSoftDeletesAllowsNameReuseAndPreservesCountLogHistory() throws Exception {
        seedStation(STATION_ID, "삭제 대상 스테이션", "ACTIVE", 10, 6, 3, null);
        seedCountLog(COUNT_LOG_ID, STATION_ID);

        mockMvc.perform(delete("/api/v1/battery-stations/{id}", STATION_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isNoContent());

        String status = jdbcTemplate.queryForObject(
                "select status from battery_stations where id = ?",
                String.class,
                STATION_ID
        );
        assertThat(status).isEqualTo("INACTIVE");

        mockMvc.perform(get("/api/v1/battery-stations/{id}", STATION_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/v1/station-battery-count-logs/{id}", COUNT_LOG_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.stationId").value(STATION_ID.toString()));

        mockMvc.perform(post("/api/v1/battery-stations")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name":"삭제 대상 스테이션",
                                  "address":"서울 용산구 한강대로 1",
                                  "latitude":37.5290000,
                                  "longitude":126.9640000,
                                  "status":"ACTIVE",
                                  "maxBatteryCapacity":10,
                                  "currentBatteryCount":5,
                                  "availableBatteryCount":2
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("삭제 대상 스테이션"));
    }

    @Test
    void commandRequestsRequireBearerAuthentication() throws Exception {
        mockMvc.perform(post("/api/v1/battery-stations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"무권한","address":"서울","latitude":37.0,"longitude":127.0,"status":"ACTIVE","maxBatteryCapacity":1,"currentBatteryCount":1,"availableBatteryCount":1}
                                """))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_FAILED"));

        mockMvc.perform(patch("/api/v1/battery-stations/{id}", STATION_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"memo":"NoAuth"}
                                """))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_FAILED"));

        mockMvc.perform(patch("/api/v1/battery-stations/{id}/battery-counts", STATION_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"maxBatteryCapacity":1,"currentBatteryCount":1,"availableBatteryCount":1}
                                """))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_FAILED"));

        mockMvc.perform(delete("/api/v1/battery-stations/{id}", STATION_ID))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_FAILED"));
    }

    private void seedStation(
            UUID id,
            String name,
            String status,
            int maxBatteryCapacity,
            int currentBatteryCount,
            int availableBatteryCount,
            String deletedAtSql
    ) {
        // 주소를 id 로 유일하게 만든다. V17 이후 주소가 유니크 키(활성 행 대상)라서
        // 모든 시드가 같은 주소를 쓰면 두 번째 시드가 DuplicateKeyException 으로 죽는다.
        String deletedAtExpression = deletedAtSql == null ? "null" : deletedAtSql;
        jdbcTemplate.update("""
                insert into battery_stations (
                    id, name, address, latitude, longitude, status,
                    max_battery_capacity, current_battery_count, available_battery_count,
                    memo, deleted_at
                ) values (?, ?, '서울 테스트로 ' || ?::text, 37.5010000, 127.0396000, ?, ?, ?, ?, 'fixture station', %s)
                """.formatted(deletedAtExpression), id, name, id, status, maxBatteryCapacity, currentBatteryCount, availableBatteryCount);
    }

    private void seedCountLog(UUID id, UUID stationId) {
        jdbcTemplate.update("""
                insert into station_battery_count_logs (
                    id, station_id,
                    before_max_battery_capacity, after_max_battery_capacity,
                    before_current_battery_count, after_current_battery_count,
                    before_available_battery_count, after_available_battery_count,
                    reason, memo, changed_at
                ) values (?, ?, 10, 10, 4, 6, 2, 3, 'fixture count', 'fixture memo', '2026-04-30T00:00:00Z')
                """, id, stationId);
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
        Matcher matcher = Pattern.compile("\\\"id\\\"\\s*:\\s*\\\"([^\\\"]+)\\\"")
                .matcher(result.getResponse().getContentAsString());
        assertThat(matcher.find()).isTrue();
        return matcher.group(1);
    }
}
