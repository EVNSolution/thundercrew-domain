# Cleaning Schedule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자가 클리닝 차량에 일정(날짜·시간·주소)을 등록하고 "콜 발송" 시 헤더 벨 알림으로 시뮬레이션 확인하는 기능 추가.

**Architecture:** 백엔드에 `cleaning_schedules` 테이블(UUID PK, V26 Flyway migration)과 POST/GET 엔드포인트 2개를 추가한다. 프론트엔드에서 차량 탭 CLEANING 필터 활성 시 우측에 일정 패널을 노출하고, 콜 발송 성공 시 NotificationContext(React state)를 통해 헤더 벨 뱃지를 즉각 업데이트한다. 실제 차량 앱 없이 시뮬레이션.

**Tech Stack:** Java 17, Spring Boot, JPA, Flyway (service-ops-api) / Next.js 14 App Router, TypeScript, React (front-admin-web)

---

## File Map

**Create (backend):**
- `development/service-ops-api/src/main/resources/db/migration/V26__add_cleaning_schedules.sql`
- `development/service-ops-api/src/main/java/com/thundercrew/opsapi/cleaningschedule/domain/CleaningSchedule.java`
- `development/service-ops-api/src/main/java/com/thundercrew/opsapi/cleaningschedule/domain/CleaningScheduleRepository.java`
- `development/service-ops-api/src/main/java/com/thundercrew/opsapi/cleaningschedule/dto/CleaningScheduleCreateRequest.java`
- `development/service-ops-api/src/main/java/com/thundercrew/opsapi/cleaningschedule/dto/CleaningScheduleReadResponse.java`
- `development/service-ops-api/src/main/java/com/thundercrew/opsapi/cleaningschedule/service/CleaningScheduleCommandService.java`
- `development/service-ops-api/src/main/java/com/thundercrew/opsapi/cleaningschedule/service/CleaningScheduleQueryService.java`
- `development/service-ops-api/src/main/java/com/thundercrew/opsapi/cleaningschedule/CleaningScheduleCommandController.java`
- `development/service-ops-api/src/main/java/com/thundercrew/opsapi/cleaningschedule/CleaningScheduleReadController.java`
- `development/service-ops-api/src/test/java/com/thundercrew/opsapi/CleaningScheduleApiContractTests.java`

**Create (frontend):**
- `development/front-admin-web/lib/services/cleaning-schedule-api.ts`
- `development/front-admin-web/components/layout/NotificationContext.tsx`
- `development/front-admin-web/components/layout/NotificationBell.tsx`
- `development/front-admin-web/components/management/CleaningSchedulePanel.tsx`

**Modify (frontend):**
- `development/front-admin-web/components/management/VehiclesPanel.tsx`
- `development/front-admin-web/app/page.tsx`
- `development/front-admin-web/app/globals.css`

---

## Task 1: V26 DB 마이그레이션 + CleaningSchedule 엔티티

**Files:**
- Create: `development/service-ops-api/src/main/resources/db/migration/V26__add_cleaning_schedules.sql`
- Create: `development/service-ops-api/src/main/java/com/thundercrew/opsapi/cleaningschedule/domain/CleaningSchedule.java`

**참고:** `AuditableEntity`는 `UUID id = UUID.randomUUID()`을 자동 생성하고 `@PrePersist/@PreUpdate`로 `createdAt/updatedAt(Instant)` 를 세팅한다. `VehicleMaintenanceRecord`처럼 bike 를 FK 관계가 아닌 `UUID bikeId` 컬럼으로 저장한다.

- [ ] **Step 1: 마이그레이션 파일 작성**

```sql
-- development/service-ops-api/src/main/resources/db/migration/V26__add_cleaning_schedules.sql
create table cleaning_schedules (
    id           uuid primary key default gen_random_uuid(),
    bike_id      uuid not null,
    scheduled_at timestamp not null,
    address      varchar(255) not null,
    memo         varchar(500),
    created_at   timestamp not null,
    updated_at   timestamp not null,
    created_by   uuid,
    updated_by   uuid
);

create index ix_cleaning_schedules_bike_id
    on cleaning_schedules(bike_id);

create index ix_cleaning_schedules_scheduled_at
    on cleaning_schedules(scheduled_at);
```

- [ ] **Step 2: CleaningSchedule 엔티티 작성**

```java
// development/service-ops-api/src/main/java/com/thundercrew/opsapi/cleaningschedule/domain/CleaningSchedule.java
package com.thundercrew.opsapi.cleaningschedule.domain;

import com.thundercrew.opsapi.common.domain.AuditableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "cleaning_schedules")
public class CleaningSchedule extends AuditableEntity {

    @Column(name = "bike_id", nullable = false, updatable = false)
    private UUID bikeId;

    @Column(name = "scheduled_at", nullable = false)
    private LocalDateTime scheduledAt;

    @Column(name = "address", nullable = false, length = 255)
    private String address;

    @Column(name = "memo", length = 500)
    private String memo;

    protected CleaningSchedule() {}

    public static CleaningSchedule create(UUID bikeId, LocalDateTime scheduledAt, String address, String memo) {
        CleaningSchedule s = new CleaningSchedule();
        s.bikeId = bikeId;
        s.scheduledAt = scheduledAt;
        s.address = address;
        s.memo = memo;
        return s;
    }

    public UUID getBikeId() { return bikeId; }
    public LocalDateTime getScheduledAt() { return scheduledAt; }
    public String getAddress() { return address; }
    public String getMemo() { return memo; }
}
```

- [ ] **Step 3: 커밋**

