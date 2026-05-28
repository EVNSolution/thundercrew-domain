# Cleaning Next Customer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CLEANING 차량에 한해 관리자가 다음 고객 정보(이름·전화·주소)를 입력하면, 시뮬레이션이 그 주소를 목적지로 이동하고 시동 ON 시 벨 알림에 고객 정보가 표시되도록 한다.

**Architecture:** 프론트엔드 Server Action이 NCP 지오코딩 후 Java 백엔드 PUT 엔드포인트를 호출해 `bike_next_customer` 테이블에 upsert한다. 대시보드 API가 `bike_next_customer` LEFT JOIN으로 nextCustomer 필드를 포함해 응답하고, FleetSimulationContext tick loop가 250ms마다 pinsRef에서 목적지를 동기화한다.

**Tech Stack:** Java/Spring Boot (backend), Next.js 14 App Router + TypeScript (frontend), NCP Maps Geocoding, PostgreSQL/Flyway

---

## File Map

| 파일 | 신규/수정 |
|------|----------|
| `service-ops-api/src/main/resources/db/migration/V27__add_bike_next_customer.sql` | 신규 |
| `service-ops-api/src/main/java/…/bike/domain/BikeNextCustomer.java` | 신규 |
| `service-ops-api/src/main/java/…/bike/repository/BikeNextCustomerRepository.java` | 신규 |
| `service-ops-api/src/main/java/…/bike/dto/BikeNextCustomerRequest.java` | 신규 |
| `service-ops-api/src/main/java/…/bike/dto/BikeNextCustomerResponse.java` | 신규 |
| `service-ops-api/src/main/java/…/bike/service/BikeNextCustomerService.java` | 신규 |
| `service-ops-api/src/main/java/…/bike/controller/BikeNextCustomerController.java` | 신규 |
| `service-ops-api/src/main/java/…/dashboard/repository/DashboardMapQueryRepository.java` | 수정 |
| `service-ops-api/src/main/java/…/dashboard/dto/DashboardMapStateResponse.java` | 수정 |
| `service-ops-api/src/main/java/…/dashboard/service/DashboardMapStateService.java` | 수정 |
| `service-ops-api/src/test/java/…/BikeNextCustomerApiContractTests.java` | 신규 |
| `front-admin-web/lib/services/service-ops-api.ts` | 수정 |
| `front-admin-web/app/actions.ts` | 수정 |
| `front-admin-web/components/management/VehicleDetailDialog.tsx` | 수정 |
| `front-admin-web/lib/services/fleet-simulation.ts` | 수정 |
| `front-admin-web/components/overview/FleetSimulationContext.tsx` | 수정 |
| `front-admin-web/components/layout/NotificationContext.tsx` | 수정 |
| `front-admin-web/components/layout/NotificationBell.tsx` | 수정 |

Base path shorthand: `…` = `com/thundercrew/opsapi`

---

### Task 1: V27 DB Migration

**Files:**
- Create: `development/service-ops-api/src/main/resources/db/migration/V27__add_bike_next_customer.sql`