```bash
cd development/service-ops-api
git add src/main/resources/db/migration/V26__add_cleaning_schedules.sql \
        src/main/java/com/thundercrew/opsapi/cleaningschedule/domain/CleaningSchedule.java
git commit -m "feat(cleaning-schedule): V26 migration + CleaningSchedule entity

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Repository + DTOs

**Files:**
- Create: `development/service-ops-api/src/main/java/com/thundercrew/opsapi/cleaningschedule/domain/CleaningScheduleRepository.java`
- Create: `development/service-ops-api/src/main/java/com/thundercrew/opsapi/cleaningschedule/dto/CleaningScheduleCreateRequest.java`
- Create: `development/service-ops-api/src/main/java/com/thundercrew/opsapi/cleaningschedule/dto/CleaningScheduleReadResponse.java`

- [ ] **Step 1: Repository 작성**

```java
// development/service-ops-api/src/main/java/com/thundercrew/opsapi/cleaningschedule/domain/CleaningScheduleRepository.java
package com.thundercrew.opsapi.cleaningschedule.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface CleaningScheduleRepository extends JpaRepository<CleaningSchedule, UUID> {
    List<CleaningSchedule> findByBikeIdOrderByScheduledAtAsc(UUID bikeId);
    List<CleaningSchedule> findAllByOrderByScheduledAtAsc();
}
```

- [ ] **Step 2: CreateRequest DTO 작성**

`bikeId`는 UUID를 문자열로 받는다 (JSON: `"bikeId": "bbbbbbbb-bbbb-..."`).

```java
// development/service-ops-api/src/main/java/com/thundercrew/opsapi/cleaningschedule/dto/CleaningScheduleCreateRequest.java
package com.thundercrew.opsapi.cleaningschedule.dto;

import java.time.LocalDateTime;

public record CleaningScheduleCreateRequest(
    String bikeId,           // UUID 문자열
    LocalDateTime scheduledAt, // ISO-8601: "2026-06-01T10:00:00"
    String address,
    String memo              // nullable
) {}
```

- [ ] **Step 3: ReadResponse DTO 작성**

```java
// development/service-ops-api/src/main/java/com/thundercrew/opsapi/cleaningschedule/dto/CleaningScheduleReadResponse.java
package com.thundercrew.opsapi.cleaningschedule.dto;

import com.thundercrew.opsapi.cleaningschedule.domain.CleaningSchedule;
import java.time.LocalDateTime;

public record CleaningScheduleReadResponse(
    String id,
    String bikeId,
    String bikePlateNumber,
    LocalDateTime scheduledAt,
    String address,
    String memo
) {
    public static CleaningScheduleReadResponse of(CleaningSchedule s, String bikePlateNumber) {
        return new CleaningScheduleReadResponse(
            s.getId().toString(),
            s.getBikeId().toString(),
            bikePlateNumber,
            s.getScheduledAt(),
            s.getAddress(),
            s.getMemo()
        );
    }
}
```

- [ ] **Step 4: 커밋**

```bash
git add src/main/java/com/thundercrew/opsapi/cleaningschedule/domain/CleaningScheduleRepository.java \
        src/main/java/com/thundercrew/opsapi/cleaningschedule/dto/CleaningScheduleCreateRequest.java \
        src/main/java/com/thundercrew/opsapi/cleaningschedule/dto/CleaningScheduleReadResponse.java
git commit -m "feat(cleaning-schedule): repository + DTOs

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: 서비스 레이어

**Files:**
- Create: `development/service-ops-api/src/main/java/com/thundercrew/opsapi/cleaningschedule/service/CleaningScheduleCommandService.java`
- Create: `development/service-ops-api/src/main/java/com/thundercrew/opsapi/cleaningschedule/service/CleaningScheduleQueryService.java`

**참고:** `BikeRepository`는 `com.thundercrew.opsapi.bike.domain.BikeRepository`에 있다. `Bike.getServiceType()`은 `BikeServiceType` enum 을 반환한다. `BikeServiceType.CLEANING` 이 아닌 차량에 일정을 등록하면 `IllegalArgumentException`.

- [ ] **Step 1: CommandService 작성**

```java
// development/service-ops-api/src/main/java/com/thundercrew/opsapi/cleaningschedule/service/CleaningScheduleCommandService.java
package com.thundercrew.opsapi.cleaningschedule.service;

import com.thundercrew.opsapi.bike.domain.Bike;
import com.thundercrew.opsapi.bike.domain.BikeRepository;
import com.thundercrew.opsapi.bike.domain.BikeServiceType;
import com.thundercrew.opsapi.cleaningschedule.domain.CleaningSchedule;
import com.thundercrew.opsapi.cleaningschedule.domain.CleaningScheduleRepository;
import com.thundercrew.opsapi.cleaningschedule.dto.CleaningScheduleCreateRequest;
import com.thundercrew.opsapi.cleaningschedule.dto.CleaningScheduleReadResponse;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.UUID;

@Service
@Transactional
public class CleaningScheduleCommandService {

    private final CleaningScheduleRepository scheduleRepo;
    private final BikeRepository bikeRepo;

    public CleaningScheduleCommandService(CleaningScheduleRepository scheduleRepo, BikeRepository bikeRepo) {
        this.scheduleRepo = scheduleRepo;
        this.bikeRepo = bikeRepo;
    }

    public CleaningScheduleReadResponse create(CleaningScheduleCreateRequest request) {
        UUID bikeUuid = UUID.fromString(request.bikeId());
        Bike bike = bikeRepo.findById(bikeUuid)
            .orElseThrow(() -> new EntityNotFoundException("Bike not found: " + request.bikeId()));
        if (bike.getServiceType() != BikeServiceType.CLEANING) {
            throw new IllegalArgumentException("Bike is not a CLEANING service type: " + request.bikeId());
        }
        CleaningSchedule schedule = CleaningSchedule.create(
            bikeUuid, request.scheduledAt(), request.address(), request.memo()
        );
        CleaningSchedule saved = scheduleRepo.save(schedule);
        return CleaningScheduleReadResponse.of(saved, bike.getPlateNumber());
    }
}
```

- [ ] **Step 2: QueryService 작성**

```java
// development/service-ops-api/src/main/java/com/thundercrew/opsapi/cleaningschedule/service/CleaningScheduleQueryService.java
package com.thundercrew.opsapi.cleaningschedule.service;

import com.thundercrew.opsapi.bike.domain.Bike;
import com.thundercrew.opsapi.bike.domain.BikeRepository;
import com.thundercrew.opsapi.cleaningschedule.domain.CleaningSchedule;
import com.thundercrew.opsapi.cleaningschedule.domain.CleaningScheduleRepository;
import com.thundercrew.opsapi.cleaningschedule.dto.CleaningScheduleReadResponse;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class CleaningScheduleQueryService {

    private final CleaningScheduleRepository scheduleRepo;
    private final BikeRepository bikeRepo;

    public CleaningScheduleQueryService(CleaningScheduleRepository scheduleRepo, BikeRepository bikeRepo) {
        this.scheduleRepo = scheduleRepo;
        this.bikeRepo = bikeRepo;
    }

    public List<CleaningScheduleReadResponse> findByBikeId(String bikeIdStr) {
        UUID bikeUuid = UUID.fromString(bikeIdStr);
        Bike bike = bikeRepo.findById(bikeUuid)
            .orElseThrow(() -> new EntityNotFoundException("Bike not found: " + bikeIdStr));
        return scheduleRepo.findByBikeIdOrderByScheduledAtAsc(bikeUuid).stream()
            .map(s -> CleaningScheduleReadResponse.of(s, bike.getPlateNumber()))
            .toList();
    }

    public List<CleaningScheduleReadResponse> findAll() {
        // bikeId → plateNumber 인덱스 한 번 구성 후 매핑 (N+1 방지)
        List<CleaningSchedule> schedules = scheduleRepo.findAllByOrderByScheduledAtAsc();
        java.util.Map<UUID, String> plateByBikeId = new java.util.HashMap<>();
        for (CleaningSchedule s : schedules) {
            plateByBikeId.computeIfAbsent(s.getBikeId(), id ->
                bikeRepo.findById(id).map(Bike::getPlateNumber).orElse(""));
        }
        return schedules.stream()
            .map(s -> CleaningScheduleReadResponse.of(s, plateByBikeId.getOrDefault(s.getBikeId(), "")))
            .toList();
    }
}
```

- [ ] **Step 3: 커밋**

```bash
git add src/main/java/com/thundercrew/opsapi/cleaningschedule/service/
git commit -m "feat(cleaning-schedule): command + query services

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: REST 컨트롤러

**Files:**
- Create: `development/service-ops-api/src/main/java/com/thundercrew/opsapi/cleaningschedule/CleaningScheduleCommandController.java`
- Create: `development/service-ops-api/src/main/java/com/thundercrew/opsapi/cleaningschedule/CleaningScheduleReadController.java`

- [ ] **Step 1: CommandController 작성**

```java
// development/service-ops-api/src/main/java/com/thundercrew/opsapi/cleaningschedule/CleaningScheduleCommandController.java
package com.thundercrew.opsapi.cleaningschedule;

import com.thundercrew.opsapi.cleaningschedule.dto.CleaningScheduleCreateRequest;
import com.thundercrew.opsapi.cleaningschedule.dto.CleaningScheduleReadResponse;
import com.thundercrew.opsapi.cleaningschedule.service.CleaningScheduleCommandService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/cleaning-schedules")
public class CleaningScheduleCommandController {

    private final CleaningScheduleCommandService commandService;

    public CleaningScheduleCommandController(CleaningScheduleCommandService commandService) {
        this.commandService = commandService;
    }

    @PostMapping
    public ResponseEntity<CleaningScheduleReadResponse> create(
        @RequestBody CleaningScheduleCreateRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(commandService.create(request));
    }
}
```

- [ ] **Step 2: ReadController 작성**

```java
// development/service-ops-api/src/main/java/com/thundercrew/opsapi/cleaningschedule/CleaningScheduleReadController.java
package com.thundercrew.opsapi.cleaningschedule;

import com.thundercrew.opsapi.cleaningschedule.dto.CleaningScheduleReadResponse;
import com.thundercrew.opsapi.cleaningschedule.service.CleaningScheduleQueryService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import java.util.List;

@RestController
@RequestMapping("/api/v1/cleaning-schedules")
public class CleaningScheduleReadController {

    private final CleaningScheduleQueryService queryService;

    public CleaningScheduleReadController(CleaningScheduleQueryService queryService) {
        this.queryService = queryService;
    }

    @GetMapping
    public List<CleaningScheduleReadResponse> list(
        @RequestParam(required = false) String bikeId
    ) {
        if (bikeId != null) return queryService.findByBikeId(bikeId);
        return queryService.findAll();
    }
}
```

- [ ] **Step 3: 커밋**

```bash
git add src/main/java/com/thundercrew/opsapi/cleaningschedule/CleaningScheduleCommandController.java \
        src/main/java/com/thundercrew/opsapi/cleaningschedule/CleaningScheduleReadController.java
git commit -m "feat(cleaning-schedule): REST controllers (POST + GET)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: 백엔드 계약 테스트

**Files:**
- Create: `development/service-ops-api/src/test/java/com/thundercrew/opsapi/CleaningScheduleApiContractTests.java`

**참고:** 기존 `BikeCommandApiContractTests` 패턴과 동일하다. `@BeforeEach`에서 관련 테이블을 JDBC로 리셋하고, 시드 자전거는 `service_type = 'CLEANING'`으로 삽입한다. `PostgresContainerSupport`를 상속한다.

- [ ] **Step 1: 실패하는 테스트 작성**