> **Note:** V26 was used for `cleaning_schedules`. Verify the latest migration in `src/main/resources/db/migration/` and use the next available version number (V26 if it doesn't exist there, otherwise V27).

- [ ] **Step 1: Write the migration SQL**

Create `V27__add_bike_next_customer.sql`:

```sql
create table bike_next_customer (
    bike_id        uuid             primary key references bikes(id),
    customer_name  varchar(100)     not null,
    customer_phone varchar(20)      not null,
    address        varchar(500)     not null,
    latitude       double precision not null,
    longitude      double precision not null,
    updated_at     timestamptz      not null
);
```

- [ ] **Step 2: Verify migration file exists**

```bash
ls development/service-ops-api/src/main/resources/db/migration/V27*
```
Expected: the file you just created.

- [ ] **Step 3: Commit**

```bash
git add development/service-ops-api/src/main/resources/db/migration/V27__add_bike_next_customer.sql
git commit -m "feat: V27 add bike_next_customer table"
```

---

### Task 2: BikeNextCustomer Entity, Repository, and DTOs

**Files:**
- Create: `development/service-ops-api/src/main/java/com/thundercrew/opsapi/bike/domain/BikeNextCustomer.java`
- Create: `development/service-ops-api/src/main/java/com/thundercrew/opsapi/bike/repository/BikeNextCustomerRepository.java`
- Create: `development/service-ops-api/src/main/java/com/thundercrew/opsapi/bike/dto/BikeNextCustomerRequest.java`
- Create: `development/service-ops-api/src/main/java/com/thundercrew/opsapi/bike/dto/BikeNextCustomerResponse.java`

- [ ] **Step 1: Write BikeNextCustomer entity**

`bike_id`를 PK로 쓰는 1:1 엔티티. `AuditableEntity`를 상속하지 않는다(UUID id 필드가 충돌).

```java
package com.thundercrew.opsapi.bike.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "bike_next_customer")
public class BikeNextCustomer {

    @Id
    @Column(name = "bike_id", nullable = false, updatable = false)
    private UUID bikeId;

    @Column(name = "customer_name", nullable = false, length = 100)
    private String customerName;

    @Column(name = "customer_phone", nullable = false, length = 20)
    private String customerPhone;

    @Column(nullable = false, length = 500)
    private String address;

    @Column(nullable = false)
    private double latitude;

    @Column(nullable = false)
    private double longitude;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected BikeNextCustomer() {}

    public static BikeNextCustomer create(UUID bikeId, String customerName, String customerPhone,
                                           String address, double latitude, double longitude) {
        BikeNextCustomer e = new BikeNextCustomer();
        e.bikeId = bikeId;
        e.customerName = customerName;
        e.customerPhone = customerPhone;
        e.address = address;
        e.latitude = latitude;
        e.longitude = longitude;
        e.updatedAt = Instant.now();
        return e;
    }

    public void update(String customerName, String customerPhone,
                       String address, double latitude, double longitude) {
        this.customerName = customerName;
        this.customerPhone = customerPhone;
        this.address = address;
        this.latitude = latitude;
        this.longitude = longitude;
        this.updatedAt = Instant.now();
    }

    public UUID getBikeId()         { return bikeId; }
    public String getCustomerName() { return customerName; }
    public String getCustomerPhone(){ return customerPhone; }
    public String getAddress()      { return address; }
    public double getLatitude()     { return latitude; }
    public double getLongitude()    { return longitude; }
    public Instant getUpdatedAt()   { return updatedAt; }
}
```

- [ ] **Step 2: Write BikeNextCustomerRepository**

```java
package com.thundercrew.opsapi.bike.repository;

import com.thundercrew.opsapi.bike.domain.BikeNextCustomer;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.repository.Repository;

public interface BikeNextCustomerRepository extends Repository<BikeNextCustomer, UUID> {
    Optional<BikeNextCustomer> findById(UUID bikeId);
    BikeNextCustomer save(BikeNextCustomer entity);
}
```

- [ ] **Step 3: Write BikeNextCustomerRequest**

```java
package com.thundercrew.opsapi.bike.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record BikeNextCustomerRequest(
        @NotBlank @Size(max = 100) String customerName,
        @NotBlank @Size(max = 20)  String customerPhone,
        @NotBlank @Size(max = 500) String address,
        double latitude,
        double longitude
) {}
```

- [ ] **Step 4: Write BikeNextCustomerResponse**

```java
package com.thundercrew.opsapi.bike.dto;

import com.thundercrew.opsapi.bike.domain.BikeNextCustomer;
import java.util.UUID;

public record BikeNextCustomerResponse(
        UUID   bikeId,
        String customerName,
        String customerPhone,
        String address,
        double latitude,
        double longitude
) {
    public static BikeNextCustomerResponse from(BikeNextCustomer entity) {
        return new BikeNextCustomerResponse(
                entity.getBikeId(),
                entity.getCustomerName(),
                entity.getCustomerPhone(),
                entity.getAddress(),
                entity.getLatitude(),
                entity.getLongitude()
        );
    }
}
```

- [ ] **Step 5: Build the service-ops-api to verify compilation**

```bash
cd development/service-ops-api && ./gradlew compileJava -q
```
Expected: BUILD SUCCESSFUL

- [ ] **Step 6: Commit**

```bash
git add development/service-ops-api/src/main/java/com/thundercrew/opsapi/bike/domain/BikeNextCustomer.java \
        development/service-ops-api/src/main/java/com/thundercrew/opsapi/bike/repository/BikeNextCustomerRepository.java \
        development/service-ops-api/src/main/java/com/thundercrew/opsapi/bike/dto/BikeNextCustomerRequest.java \
        development/service-ops-api/src/main/java/com/thundercrew/opsapi/bike/dto/BikeNextCustomerResponse.java
git commit -m "feat: add BikeNextCustomer entity, repository, and DTOs"
```

---

### Task 3: BikeNextCustomerService

**Files:**
- Create: `development/service-ops-api/src/main/java/com/thundercrew/opsapi/bike/service/BikeNextCustomerService.java`

- [ ] **Step 1: Write the service**

CLEANING 타입이 아닌 차량 → `InvalidStateTransitionException` (→ HTTP 409 Conflict).
행 없음 시 GET → `Optional.empty()` (컨트롤러가 404 반환).

```java
package com.thundercrew.opsapi.bike.service;

import com.thundercrew.opsapi.bike.domain.Bike;
import com.thundercrew.opsapi.bike.domain.BikeNextCustomer;
import com.thundercrew.opsapi.bike.domain.BikeServiceType;
import com.thundercrew.opsapi.bike.dto.BikeNextCustomerRequest;
import com.thundercrew.opsapi.bike.dto.BikeNextCustomerResponse;
import com.thundercrew.opsapi.bike.repository.BikeNextCustomerRepository;
import com.thundercrew.opsapi.bike.repository.BikeRepository;
import com.thundercrew.opsapi.common.api.InvalidStateTransitionException;
import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class BikeNextCustomerService {

    private final BikeRepository bikeRepository;
    private final BikeNextCustomerRepository nextCustomerRepository;

    public BikeNextCustomerService(BikeRepository bikeRepository,
                                    BikeNextCustomerRepository nextCustomerRepository) {
        this.bikeRepository = bikeRepository;
        this.nextCustomerRepository = nextCustomerRepository;
    }

    public Optional<BikeNextCustomerResponse> get(UUID bikeId) {
        requireCleaningBike(bikeId);
        return nextCustomerRepository.findById(bikeId).map(BikeNextCustomerResponse::from);
    }

    @Transactional
    public BikeNextCustomerResponse upsert(UUID bikeId, BikeNextCustomerRequest request) {
        requireCleaningBike(bikeId);
        BikeNextCustomer entity = nextCustomerRepository.findById(bikeId)
                .map(existing -> {
                    existing.update(request.customerName(), request.customerPhone(),
                            request.address(), request.latitude(), request.longitude());
                    return existing;
                })
                .orElseGet(() -> BikeNextCustomer.create(
                        bikeId, request.customerName(), request.customerPhone(),
                        request.address(), request.latitude(), request.longitude()));
        return BikeNextCustomerResponse.from(nextCustomerRepository.save(entity));
    }

    private void requireCleaningBike(UUID bikeId) {
        Bike bike = bikeRepository.findByIdAndDeletedAtIsNull(bikeId)
                .orElseThrow(() -> new ResourceNotFoundException("Bike", bikeId));
        if (bike.getServiceType() != BikeServiceType.CLEANING) {
            throw new InvalidStateTransitionException(
                    "Bike " + bikeId + " is not of CLEANING service type.");
        }
    }
}
```

- [ ] **Step 2: Compile**

```bash
cd development/service-ops-api && ./gradlew compileJava -q
```
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Commit**

```bash
git add development/service-ops-api/src/main/java/com/thundercrew/opsapi/bike/service/BikeNextCustomerService.java
git commit -m "feat: add BikeNextCustomerService with CLEANING guard"
```

---

### Task 4: BikeNextCustomerController

**Files:**
- Create: `development/service-ops-api/src/main/java/com/thundercrew/opsapi/bike/controller/BikeNextCustomerController.java`

- [ ] **Step 1: Write the controller**

```java
package com.thundercrew.opsapi.bike.controller;

import com.thundercrew.opsapi.bike.dto.BikeNextCustomerRequest;
import com.thundercrew.opsapi.bike.dto.BikeNextCustomerResponse;
import com.thundercrew.opsapi.bike.service.BikeNextCustomerService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/bikes/{bikeId}/next-customer")
public class BikeNextCustomerController {

    private final BikeNextCustomerService bikeNextCustomerService;

    public BikeNextCustomerController(BikeNextCustomerService bikeNextCustomerService) {
        this.bikeNextCustomerService = bikeNextCustomerService;
    }

    @GetMapping
    ResponseEntity<BikeNextCustomerResponse> get(@PathVariable UUID bikeId) {
        return bikeNextCustomerService.get(bikeId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping
    BikeNextCustomerResponse put(@PathVariable UUID bikeId,
                                  @Valid @RequestBody BikeNextCustomerRequest request) {
        return bikeNextCustomerService.upsert(bikeId, request);
    }
}
```

- [ ] **Step 2: Compile**

```bash
cd development/service-ops-api && ./gradlew compileJava -q
```
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Commit**

```bash
git add development/service-ops-api/src/main/java/com/thundercrew/opsapi/bike/controller/BikeNextCustomerController.java
git commit -m "feat: add GET/PUT /api/v1/bikes/{id}/next-customer"
```

---

### Task 5: Dashboard API Extension (serviceType + nextCustomer)

**Files:**
- Modify: `development/service-ops-api/src/main/java/com/thundercrew/opsapi/dashboard/repository/DashboardMapQueryRepository.java`
- Modify: `development/service-ops-api/src/main/java/com/thundercrew/opsapi/dashboard/dto/DashboardMapStateResponse.java`
- Modify: `development/service-ops-api/src/main/java/com/thundercrew/opsapi/dashboard/service/DashboardMapStateService.java`

현재 대시보드 SQL은 `bikes`를 이미 JOIN하지만 `service_type`을 SELECT하지 않는다. `bike_next_customer`도 LEFT JOIN해야 한다.

- [ ] **Step 1: Update DashboardMapQueryRepository SQL and BikePinRow**

`findCurrentBikeStates` 쿼리에 `b.service_type`과 `bike_next_customer` LEFT JOIN을 추가한다.

Before (lines 34–69 of DashboardMapQueryRepository.java):
```java
    public List<BikePinRow> findCurrentBikeStates(Instant now) {
        return jdbcTemplate.query("""
                select
                    b.id as bike_id,
                    b.idx as bike_idx,
                    b.plate_number,
                    b.model_name,
                    b.operation_status,
                    active_rider.rider_name,
                    cs.device_id,
                    cs.last_received_at,
                    cs.latitude,
                    cs.longitude,
                    cs.speed_kph,
                    cs.battery_percent,
                    cs.ignition_status,
                    cs.telemetry_source
                from bike_current_states cs
                join bikes b
                  on b.id = cs.bike_id
                 and b.deleted_at is null
                left join lateral (
                    select
                        r.name as rider_name
                    from rider_bike_contracts c
                    join riders r
                      on r.id = c.rider_id
                     and r.deleted_at is null
                    where c.bike_id = b.id
                      and c.deleted_at is null
                      and c.start_at <= ?::timestamptz
                      and ?::timestamptz < coalesce(c.terminated_at, c.end_at, 'infinity'::timestamptz)
                    order by c.start_at desc, c.idx desc
                    limit 1
                ) active_rider on true
                order by cs.last_received_at desc, b.idx asc
                """, this::mapBikePinRow, now.toString(), now.toString());
    }
```

After:
```java
    public List<BikePinRow> findCurrentBikeStates(Instant now) {
        return jdbcTemplate.query("""
                select
                    b.id as bike_id,
                    b.idx as bike_idx,
                    b.plate_number,
                    b.model_name,
                    b.operation_status,
                    b.service_type,
                    active_rider.rider_name,
                    cs.device_id,
                    cs.last_received_at,
                    cs.latitude,
                    cs.longitude,
                    cs.speed_kph,
                    cs.battery_percent,
                    cs.ignition_status,
                    cs.telemetry_source,
                    bnc.customer_name  as next_customer_name,
                    bnc.customer_phone as next_customer_phone,
                    bnc.latitude       as next_customer_lat,
                    bnc.longitude      as next_customer_lng
                from bike_current_states cs
                join bikes b
                  on b.id = cs.bike_id
                 and b.deleted_at is null
                left join lateral (
                    select
                        r.name as rider_name
                    from rider_bike_contracts c
                    join riders r
                      on r.id = c.rider_id
                     and r.deleted_at is null
                    where c.bike_id = b.id
                      and c.deleted_at is null
                      and c.start_at <= ?::timestamptz
                      and ?::timestamptz < coalesce(c.terminated_at, c.end_at, 'infinity'::timestamptz)
                    order by c.start_at desc, c.idx desc
                    limit 1
                ) active_rider on true
                left join bike_next_customer bnc on bnc.bike_id = b.id
                order by cs.last_received_at desc, b.idx asc
                """, this::mapBikePinRow, now.toString(), now.toString());
    }
```

- [ ] **Step 2: Update mapBikePinRow and BikePinRow**

Add the import `import com.thundercrew.opsapi.bike.domain.BikeServiceType;` to the file.

Replace the existing `mapBikePinRow` method and `BikePinRow` record:

```java
    private BikePinRow mapBikePinRow(ResultSet rs, int rowNum) throws SQLException {
        return new BikePinRow(
                rs.getObject("bike_id", UUID.class),
                rs.getLong("bike_idx"),
                rs.getString("plate_number"),
                rs.getString("model_name"),
                BikeOperationStatus.valueOf(rs.getString("operation_status")),
                BikeServiceType.valueOf(rs.getString("service_type")),
                rs.getString("rider_name"),
                rs.getObject("device_id", UUID.class),
                rs.getTimestamp("last_received_at").toInstant(),
                rs.getBigDecimal("latitude"),
                rs.getBigDecimal("longitude"),
                rs.getBigDecimal("speed_kph"),
                rs.getBigDecimal("battery_percent"),
                TelemetryIgnitionStatus.valueOf(rs.getString("ignition_status")),
                rs.getString("telemetry_source"),
                rs.getString("next_customer_name"),
                rs.getString("next_customer_phone"),
                rs.getBigDecimal("next_customer_lat"),
                rs.getBigDecimal("next_customer_lng")
        );
    }
```

Replace the existing `BikePinRow` record:

```java
    public record BikePinRow(
            UUID bikeId,
            Long bikeIdx,
            String plateNumber,
            String modelName,
            BikeOperationStatus operationStatus,
            BikeServiceType serviceType,
            String activeRiderName,
            UUID deviceId,
            Instant lastReceivedAt,
            BigDecimal latitude,
            BigDecimal longitude,
            BigDecimal speedKph,
            BigDecimal batteryPercent,
            TelemetryIgnitionStatus ignitionStatus,
            String telemetrySource,
            String nextCustomerName,
            String nextCustomerPhone,
            BigDecimal nextCustomerLat,
            BigDecimal nextCustomerLng
    ) {
    }
```

- [ ] **Step 3: Update DashboardMapStateResponse.BikePin**

Add import `import com.thundercrew.opsapi.bike.domain.BikeServiceType;` to DashboardMapStateResponse.java.

Replace the `BikePin` record:

```java
    public record BikePin(
            UUID bikeId,
            Long bikeIdx,
            String plateNumber,
            String modelName,
            BikeOperationStatus operationStatus,
            String activeRiderLabel,
            UUID deviceId,
            Instant lastReceivedAt,
            BigDecimal latitude,
            BigDecimal longitude,
            BigDecimal speedKph,
            BigDecimal batteryPercent,
            TelemetryIgnitionStatus ignitionStatus,
            String telemetrySource,
            String drivingStatus,
            String connectionStatus,
            String batteryStatus,
            String pinLabel,
            BikeServiceType serviceType,
            String nextCustomerName,
            String nextCustomerPhone,
            BigDecimal nextCustomerLat,
            BigDecimal nextCustomerLng
    ) {
    }
```

- [ ] **Step 4: Update DashboardMapStateService.toBikePin()**

Replace the existing `toBikePin` method body:

```java
    private BikePin toBikePin(BikePinRow row, Instant generatedAt) {
        String drivingStatus = drivingStatus(row);
        String connectionStatus = connectionStatus(row, generatedAt);
        String batteryStatus = batteryStatus(row);
        return new BikePin(
                row.bikeId(),
                row.bikeIdx(),
                row.plateNumber(),
                row.modelName(),
                row.operationStatus(),
                activeRiderLabel(row),
                row.deviceId(),
                row.lastReceivedAt(),
                row.latitude(),
                row.longitude(),
                row.speedKph(),
                row.batteryPercent(),
                row.ignitionStatus(),
                row.telemetrySource(),
                drivingStatus,
                connectionStatus,
                batteryStatus,
                bikePinLabel(row),
                row.serviceType(),
                row.nextCustomerName(),
                row.nextCustomerPhone(),
                row.nextCustomerLat(),
                row.nextCustomerLng()
        );
    }
```

- [ ] **Step 5: Compile**

```bash
cd development/service-ops-api && ./gradlew compileJava -q
```
Expected: BUILD SUCCESSFUL

- [ ] **Step 6: Commit**

```bash
git add development/service-ops-api/src/main/java/com/thundercrew/opsapi/dashboard/
git commit -m "feat: include serviceType and nextCustomer in dashboard map state response"
```

---

### Task 6: Contract Tests

**Files:**
- Create: `development/service-ops-api/src/test/java/com/thundercrew/opsapi/BikeNextCustomerApiContractTests.java`

- [ ] **Step 1: Write the contract test**

패턴은 `BikeCommandApiContractTests`를 그대로 따른다. `bikes`에 `idx` 시퀀스 자동증가가 있으므로 `INSERT INTO bikes`에 `idx` 없이 삽입.

```java
package com.thundercrew.opsapi;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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
class BikeNextCustomerApiContractTests extends PostgresContainerSupport {

    private static final UUID ADMIN_ID        = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final UUID CLEANING_BIKE   = UUID.fromString("cccccccc-cccc-cccc-cccc-cccccccccccc");
    private static final UUID DELIVERY_BIKE   = UUID.fromString("dddddddd-dddd-dddd-dddd-dddddddddddd");
    private static final Pattern TOKEN_PATTERN =
            Pattern.compile("\"accessToken\"\\s*:\\s*\"([^\"]+)\"");

    @Autowired MockMvc mockMvc;
    @Autowired JdbcTemplate jdbcTemplate;
    @Autowired PasswordEncoder passwordEncoder;

    private String accessToken;

    @DynamicPropertySource
    static void postgresProperties(DynamicPropertyRegistry registry) {
        registerPostgresProperties(registry);
    }

    @BeforeEach
    void setUp() throws Exception {
        jdbcTemplate.update("delete from bike_next_customer");
        jdbcTemplate.update("delete from bike_operation_status_histories");
        jdbcTemplate.update("delete from bikes");
        jdbcTemplate.update("delete from admin_users");

        jdbcTemplate.update("""
                insert into admin_users (id, login_id, email, password_hash, display_name, enabled)
                values (?, 'ops-admin', 'ops@example.test', ?, 'Ops Admin', true)
                """, ADMIN_ID, passwordEncoder.encode("correct-password"));

        jdbcTemplate.update("""
                insert into bikes (id, plate_number, model_name, engine_type, service_type,
                                   operation_status, ignition_blocked)
                values (?, '서울CC-0001', '청소차 M1', 'ICE', 'CLEANING', 'IN_SERVICE', false)
                """, CLEANING_BIKE);

        jdbcTemplate.update("""
                insert into bikes (id, plate_number, model_name, engine_type, service_type,
                                   operation_status, ignition_blocked)
                values (?, '서울DD-0001', '배송 오토바이', 'ELECTRIC', 'DELIVERY', 'IN_SERVICE', false)
                """, DELIVERY_BIKE);

        accessToken = loginAndExtractToken();
    }

    @Test
    void get_returnsNotFoundWhenNotSet() throws Exception {
        mockMvc.perform(get("/api/v1/bikes/{id}/next-customer", CLEANING_BIKE)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isNotFound());
    }

    @Test
    void put_thenGet_roundTrip() throws Exception {
        String body = """
                {
                  "customerName":  "홍길동",
                  "customerPhone": "010-1234-5678",
                  "address":       "서울 강남구 역삼동 123",
                  "latitude":      37.4987,
                  "longitude":     127.0276
                }
                """;

        mockMvc.perform(put("/api/v1/bikes/{id}/next-customer", CLEANING_BIKE)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.customerName").value("홍길동"))
                .andExpect(jsonPath("$.customerPhone").value("010-1234-5678"))
                .andExpect(jsonPath("$.latitude").value(37.4987))
                .andExpect(jsonPath("$.longitude").value(127.0276));

        mockMvc.perform(get("/api/v1/bikes/{id}/next-customer", CLEANING_BIKE)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.customerName").value("홍길동"));
    }

    @Test
    void put_upsertOverwritesExistingRow() throws Exception {
        String first = """
                {"customerName":"이순신","customerPhone":"010-1111-2222",
                 "address":"서울 종로구 1","latitude":37.5762,"longitude":126.9769}
                """;
        String second = """
                {"customerName":"김철수","customerPhone":"010-9999-8888",
                 "address":"서울 강남구 2","latitude":37.4987,"longitude":127.0276}
                """;

        mockMvc.perform(put("/api/v1/bikes/{id}/next-customer", CLEANING_BIKE)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON).content(first))
                .andExpect(status().isOk());

        mockMvc.perform(put("/api/v1/bikes/{id}/next-customer", CLEANING_BIKE)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON).content(second))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.customerName").value("김철수"));

        mockMvc.perform(get("/api/v1/bikes/{id}/next-customer", CLEANING_BIKE)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.customerName").value("김철수"));
    }

    @Test
    void put_rejectsDeliveryBikeWith409() throws Exception {
        mockMvc.perform(put("/api/v1/bikes/{id}/next-customer", DELIVERY_BIKE)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"customerName":"홍길동","customerPhone":"010-1234-5678",
                                 "address":"서울 강남구","latitude":37.4987,"longitude":127.0276}
                                """))
                .andExpect(status().isConflict());
    }

    @Test
    void put_returnsValidationErrorForBlankName() throws Exception {
        mockMvc.perform(put("/api/v1/bikes/{id}/next-customer", CLEANING_BIKE)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"customerName":"","customerPhone":"010-1234-5678",
                                 "address":"서울 강남구","latitude":37.4987,"longitude":127.0276}
                                """))
                .andExpect(status().isBadRequest());
    }

    private String loginAndExtractToken() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"loginId\":\"ops-admin\",\"password\":\"correct-password\"}"))
                .andReturn();
        Matcher m = TOKEN_PATTERN.matcher(result.getResponse().getContentAsString());
        if (!m.find()) throw new IllegalStateException("No access token in login response");
        return m.group(1);
    }
}
```

- [ ] **Step 2: Run only the new test class**

```bash
cd development/service-ops-api && ./gradlew test --tests "com.thundercrew.opsapi.BikeNextCustomerApiContractTests" -i 2>&1 | tail -30
```
Expected: 5 tests, BUILD SUCCESSFUL

- [ ] **Step 3: Commit**

```bash
git add development/service-ops-api/src/test/java/com/thundercrew/opsapi/BikeNextCustomerApiContractTests.java
git commit -m "test: BikeNextCustomer API contract tests"
```

---

### Task 7: Frontend Types and API Client

**Files:**
- Modify: `development/front-admin-web/lib/services/service-ops-api.ts`

- [ ] **Step 1: Add ServiceOpsBikeNextCustomer and BikeNextCustomerUpsertInput types**

`ServiceOpsDashboardBikePin` 타입 아래 (~line 675 바로 뒤)에 추가:

```ts
export type ServiceOpsBikeNextCustomer = {
  bikeId: string;
  customerName: string;
  customerPhone: string;
  address: string;
  latitude: number;
  longitude: number;
};

export type BikeNextCustomerUpsertInput = {
  customerName: string;
  customerPhone: string;
  address: string;
  latitude: number;
  longitude: number;
};
```

- [ ] **Step 2: Extend ServiceOpsDashboardBikePin with nextCustomer fields**

현재 `ServiceOpsDashboardBikePin` (line 654):
```ts
export type ServiceOpsDashboardBikePin = {
  bikeId: string;
  ...
  pinLabel: string;
  serviceType?: ServiceOpsBikeServiceType;
};
```

`serviceType?` 아래에 4개 필드 추가:
```ts
  nextCustomerName?: string | null;
  nextCustomerPhone?: string | null;
  nextCustomerLat?: number | string | null;
  nextCustomerLng?: number | string | null;
```

- [ ] **Step 3: Extend FrontendDashboardBikePin Omit and add converted fields**

현재 (line 724):
```ts
export type FrontendDashboardBikePin = Omit<ServiceOpsDashboardBikePin, "latitude" | "longitude" | "speedKph" | "batteryPercent"> & {
  slug: string;
  latitude: number;
  longitude: number;
  speedKph: number | null;
  batteryPercent: number | null;
};
```

Replace with:
```ts
export type FrontendDashboardBikePin = Omit<ServiceOpsDashboardBikePin, "latitude" | "longitude" | "speedKph" | "batteryPercent" | "nextCustomerLat" | "nextCustomerLng"> & {
  slug: string;
  latitude: number;
  longitude: number;
  speedKph: number | null;
  batteryPercent: number | null;
  nextCustomerLat: number | null;
  nextCustomerLng: number | null;
};
```

- [ ] **Step 4: Update toFrontendDashboardMapState conversion**

현재 (line 1443):
```ts
    bikePins: mapState.bikePins.map((pin) => ({
      ...pin,
      batteryPercent: toNullableNumber(pin.batteryPercent),
      latitude: toNumber(pin.latitude),
      longitude: toNumber(pin.longitude),
      slug: pin.bikeId,
      speedKph: toNullableNumber(pin.speedKph)
    })),
```

Replace with:
```ts
    bikePins: mapState.bikePins.map((pin) => ({
      ...pin,
      batteryPercent: toNullableNumber(pin.batteryPercent),
      latitude: toNumber(pin.latitude),
      longitude: toNumber(pin.longitude),
      slug: pin.bikeId,
      speedKph: toNullableNumber(pin.speedKph),
      nextCustomerLat: toNullableNumber(pin.nextCustomerLat),
      nextCustomerLng: toNullableNumber(pin.nextCustomerLng)
    })),
```

- [ ] **Step 5: Add methods to ServiceOpsApiClient interface**

`ServiceOpsApiClient` 타입 정의에 (기존 `getBikeSnapshot` 바로 아래쯤) 추가:

```ts
  getBikeNextCustomer: (bikeId: string) => Promise<ServiceOpsBikeNextCustomer | null>;
  setBikeNextCustomer: (bikeId: string, input: BikeNextCustomerUpsertInput) => Promise<ServiceOpsBikeNextCustomer>;
```

- [ ] **Step 6: Implement the new methods in createServiceOpsApiClient()**

`getBikeSnapshot` 구현 바로 뒤에 추가:

```ts
    getBikeNextCustomer: async (bikeId) => {
      try {
        return await request<ServiceOpsBikeNextCustomer>(
          `/bikes/${encodeURIComponent(bikeId)}/next-customer`,
          { method: "GET" }
        );
      } catch (e) {
        if (e instanceof ServiceOpsApiError && e.status === 404) return null;
        throw e;
      }
    },
    setBikeNextCustomer: (bikeId, input) =>
      request<ServiceOpsBikeNextCustomer>(
        `/bikes/${encodeURIComponent(bikeId)}/next-customer`,
        { body: JSON.stringify(input), method: "PUT" }
      ),
```

- [ ] **Step 7: TypeScript check**

```bash
cd development/front-admin-web && npx tsc --noEmit 2>&1 | head -40
```
Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add development/front-admin-web/lib/services/service-ops-api.ts
git commit -m "feat: add nextCustomer types and API client methods"
```

---

### Task 8: Server Actions

**Files:**
- Modify: `development/front-admin-web/app/actions.ts`

- [ ] **Step 1: Add missing import for ServiceOpsBikeNextCustomer**

`actions.ts` top `import` 블록의 service-ops-api import에 `ServiceOpsBikeNextCustomer`, `BikeNextCustomerUpsertInput` 추가:

```ts
import {
  type ServiceOpsBikeEngineType,
  type ServiceOpsBikeOperationStatus,
  type ServiceOpsBikeServiceType,
  type ServiceOpsBikeNextCustomer,
  type BikeNextCustomerUpsertInput,
  type ServiceOpsStationStatus,
  type ServiceOpsRiderEducationType,
  serviceOpsApiConfigured,
  ServiceOpsApiError
} from "@/lib/services/service-ops-api";
```

- [ ] **Step 2: Add getNextCustomerAction at the end of actions.ts**

파일 끝에 추가:

```ts
/**
 * CLEANING 차량의 다음 고객 정보를 조회한다.
 * 설정되지 않았거나 오류 시 null 반환.
 */
export async function getNextCustomerAction(
  bikeId: string
): Promise<ServiceOpsBikeNextCustomer | null> {
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: false });
  if (!client) return null;
  return client.getBikeNextCustomer(bikeId).catch(() => null);
}