```java
// development/service-ops-api/src/test/java/com/thundercrew/opsapi/CleaningScheduleApiContractTests.java
package com.thundercrew.opsapi;

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

import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class CleaningScheduleApiContractTests extends PostgresContainerSupport {

    private static final UUID ADMIN_ID = UUID.fromString("cccccccc-cccc-cccc-cccc-cccccccccccc");
    private static final UUID CLEANING_BIKE_ID = UUID.fromString("dddddddd-dddd-dddd-dddd-dddddddddddd");
    private static final UUID DELIVERY_BIKE_ID = UUID.fromString("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee");
    private static final Pattern ACCESS_TOKEN_PATTERN = Pattern.compile("\"accessToken\"\\s*:\\s*\"([^\"]+)\"");

    @Autowired private MockMvc mockMvc;
    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private PasswordEncoder passwordEncoder;

    private String accessToken;

    @DynamicPropertySource
    static void postgresProperties(DynamicPropertyRegistry registry) {
        registerPostgresProperties(registry);
    }

    @BeforeEach
    void resetRows() throws Exception {
        jdbcTemplate.update("delete from cleaning_schedules");
        jdbcTemplate.update("delete from bike_operation_status_histories");
        jdbcTemplate.update("delete from bikes");
        jdbcTemplate.update("delete from admin_users");
        jdbcTemplate.update("""
            insert into admin_users (id, login_id, email, password_hash, display_name, enabled)
            values (?, 'ops-admin', 'ops@example.test', ?, 'Ops Admin', true)
            """, ADMIN_ID, passwordEncoder.encode("correct-password"));
        jdbcTemplate.update("""
            insert into bikes (id, idx, plate_number, vin, model_name, engine_type, service_type,
                               operation_status, ignition_blocked, created_at, updated_at)
            values (?, 1, '서울A-9001', 'VIN-CLEAN-001', 'Thunder C1', 'ELECTRIC', 'CLEANING',
                    'READY', false, now(), now())
            """, CLEANING_BIKE_ID);
        jdbcTemplate.update("""
            insert into bikes (id, idx, plate_number, vin, model_name, engine_type, service_type,
                               operation_status, ignition_blocked, created_at, updated_at)
            values (?, 2, '서울B-9002', 'VIN-DLVR-001', 'Thunder D1', 'ELECTRIC', 'DELIVERY',
                    'READY', false, now(), now())
            """, DELIVERY_BIKE_ID);
        accessToken = loginAndExtractToken();
    }

    private String loginAndExtractToken() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"loginId\":\"ops-admin\",\"password\":\"correct-password\"}"))
            .andExpect(status().isOk())
            .andReturn();
        String body = result.getResponse().getContentAsString();
        Matcher m = ACCESS_TOKEN_PATTERN.matcher(body);
        if (!m.find()) throw new IllegalStateException("accessToken not found in login response");
        return m.group(1);
    }

    @Test
    void createScheduleForCleaningBikeReturns201WithId() throws Exception {
        mockMvc.perform(post("/api/v1/cleaning-schedules")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "bikeId": "%s",
                      "scheduledAt": "2026-06-01T10:00:00",
                      "address": "서울시 강남구 역삼동 123",
                      "memo": "현관 비밀번호 1234"
                    }
                    """.formatted(CLEANING_BIKE_ID)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").isString())
            .andExpect(jsonPath("$.bikeId").value(CLEANING_BIKE_ID.toString()))
            .andExpect(jsonPath("$.bikePlateNumber").value("서울A-9001"))
            .andExpect(jsonPath("$.address").value("서울시 강남구 역삼동 123"))
            .andExpect(jsonPath("$.memo").value("현관 비밀번호 1234"))
            .andExpect(jsonPath("$.scheduledAt").value("2026-06-01T10:00:00"));
    }

    @Test
    void createScheduleForDeliveryBikeReturns400() throws Exception {
        mockMvc.perform(post("/api/v1/cleaning-schedules")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "bikeId": "%s",
                      "scheduledAt": "2026-06-01T10:00:00",
                      "address": "서울시 강남구 역삼동 456"
                    }
                    """.formatted(DELIVERY_BIKE_ID)))
            .andExpect(status().isBadRequest());
    }

    @Test
    void listSchedulesByBikeIdReturnsOnlyThatBikesSchedules() throws Exception {
        // 일정 2개 생성
        mockMvc.perform(post("/api/v1/cleaning-schedules")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"bikeId":"%s","scheduledAt":"2026-06-01T10:00:00","address":"서울시 강남구"}
                    """.formatted(CLEANING_BIKE_ID)))
            .andExpect(status().isCreated());
        mockMvc.perform(post("/api/v1/cleaning-schedules")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"bikeId":"%s","scheduledAt":"2026-06-02T14:00:00","address":"서울시 서초구"}
                    """.formatted(CLEANING_BIKE_ID)))
            .andExpect(status().isCreated());

        mockMvc.perform(get("/api/v1/cleaning-schedules")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                .param("bikeId", CLEANING_BIKE_ID.toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(2))
            .andExpect(jsonPath("$[0].address").value("서울시 강남구"))
            .andExpect(jsonPath("$[1].address").value("서울시 서초구"));
    }
}
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd development/service-ops-api
./gradlew test --tests "com.thundercrew.opsapi.CleaningScheduleApiContractTests" 2>&1 | tail -30
```

Expected: FAIL (cleaningschedule 패키지가 아직 없으므로 컴파일 에러 또는 404)

- [ ] **Step 3: 테스트 통과 확인**

Task 1~4 구현 완료 후 다시 실행:

```bash
./gradlew test --tests "com.thundercrew.opsapi.CleaningScheduleApiContractTests" 2>&1 | tail -20
```

Expected: 3 tests PASS

- [ ] **Step 4: 커밋**

```bash
git add src/test/java/com/thundercrew/opsapi/CleaningScheduleApiContractTests.java
git commit -m "test(cleaning-schedule): API contract tests (3 scenarios)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: 프론트엔드 API 클라이언트

**Files:**
- Create: `development/front-admin-web/lib/services/cleaning-schedule-api.ts`

**참고:** `bikeId`는 UUID 문자열이다(`string`, not `number`). 이 클라이언트는 브라우저에서 직접 `service-ops-api`로 fetch 한다. 기존 `lib/services/service-ops-api.ts`의 fetch 패턴(no-store 없이 단순 fetch, error throw)을 따른다.

- [ ] **Step 1: 실패하는 타입 테스트 작성 (tsc로 확인)**

```ts
// 임시 테스트 — 아직 파일이 없으므로 tsc --noEmit 은 에러.
// import { createCleaningSchedule } from "@/lib/services/cleaning-schedule-api";
// 아래 Step 3에서 tsc로 통과 여부 확인.
```

- [ ] **Step 2: API 클라이언트 작성**

```ts
// development/front-admin-web/lib/services/cleaning-schedule-api.ts

export interface CleaningSchedule {
  id: string;              // UUID
  bikeId: string;          // UUID
  bikePlateNumber: string;
  scheduledAt: string;     // ISO-8601 LocalDateTime: "2026-06-01T10:00:00"
  address: string;
  memo?: string | null;
}

export interface CleaningScheduleCreateInput {
  bikeId: string;          // UUID
  scheduledAt: string;     // ISO-8601: "2026-06-01T10:00:00"
  address: string;
  memo?: string;
}

const BASE = process.env.NEXT_PUBLIC_SERVICE_OPS_API_BASE_URL ?? "";

export async function createCleaningSchedule(
  input: CleaningScheduleCreateInput
): Promise<CleaningSchedule> {
  const res = await fetch(`${BASE}/api/v1/cleaning-schedules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`createCleaningSchedule failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<CleaningSchedule>;
}

export async function fetchCleaningSchedules(bikeId: string): Promise<CleaningSchedule[]> {
  const res = await fetch(`${BASE}/api/v1/cleaning-schedules?bikeId=${bikeId}`, {
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(`fetchCleaningSchedules failed: ${res.status}`);
  }
  return res.json() as Promise<CleaningSchedule[]>;
}
```

- [ ] **Step 3: tsc 통과 확인**

```bash
cd development/front-admin-web
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors (새 파일은 타입만 정의하므로 에러 없음)

- [ ] **Step 4: 커밋**

```bash
git add lib/services/cleaning-schedule-api.ts
git commit -m "feat(cleaning-schedule): frontend API client

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: NotificationContext + NotificationBell + CSS (벨 스타일)

**Files:**
- Create: `development/front-admin-web/components/layout/NotificationContext.tsx`
- Create: `development/front-admin-web/components/layout/NotificationBell.tsx`
- Modify: `development/front-admin-web/app/globals.css`

**참고:** `NotificationContext`는 React Context + useState로 notifications 배열을 관리한다. `markAllRead()`는 드롭다운 열 때 unread count를 0으로 리셋한다. 세션 동안만 유지(DB 저장 없음).

- [ ] **Step 1: NotificationContext 작성**

```tsx
// development/front-admin-web/components/layout/NotificationContext.tsx
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode
} from "react";

export interface AppNotification {
  id: string;
  bikePlateNumber: string;
  scheduledAt: string;  // ISO-8601
  address: string;
  createdAt: number;    // Date.now()
}

interface NotificationContextValue {
  notifications: ReadonlyArray<AppNotification>;
  unreadCount: number;
  addNotification: (n: Omit<AppNotification, "id" | "createdAt">) => void;
  markAllRead: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [readCount, setReadCount] = useState(0);

  const addNotification = useCallback(
    (n: Omit<AppNotification, "id" | "createdAt">) => {
      setNotifications((prev) => [
        { ...n, id: crypto.randomUUID(), createdAt: Date.now() },
        ...prev,
      ]);
    },
    []
  );

  const markAllRead = useCallback(() => {
    setReadCount(notifications.length);
  }, [notifications.length]);

  const unreadCount = Math.max(0, notifications.length - readCount);

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, addNotification, markAllRead }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}
```

- [ ] **Step 2: NotificationBell 작성**

```tsx
// development/front-admin-web/components/layout/NotificationBell.tsx
"use client";

import { useState } from "react";
import { useNotifications } from "@/components/layout/NotificationContext";