/**
 * CLEANING 차량의 다음 고객 정보를 저장한다.
 * NCP 지오코딩 → PUT /api/v1/bikes/{id}/next-customer.
 */
export async function setNextCustomerAction(
  bikeId: string,
  data: { customerName: string; customerPhone: string; address: string }
): Promise<{ ok: true; lat: number; lng: number } | { ok: false; error: string }> {
  const geocoded = await geocodeAddress(data.address);
  if (!geocoded) {
    return { ok: false, error: "주소를 찾을 수 없습니다. 다시 확인해주세요." };
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: false });
  if (!client) {
    return { ok: false, error: "인증 세션이 만료됐습니다. 다시 로그인해주세요." };
  }

  try {
    await client.setBikeNextCustomer(bikeId, {
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      address: data.address,
      latitude: geocoded.latitude,
      longitude: geocoded.longitude
    } satisfies BikeNextCustomerUpsertInput);
    return { ok: true, lat: geocoded.latitude, lng: geocoded.longitude };
  } catch {
    return { ok: false, error: "저장 중 오류가 발생했습니다. 다시 시도해주세요." };
  }
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd development/front-admin-web && npx tsc --noEmit 2>&1 | head -40
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add development/front-admin-web/app/actions.ts
git commit -m "feat: add getNextCustomerAction and setNextCustomerAction"
```

---

### Task 9: VehicleDetailDialog — NextCustomerSection

**Files:**
- Modify: `development/front-admin-web/components/management/VehicleDetailDialog.tsx`

- [ ] **Step 1: Add imports**

파일 상단의 import 블록에 추가:

```ts
import { getNextCustomerAction, setNextCustomerAction } from "@/app/actions";
```

`useState`, `useEffect`는 이미 React import에 포함돼 있을 것. 없으면 추가:

```ts
import { ..., useState, useEffect } from "react";
```

- [ ] **Step 2: Add NextCustomerSection component**

`DeliverySection` 함수 정의(line 805) 바로 아래, `renderPhaseLabel` 함수 위에 추가:

```tsx
// ============================================================================
// 다음 고객 섹션 (CLEANING 전용)
// ============================================================================