export function NotificationBell() {
  const { notifications, unreadCount, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);

  function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next) markAllRead();
  }

  return (
    <div className="notif-bell-wrap">
      <button
        type="button"
        className="notif-bell-btn"
        onClick={handleToggle}
        aria-label={`알림${unreadCount > 0 ? ` (${unreadCount}개 미읽음)` : ""}`}
      >
        🔔
        {unreadCount > 0 && (
          <span className="notif-bell-badge" aria-hidden="true">
            {unreadCount}
          </span>
        )}
      </button>
      {open && (
        <>
          {/* 드롭다운 외부 클릭 닫기 */}
          <div
            className="notif-backdrop"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="notif-dropdown" role="menu" aria-label="알림 목록">
            <div className="notif-dropdown-header">알림</div>
            {notifications.length === 0 ? (
              <div className="notif-empty">알림 없음</div>
            ) : (
              notifications.slice(0, 20).map((n) => (
                <div key={n.id} className="notif-item" role="menuitem">
                  <div className="notif-item-title">🔔 콜 발송됨</div>
                  <div className="notif-item-body">
                    {n.bikePlateNumber} → {n.address}
                  </div>
                  <div className="notif-item-time">
                    {formatScheduledAt(n.scheduledAt)}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

function formatScheduledAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
```

- [ ] **Step 3: 벨 CSS 추가 — globals.css 파일 끝에 추가**

`globals.css` 파일 맨 끝 줄 다음에 아래 블록을 추가한다.

```css
/* ── 벨 알림 (NotificationBell) ─────────────────────────────── */
.notif-bell-wrap { position: relative; display: inline-flex; align-items: center; }
.notif-bell-btn {
  position: relative;
  background: transparent;
  border: none;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 6px;
  color: var(--color-text-primary);
}
.notif-bell-btn:hover { background: var(--mint-08); }
.notif-bell-badge {
  position: absolute;
  top: -2px;
  right: -2px;
  background: #ef4444;
  color: #fff;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  padding: 1px 5px;
  min-width: 16px;
  text-align: center;
  line-height: 1.4;
}
.notif-backdrop {
  position: fixed;
  inset: 0;
  z-index: 199;
}
.notif-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  width: 280px;
  background: var(--color-surface);
  border-radius: 10px;
  box-shadow: var(--shadow-panel);
  border: 1px solid var(--color-border);
  z-index: 200;
  overflow: hidden;
}
.notif-dropdown-header {
  padding: 10px 14px;
  font-weight: 700;
  font-size: 13px;
  border-bottom: 1px solid var(--color-divider);
  color: var(--color-text-primary);
}
.notif-item {
  padding: 10px 14px;
  border-bottom: 1px solid var(--color-divider);
}
.notif-item:last-child { border-bottom: none; }
.notif-item-title { font-weight: 600; font-size: 12px; margin-bottom: 2px; color: var(--color-text-primary); }
.notif-item-body { font-size: 12px; color: var(--color-text-secondary); }
.notif-item-time { font-size: 11px; color: var(--color-text-muted); margin-top: 2px; }
.notif-empty { padding: 16px 14px; font-size: 12px; color: var(--color-text-muted); text-align: center; }
```

- [ ] **Step 4: tsc 통과 확인**

```bash
cd development/front-admin-web
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 5: 커밋**

```bash
git add components/layout/NotificationContext.tsx \
        components/layout/NotificationBell.tsx \
        app/globals.css
git commit -m "feat(cleaning-schedule): NotificationContext + NotificationBell + CSS

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: CleaningSchedulePanel + CSS (패널 스타일)

**Files:**
- Create: `development/front-admin-web/components/management/CleaningSchedulePanel.tsx`
- Modify: `development/front-admin-web/app/globals.css` (패널 CSS 추가)

**참고:** `bikeId`는 UUID 문자열(`string`). `useNotifications()`로 `addNotification` 호출 — Task 7의 `NotificationContext`가 필요하다. `fetchCleaningSchedules`와 `createCleaningSchedule`은 Task 6의 `cleaning-schedule-api.ts`에서 import.

- [ ] **Step 1: CleaningSchedulePanel 작성**

```tsx
// development/front-admin-web/components/management/CleaningSchedulePanel.tsx
"use client";

import { useEffect, useState } from "react";
import {
  createCleaningSchedule,
  fetchCleaningSchedules,
  type CleaningSchedule,
} from "@/lib/services/cleaning-schedule-api";
import { useNotifications } from "@/components/layout/NotificationContext";

interface CleaningSchedulePanelProps {
  bikeId: string;         // UUID string
  bikePlateNumber: string;
}

export function CleaningSchedulePanel({ bikeId, bikePlateNumber }: CleaningSchedulePanelProps) {
  const { addNotification } = useNotifications();
  const [schedules, setSchedules] = useState<CleaningSchedule[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSchedules([]);
    fetchCleaningSchedules(bikeId)
      .then(setSchedules)
      .catch((err) => console.error("Failed to load schedules:", err));
  }, [bikeId]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const date = String(fd.get("date") ?? "").trim();
    const time = String(fd.get("time") ?? "").trim();
    const address = String(fd.get("address") ?? "").trim();
    const memo = String(fd.get("memo") ?? "").trim() || undefined;
    if (!date || !time || !address) return;

    const scheduledAt = `${date}T${time}:00`;
    setSubmitting(true);
    try {
      const created = await createCleaningSchedule({ bikeId, scheduledAt, address, memo });
      setSchedules((prev) =>
        [...prev, created].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
      );
      addNotification({ bikePlateNumber, scheduledAt, address });
      setFormOpen(false);
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "발송 실패");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <aside className="cleaning-schedule-panel" aria-label="클리닝 일정">
      <div className="cleaning-schedule-panel-header">
        <span className="cleaning-schedule-panel-title">📅 클리닝 일정</span>
        <span className="cleaning-schedule-panel-plate">{bikePlateNumber}</span>
        <button
          type="button"
          className="cleaning-schedule-add-btn"
          onClick={() => { setFormOpen((v) => !v); setError(null); }}
        >
          {formOpen ? "취소" : "+ 일정 추가"}
        </button>
      </div>

      {formOpen && (
        <form className="cleaning-schedule-form" onSubmit={handleSubmit}>
          <div className="cleaning-schedule-form-row">
            <input
              type="date"
              name="date"
              required
              className="cleaning-schedule-input"
              aria-label="날짜"
            />
            <input
              type="time"
              name="time"
              required
              className="cleaning-schedule-input"
              aria-label="시간"
            />
          </div>
          <input
            type="text"
            name="address"
            placeholder="주소"
            required
            className="cleaning-schedule-input cleaning-schedule-input--full"
            aria-label="주소"
          />
          <input
            type="text"
            name="memo"
            placeholder="메모 (선택)"
            className="cleaning-schedule-input cleaning-schedule-input--full"
            aria-label="메모"
          />
          {error && <p className="cleaning-schedule-error">{error}</p>}
          <button
            type="submit"
            className="cleaning-schedule-submit-btn"
            disabled={submitting}
          >
            {submitting ? "발송 중..." : "콜 발송"}
          </button>
        </form>
      )}

      <div className="cleaning-schedule-list">
        {schedules.length === 0 ? (
          <div className="cleaning-schedule-empty">등록된 일정 없음</div>
        ) : (
          schedules.map((s) => (
            <div key={s.id} className="cleaning-schedule-item">
              <div className="cleaning-schedule-item-time">
                {formatScheduledAt(s.scheduledAt)}
              </div>
              <div className="cleaning-schedule-item-address">{s.address}</div>
              {s.memo && (
                <div className="cleaning-schedule-item-memo">{s.memo}</div>
              )}
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

function formatScheduledAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
```

- [ ] **Step 2: 패널 CSS — globals.css 파일 끝에 추가 (벨 CSS 블록 다음)**

```css
/* ── 클리닝 일정 패널 (CleaningSchedulePanel) ─────────────────── */
.cleaning-schedule-panel {
  width: 272px;
  flex-shrink: 0;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  align-self: flex-start;
  max-height: 600px;
}
.cleaning-schedule-panel-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-divider);
  flex-shrink: 0;
}
.cleaning-schedule-panel-title { font-size: 13px; font-weight: 700; color: var(--color-text-primary); }
.cleaning-schedule-panel-plate { font-size: 12px; color: var(--color-text-muted); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cleaning-schedule-add-btn {
  font-size: 12px;
  font-weight: 600;
  color: var(--baemin-mint);
  background: transparent;
  border: none;
  cursor: pointer;
  white-space: nowrap;
  padding: 2px 0;
}
.cleaning-schedule-add-btn:hover { text-decoration: underline; }
.cleaning-schedule-form {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-divider);
  background: var(--color-bg-soft);
  flex-shrink: 0;
}
.cleaning-schedule-form-row { display: flex; gap: 6px; }
.cleaning-schedule-input {
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 5px 8px;
  font-size: 12px;
  color: var(--color-text-primary);
  background: var(--color-surface);
  width: 100%;
  box-sizing: border-box;
  font-family: inherit;
}
.cleaning-schedule-input:focus { outline: none; border-color: var(--baemin-mint); box-shadow: var(--shadow-focus); }
.cleaning-schedule-input--full { width: 100%; }
.cleaning-schedule-error { font-size: 11px; color: #ef4444; margin: 0; }
.cleaning-schedule-submit-btn {
  background: var(--baemin-mint);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 7px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
}
.cleaning-schedule-submit-btn:hover:not(:disabled) { opacity: .9; }
.cleaning-schedule-submit-btn:disabled { opacity: .6; cursor: not-allowed; }
.cleaning-schedule-list { flex: 1; overflow-y: auto; }
.cleaning-schedule-item {
  padding: 9px 12px;
  border-bottom: 1px solid var(--color-divider);
}
.cleaning-schedule-item:last-child { border-bottom: none; }
.cleaning-schedule-item-time { font-size: 12px; font-weight: 600; color: var(--color-text-primary); margin-bottom: 2px; }
.cleaning-schedule-item-address { font-size: 12px; color: var(--color-text-secondary); }
.cleaning-schedule-item-memo { font-size: 11px; color: var(--color-text-muted); margin-top: 2px; }
.cleaning-schedule-empty { padding: 16px 12px; font-size: 12px; color: var(--color-text-muted); text-align: center; }
```

- [ ] **Step 3: tsc 통과 확인**

```bash
cd development/front-admin-web
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 4: 커밋**

```bash
git add components/management/CleaningSchedulePanel.tsx app/globals.css
git commit -m "feat(cleaning-schedule): CleaningSchedulePanel + CSS

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: VehiclesPanel 연결

**Files:**
- Modify: `development/front-admin-web/components/management/VehiclesPanel.tsx`

**참고:** 현재 VehiclesPanel의 행 onClick은 `setSelectedBikeId(vehicle.id)`만 한다 — 기존 floating 상세 패널을 유지하면서, CLEANING 탭에서 행 클릭 시 `selectedCleaningVehicleId`를 추가로 세팅한다. 패널은 테이블 우측에 나란히 배치. `vehicle.id`는 UUID 문자열.

- [ ] **Step 1: import 추가**

`VehiclesPanel.tsx` 상단 import에 아래 추가:

```tsx
import { CleaningSchedulePanel } from "@/components/management/CleaningSchedulePanel";
```

- [ ] **Step 2: selectedCleaningVehicleId state 추가**

`VehiclesPanel` 함수 내 기존 state 선언들 아래에 추가:

```tsx
const [selectedCleaningVehicleId, setSelectedCleaningVehicleId] = useState<string | null>(null);
```

- [ ] **Step 3: serviceTypeFilter 변경 시 선택 해제**

기존 useEffect 블록들 아래에 추가:

```tsx
// 서비스 유형 탭 바뀌면 클리닝 패널 선택 해제
useEffect(() => {
  if (serviceTypeFilter !== "CLEANING") {
    setSelectedCleaningVehicleId(null);
  }
}, [serviceTypeFilter]);
```

- [ ] **Step 4: 기존 vehicleById 맵 추가**

`bikePinById` useMemo 바로 다음에 추가 (차량 ID → 차량 정보 lookup):

```tsx
const vehicleById = useMemo(() => {
  const map = new Map<string, (typeof visibleVehicles)[0]>();
  for (const v of visibleVehicles) {
    const key = v.id ?? v.slug;
    if (key) map.set(key, v);
  }
  return map;
}, [visibleVehicles]);
```

- [ ] **Step 5: 기존 행 onClick 수정**

기존:
```tsx
onClick={() => {
  if (vehicle.id) setSelectedBikeId(vehicle.id);
}}
```

변경 후:
```tsx
onClick={() => {
  if (vehicle.id) {
    setSelectedBikeId(vehicle.id);
    if (serviceTypeFilter === "CLEANING") {
      setSelectedCleaningVehicleId((prev) =>
        prev === vehicle.id ? null : vehicle.id
      );
    }
  }
}}
```

- [ ] **Step 6: 레이아웃 래퍼 추가 + 패널 렌더**

`return (` 바로 뒤, JSX 블록 시작 전에 `selectedCleaningVehicle` 변수를 계산하는 줄을 추가한다:

```tsx
const selectedCleaningVehicle =
  serviceTypeFilter === "CLEANING" && selectedCleaningVehicleId
    ? (vehicleById.get(selectedCleaningVehicleId) ?? null)
    : null;
```

그 다음, 기존 `<div className="table-card vehicles-table-scroll">` 를 감싸는 래퍼와 패널을 추가한다. 기존 코드:

```tsx
<div className="table-card vehicles-table-scroll">
  <table ...>
  ...
  </table>
</div>
```

변경 후:

```tsx
<div className={selectedCleaningVehicle
  ? "vehicles-panel-main vehicles-panel-main--with-schedule"
  : "vehicles-panel-main"
}>
  <div className="table-card vehicles-table-scroll">
    <table ...>
    ...
    </table>
  </div>
  {selectedCleaningVehicle && selectedCleaningVehicleId && (
    <CleaningSchedulePanel
      bikeId={selectedCleaningVehicleId}
      bikePlateNumber={selectedCleaningVehicle.plateNumber ?? ""}
    />
  )}
</div>
```

- [ ] **Step 7: 레이아웃 CSS — globals.css 맨 끝에 추가**

```css
/* ── VehiclesPanel + CleaningSchedulePanel 나란히 레이아웃 ────── */
.vehicles-panel-main { display: flex; gap: 12px; align-items: flex-start; }
.vehicles-panel-main .table-card { flex: 1; min-width: 0; }
```

- [ ] **Step 8: tsc 통과 확인**

```bash
cd development/front-admin-web
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 9: 커밋**

```bash
git add components/management/VehiclesPanel.tsx app/globals.css
git commit -m "feat(cleaning-schedule): VehiclesPanel 클리닝 패널 연결

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: app/page.tsx — NotificationProvider + NotificationBell 연결

**Files:**
- Modify: `development/front-admin-web/app/page.tsx`

**참고:** `app/page.tsx`는 Server Component이다. `NotificationProvider`는 "use client" 컴포넌트지만, Server Component가 Client Component를 렌더할 수 있다. 가장 바깥 `<div className="page-container">`를 `<NotificationProvider>`로 감싸고, 탭 action 영역(`overview-tab-action` div)에 `<NotificationBell />`을 추가한다.

- [ ] **Step 1: import 추가**

`app/page.tsx` 기존 import 목록 다음에 추가:

```tsx
import { NotificationBell } from "@/components/layout/NotificationBell";
import { NotificationProvider } from "@/components/layout/NotificationContext";
```

- [ ] **Step 2: NotificationProvider로 return 감싸기**

기존:
```tsx
return (
  <div className="page-container">
    ...
  </div>
);
```

변경 후:
```tsx
return (
  <NotificationProvider>
    <div className="page-container">
      ...
    </div>
  </NotificationProvider>
);
```

- [ ] **Step 3: NotificationBell을 탭 action 영역에 추가**

기존:
```tsx
<div className="overview-tab-action">
  {activeTab === "riders" ? <CreateRiderDialog /> : null}
  {activeTab === "vehicles" ? <CreateVehicleDialog /> : null}
  {activeTab === "stations" ? <CreateStationDialog /> : null}
  {activeTab === "maintenance" ? <CreateMaintenanceItemDialog parentOptions={maintenanceData.items} /> : null}
</div>
```

변경 후:
```tsx
<div className="overview-tab-action">
  {activeTab === "riders" ? <CreateRiderDialog /> : null}
  {activeTab === "vehicles" ? <CreateVehicleDialog /> : null}
  {activeTab === "stations" ? <CreateStationDialog /> : null}
  {activeTab === "maintenance" ? <CreateMaintenanceItemDialog parentOptions={maintenanceData.items} /> : null}
  <NotificationBell />
</div>
```

- [ ] **Step 4: tsc + lint 통과 확인**

```bash
cd development/front-admin-web
npx tsc --noEmit 2>&1 | head -20
npm run lint 2>&1 | tail -20
```

Expected: no errors

- [ ] **Step 5: 커밋**

```bash
git add app/page.tsx
git commit -m "feat(cleaning-schedule): page.tsx에 NotificationProvider + NotificationBell 연결

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: 최종 검증 + PR

**Files:** 없음 (검증만)

- [ ] **Step 1: 백엔드 전체 테스트 실행**

```bash
cd development/service-ops-api
./gradlew test 2>&1 | tail -30
```

Expected: BUILD SUCCESSFUL, 새 테스트 3개 포함 전체 통과

- [ ] **Step 2: 프론트엔드 빌드 확인**

```bash
cd development/front-admin-web
npm run build 2>&1 | tail -30
```

Expected: ✓ Compiled successfully (또는 Route 목록 출력)

- [ ] **Step 3: PR 생성**

```bash
cd <repo-root>
gh pr create \
  --base main \
  --head dev \
  --title "feat: cleaning schedule + 벨 알림 시뮬레이션" \
  --body "$(cat <<'EOF'
## Summary
- 백엔드: V26 마이그레이션(cleaning_schedules), cleaningschedule 패키지 (POST/GET 2 endpoints)
- 프론트: 차량 탭 CLEANING 필터 시 우측 일정 패널, 콜 발송 → 헤더 벨 알림 시뮬레이션

## Test plan
- [ ] 차량 서비스 유형을 CLEANING으로 변경
- [ ] 차량 탭 → 클리닝 탭 클릭 → 클리닝 차량 행 클릭 → 우측 패널 표시 확인
- [ ] 일정 추가 버튼 → 날짜/시간/주소 입력 → 콜 발송
- [ ] 헤더 벨 아이콘 뱃지 증가 + 드롭다운에 항목 확인
- [ ] 새로고침 후 일정 목록이 DB에서 유지되는지 확인
- [ ] DELIVERY 차량에 일정 등록 시 400 에러 확인

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: PR URL 보고**