function NextCustomerSection({ bikeId }: { bikeId: string }) {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [address, setAddress] = useState("");
  const [savedCoords, setSavedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCustomerName("");
    setCustomerPhone("");
    setAddress("");
    setSavedCoords(null);
    setError(null);
    getNextCustomerAction(bikeId).then((data) => {
      if (data) {
        setCustomerName(data.customerName);
        setCustomerPhone(data.customerPhone);
        setAddress(data.address);
        setSavedCoords({ lat: data.latitude, lng: data.longitude });
      }
    });
  }, [bikeId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!customerName.trim() || !customerPhone.trim() || !address.trim()) {
      setError("모든 항목을 입력해주세요.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await setNextCustomerAction(bikeId, { customerName, customerPhone, address });
    setSaving(false);
    if (result.ok) {
      setSavedCoords({ lat: result.lat, lng: result.lng });
    } else {
      setError(result.error);
    }
  }

  return (
    <section className="delivery-section">
      <h4>🧹 다음 고객 <span className="muted" style={{ fontSize: "0.8em" }}>(CLEANING 전용)</span></h4>
      <form onSubmit={handleSave}>
        <dl className="delivery-meta">
          <div className="delivery-meta-row">
            <dt>고객 이름</dt>
            <dd>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="홍길동"
                className="next-customer-input"
              />
            </dd>
          </div>
          <div className="delivery-meta-row">
            <dt>전화번호</dt>
            <dd>
              <input
                type="text"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="010-1234-5678"
                className="next-customer-input"
              />
            </dd>
          </div>
          <div className="delivery-meta-row">
            <dt>주소</dt>
            <dd>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="서울 강남구 역삼동 123"
                className="next-customer-input"
              />
            </dd>
          </div>
          {savedCoords && (
            <div className="delivery-meta-row">
              <dt>좌표</dt>
              <dd style={{ color: "#4ade80" }}>
                ✓ {savedCoords.lat.toFixed(4)} / {savedCoords.lng.toFixed(4)}
              </dd>
            </div>
          )}
        </dl>
        {error && <p style={{ color: "#f87171", fontSize: "0.8em", margin: "4px 0" }}>{error}</p>}
        <button type="submit" disabled={saving} className="action-btn primary" style={{ marginTop: "6px" }}>
          {saving ? "저장 중…" : "저장"}
        </button>
      </form>
    </section>
  );
}
```

- [ ] **Step 3: Render NextCustomerSection in the dialog**

`DeliverySection` 렌더링 코드(line 195–198) 바로 아래에 조건부 렌더링 추가:

```tsx
          <DeliverySection
            bikeId={vehicleIdForFetch ?? null}
            state={simState}
          />
          {vehicle.serviceType === "CLEANING" && vehicleIdForFetch && (
            <NextCustomerSection bikeId={vehicleIdForFetch} />
          )}
```

- [ ] **Step 4: Add CSS for next-customer-input**

`globals.css` 또는 다이얼로그 CSS 파일에 추가. 기존 `.delivery-meta` input 스타일이 없다면:

```css
.next-customer-input {
  width: 100%;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 4px;
  color: #e2e8f0;
  font-size: 12px;
  padding: 4px 8px;
  outline: none;
}
.next-customer-input:focus {
  border-color: #3b82f6;
}
```

기존에 관련 스타일이 이미 있으면 중복 추가 금지. `globals.css`를 확인 후 없을 때만 추가.

- [ ] **Step 5: TypeScript check**

```bash
cd development/front-admin-web && npx tsc --noEmit 2>&1 | head -40
```
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add development/front-admin-web/components/management/VehicleDetailDialog.tsx
git add development/front-admin-web/app/globals.css  # if modified
git commit -m "feat: add NextCustomerSection to VehicleDetailDialog for CLEANING vehicles"
```

---

### Task 10: fleet-simulation.ts — nextCustomerDestination

**Files:**
- Modify: `development/front-admin-web/lib/services/fleet-simulation.ts`

- [ ] **Step 1: Add nextCustomerDestination to SimulatedBikeState**

현재 `routeWaypoints` 필드(line 43) 바로 아래에 추가:

```ts
  /** CLEANING 전용. 관리자가 설정한 다음 고객 좌표. null 이면 randomSeoulPoint() 사용. */
  nextCustomerDestination: { lat: number; lng: number } | null;
```

- [ ] **Step 2: Update advanceBikeState WORKING→MOVING case**

현재 (line 145):
```ts
      const destination = randomSeoulPoint(random);
```

Replace with:
```ts
      const destination = prev.nextCustomerDestination ?? randomSeoulPoint(random);
```

(나머지 return 블록은 `...prev` spread로 `nextCustomerDestination`이 자동 보존되므로 변경 불필요.)

- [ ] **Step 3: Update makeInitialState signature and return values**

현재 `makeInitialState` input 타입(line 187):
```ts
export function makeInitialState(input: {
  bikeId: string;
  origin: { lat: number; lng: number };
  nowMs: number;
  phase: "WORKING" | "MOVING";
  random?: () => number;
  initialOdometerKm?: number;
  initialBatteryPercent?: number;
  serviceType?: ServiceType;
}): SimulatedBikeState {
```

Add `nextCustomerDestination` parameter:
```ts
export function makeInitialState(input: {
  bikeId: string;
  origin: { lat: number; lng: number };
  nowMs: number;
  phase: "WORKING" | "MOVING";
  random?: () => number;
  initialOdometerKm?: number;
  initialBatteryPercent?: number;
  serviceType?: ServiceType;
  nextCustomerDestination?: { lat: number; lng: number } | null;
}): SimulatedBikeState {
  const {
    bikeId,
    origin,
    nowMs,
    phase,
    random = Math.random,
    initialOdometerKm = 0,
    initialBatteryPercent = 90,
    serviceType = "DELIVERY",
    nextCustomerDestination = null
  } = input;
```

MOVING phase return에서 `destination` 라인 수정:
```ts
      destination: nextCustomerDestination ?? randomSeoulPoint(random),
```

MOVING phase return에 `nextCustomerDestination` 필드 추가:
```ts
      nextCustomerDestination: nextCustomerDestination ?? null,
```

WORKING phase return에 `nextCustomerDestination` 필드 추가:
```ts
      nextCustomerDestination: nextCustomerDestination ?? null,
```

최종 MOVING 반환 블록 완성형:
```ts
  if (phase === "MOVING") {
    return {
      bikeId,
      phase: "MOVING",
      origin,
      destination: nextCustomerDestination ?? randomSeoulPoint(random),
      progress: 0,
      position: origin,
      phaseStartedAt: nowMs,
      phaseEndsAt: nowMs + randomMovingDurationMs(random),
      speedKph: MOVING_SPEED_KPH,
      ignitionStatus: "ON",
      ignitionOnAt: nowMs,
      odometerKm: initialOdometerKm,
      batteryPercent: initialBatteryPercent,
      routeWaypoints: null,
      deliveryCount: 0,
      serviceType,
      nextCustomerDestination: nextCustomerDestination ?? null
    };
  }
```

최종 WORKING 반환 블록 완성형:
```ts
  return {
    bikeId,
    phase: "WORKING",
    origin,
    destination: null,
    progress: 0,
    position: origin,
    phaseStartedAt: nowMs,
    phaseEndsAt: Number.POSITIVE_INFINITY,
    speedKph: 0,
    ignitionStatus: "OFF",
    ignitionOnAt: null,
    odometerKm: initialOdometerKm,
    batteryPercent: initialBatteryPercent,
    routeWaypoints: null,
    deliveryCount: 0,
    serviceType,
    nextCustomerDestination: nextCustomerDestination ?? null
  };
```

- [ ] **Step 4: TypeScript check**

```bash
cd development/front-admin-web && npx tsc --noEmit 2>&1 | head -40
```
Expected: no errors (또는 FleetSimulationContext 관련 오류만 - Task 11에서 해결)

- [ ] **Step 5: Commit**

```bash
git add development/front-admin-web/lib/services/fleet-simulation.ts
git commit -m "feat: add nextCustomerDestination to SimulatedBikeState and use it in WORKING→MOVING"
```

---

### Task 11: FleetSimulationContext.tsx — Sync + makeInitialState + Notification

**Files:**
- Modify: `development/front-admin-web/components/overview/FleetSimulationContext.tsx`

세 곳을 수정한다:
1. `makeInitialState` 호출 시 `nextCustomerDestination` 주입
2. 250ms tick loop에서 `nextCustomerDestination` 동기화
3. ignition 알림 시 `customerName`/`customerPhone` 포함

- [ ] **Step 1: Update makeInitialState call**

현재 (line 113–124):
```ts
        next.set(
          bikeId,
          makeInitialState({
            bikeId,
            origin,
            nowMs: nowMs - offsetMs,
            phase: "MOVING",
            initialBatteryPercent:
              typeof pin?.batteryPercent === "number" ? pin.batteryPercent : 90,
            serviceType: pin?.serviceType ?? "DELIVERY"
          })
        );
```

Replace with:
```ts
        next.set(
          bikeId,
          makeInitialState({
            bikeId,
            origin,
            nowMs: nowMs - offsetMs,
            phase: "MOVING",
            initialBatteryPercent:
              typeof pin?.batteryPercent === "number" ? pin.batteryPercent : 90,
            serviceType: pin?.serviceType ?? "DELIVERY",
            nextCustomerDestination:
              (pin?.serviceType === "CLEANING" &&
               pin.nextCustomerLat != null &&
               pin.nextCustomerLng != null)
                ? { lat: pin.nextCustomerLat, lng: pin.nextCustomerLng }
                : null
          })
        );
```

- [ ] **Step 2: Sync nextCustomerDestination in tick loop**

현재 tick loop 내부 (line 164–178):
```ts
        for (const [bikeId, state] of prev) {
          const isMatched = currentMatched.has(bikeId);
          const advanced = advanceBikeState(state, nowMs, isMatched);
          if (advanced !== state) mutated = true;
          if (
            !isMatched &&
            advanced.phase === "WORKING" &&
            advanced.phaseEndsAt === Number.POSITIVE_INFINITY
          ) {
            mutated = true;
            continue;
          }
          next.set(bikeId, advanced);
        }
```

Replace with:
```ts
        for (const [bikeId, state] of prev) {
          const isMatched = currentMatched.has(bikeId);
          const advanced = advanceBikeState(state, nowMs, isMatched);
          if (advanced !== state) mutated = true;
          if (
            !isMatched &&
            advanced.phase === "WORKING" &&
            advanced.phaseEndsAt === Number.POSITIVE_INFINITY
          ) {
            mutated = true;
            continue;
          }
          // Sync nextCustomerDestination from latest pin data (every 250ms)
          const pin = pinsRef.current.find((p) => p.bikeId === bikeId);
          const newDest =
            pin?.serviceType === "CLEANING" &&
            pin.nextCustomerLat != null &&
            pin.nextCustomerLng != null
              ? { lat: pin.nextCustomerLat, lng: pin.nextCustomerLng }
              : null;
          const prevDest = advanced.nextCustomerDestination;
          const destUnchanged =
            prevDest?.lat === newDest?.lat && prevDest?.lng === newDest?.lng;
          const entry: SimulatedBikeState = destUnchanged
            ? advanced
            : { ...advanced, nextCustomerDestination: newDest };
          if (!destUnchanged) mutated = true;
          next.set(bikeId, entry);
        }
```

- [ ] **Step 3: Update ignition notification to include customer info**

현재 (line 142):
```ts
      addNotification({ plateNumber, startedAt: state.ignitionOnAt });
```

Replace with:
```ts
      addNotification({
        plateNumber,
        startedAt: state.ignitionOnAt,
        customerName: pin?.nextCustomerName ?? undefined,
        customerPhone: pin?.nextCustomerPhone ?? undefined
      });
```

- [ ] **Step 4: TypeScript check**

```bash
cd development/front-admin-web && npx tsc --noEmit 2>&1 | head -40
```
Expected: no errors (NotificationContext 오류는 Task 12에서 해결)

- [ ] **Step 5: Commit**

```bash
git add development/front-admin-web/components/overview/FleetSimulationContext.tsx
git commit -m "feat: sync nextCustomerDestination in tick loop and pass customer info to notifications"
```

---

### Task 12: NotificationContext and NotificationBell

**Files:**
- Modify: `development/front-admin-web/components/layout/NotificationContext.tsx`
- Modify: `development/front-admin-web/components/layout/NotificationBell.tsx`

- [ ] **Step 1: Extend IgnitionNotification type**

`NotificationContext.tsx`에서 현재:
```ts
export type IgnitionNotification = {
  id: string;
  plateNumber: string;
  startedAt: number;
};
```

Replace with:
```ts
export type IgnitionNotification = {
  id: string;
  plateNumber: string;
  startedAt: number;
  /** CLEANING 차량 시동 ON 시 설정. 없으면 기존 "이동 시작" 알림 표시. */
  customerName?: string;
  customerPhone?: string;
};
```

- [ ] **Step 2: Update NotificationBell dropdown rendering**

`NotificationBell.tsx`에서 현재 (line 56–59):
```tsx
              <div key={n.id} className="notif-item" role="listitem">
                <span className="notif-item-text">🔑 {n.plateNumber} 이동 시작</span>
                <span className="notif-item-time">{formatRelativeTime(n.startedAt)}</span>
              </div>
```

Replace with:
```tsx
              <div key={n.id} className="notif-item" role="listitem">
                {n.customerName ? (
                  <>
                    <span className="notif-item-text">
                      📞 {n.plateNumber} → {n.customerName} {n.customerPhone}
                    </span>
                    <span className="notif-item-time">{formatRelativeTime(n.startedAt)}</span>
                  </>
                ) : (
                  <>
                    <span className="notif-item-text">🔑 {n.plateNumber} 이동 시작</span>
                    <span className="notif-item-time">{formatRelativeTime(n.startedAt)}</span>
                  </>
                )}
              </div>
```

- [ ] **Step 3: TypeScript check**

```bash
cd development/front-admin-web && npx tsc --noEmit 2>&1 | head -40
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add development/front-admin-web/components/layout/NotificationContext.tsx \
        development/front-admin-web/components/layout/NotificationBell.tsx
git commit -m "feat: show customer info in ignition notification bell for CLEANING vehicles"
```

---

### Task 13: Final Typecheck, Lint, and PR

**Files:** (no new files — verification only)

- [ ] **Step 1: Run full TypeScript check**

```bash
cd development/front-admin-web && npx tsc --noEmit 2>&1
```
Expected: no output (zero errors)

- [ ] **Step 2: Run ESLint**

```bash
cd development/front-admin-web && npx next lint 2>&1 | tail -20
```
Expected: no errors (warnings OK)

- [ ] **Step 3: Run backend tests**

```bash
cd development/service-ops-api && ./gradlew test -q 2>&1 | tail -20
```
Expected: BUILD SUCCESSFUL

- [ ] **Step 4: Verify build**

```bash
cd development/front-admin-web && npx next build 2>&1 | tail -30
```
Expected: Build complete, no errors

- [ ] **Step 5: Create PR**

```bash
gh pr create \
  --title "feat: CLEANING 차량 다음 고객 설정 + 시뮬레이션 연동" \
  --body "$(cat <<'EOF'
## Summary
- CLEANING 차량에 한해 관리자가 다음 고객(이름·전화·주소)을 VehicleDetailDialog에서 입력
- NCP 지오코딩(server action)으로 주소 → 좌표 변환 후 `bike_next_customer` DB에 저장
- 대시보드 API가 `bike_next_customer` LEFT JOIN으로 nextCustomer 필드 포함
- FleetSimulationContext tick loop(250ms)가 pin의 nextCustomerDestination을 동기화
- WORKING→MOVING 전환 시 고객 좌표를 목적지로 사용 (없으면 randomSeoulPoint 유지)
- 시동 ON 알림 벨: CLEANING + 고객 설정 → "📞 {번호판} → {이름} {전화}", 미설정 → "🔑 이동 시작"
- DELIVERY 차량 동작 변경 없음

## Test plan
- [ ] CLEANING 차량 클릭 → "다음 고객" 섹션 표시, 이름/전화/주소 입력 후 저장 → 좌표 표시
- [ ] 주소 오타 입력 → "주소를 찾을 수 없습니다" 에러 표시
- [ ] DELIVERY 차량 클릭 → "다음 고객" 섹션 미표시
- [ ] 저장 후 시뮬레이션 WORKING→MOVING 전환 시 고객 좌표로 이동
- [ ] 시동 ON 벨 알림: CLEANING + 고객 설정 → 📞 형식, 미설정 → 🔑 형식
- [ ] backend: BikeNextCustomerApiContractTests 5건 통과

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

### Spec Coverage Checklist

| 요구사항 | 구현 Task |
|---------|-----------|
| `bike_next_customer` 테이블 생성 | Task 1 |
| BikeNextCustomer 엔티티 + repository | Task 2 |
| GET `/api/v1/bikes/{id}/next-customer` | Task 3, 4 |
| PUT `/api/v1/bikes/{id}/next-customer` | Task 3, 4 |
| CLEANING 타입 guard (GET/PUT 모두) | Task 3 |
| 대시보드 API에 serviceType + nextCustomer* 포함 | Task 5 |
| 계약 테스트 (GET 404, PUT round-trip, upsert, 배달 reject, 빈값 validation) | Task 6 |
| 프론트엔드 타입 확장 | Task 7 |
| NCP 지오코딩 server action | Task 8 |
| VehicleDetailDialog NextCustomerSection (CLEANING 전용) | Task 9 |
| `SimulatedBikeState.nextCustomerDestination` | Task 10 |
| `advanceBikeState` WORKING→MOVING destination 우선순위 | Task 10 |
| `makeInitialState` nextCustomerDestination 파라미터 | Task 10 |
| FleetSimulationContext tick loop 동기화 | Task 11 |
| FleetSimulationContext makeInitialState 주입 | Task 11 |
| 알림에 customerName/Phone 포함 | Task 11 |
| IgnitionNotification 타입 확장 | Task 12 |
| NotificationBell 조건부 표시 | Task 12 |
| DELIVERY 차량 동작 변경 없음 | Task 10 (null guard), Task 9 (CLEANING 조건) |
| 지오코딩 실패 에러 처리 | Task 8, 9 |

### Placeholder Scan
없음 — 모든 코드 블록이 완성됨.

### Type Consistency
- `SimulatedBikeState.nextCustomerDestination: { lat: number; lng: number } | null` — Task 10에서 정의, Task 11에서 사용 ✓
- `FrontendDashboardBikePin.nextCustomerLat: number | null` — Task 7에서 정의, Task 11에서 `pin.nextCustomerLat != null` 체크 ✓
- `IgnitionNotification.customerName?: string` — Task 12에서 정의, Task 11에서 `pin?.nextCustomerName ?? undefined` 전달 ✓
- `BikeNextCustomerUpsertInput` — Task 7에서 정의, Task 8에서 `satisfies` 사용 ✓
