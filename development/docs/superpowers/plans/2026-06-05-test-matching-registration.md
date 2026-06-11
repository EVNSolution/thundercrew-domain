# Test-Matching Registration Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/test-matching` admin page where operators can register test vehicles and riders, create vehicle-rider matchings with real-time validation, and download Excel exports — using a separate test DB schema that will be merged into production later.

**Architecture:** Spring Boot backend adds a `testmatching` package with three sub-slices (vehicle/rider/matching) backed by new tables (`test_vehicles`, `test_riders`, `test_matchings`). Matching validation is computed at read time (not stored). The Next.js frontend page uses server components + server actions; each section renders a table + inline add-form that submits to a server action and revalidates the page. Excel export is served via a Next.js API-route proxy that forwards the Bearer token.

**Tech Stack:** Java 21, Spring Boot 3.5, Spring Data JPA, Flyway, PostgreSQL, Apache POI 5.3.0, Next.js (App Router), TypeScript, Server Actions.

---

## File Structure

```
service-ops-api/
  build.gradle.kts                                           (modify: add POI)
  src/main/resources/db/migration/
    V29__create_test_matching_tables.sql                     (new)
  src/main/java/com/thundercrew/opsapi/testmatching/
    vehicle/
      domain/  TestVehicle.java  TestBikeType.java  TestEngineType.java
      repository/  TestVehicleRepository.java
      dto/  TestVehicleCreateRequest.java  TestVehicleReadResponse.java
      service/  TestVehicleCommandService.java  TestVehicleReadService.java
      controller/  TestVehicleCommandController.java  TestVehicleReadController.java
    rider/
      domain/  TestRider.java  TestTrainingStatus.java
      repository/  TestRiderRepository.java
      dto/  TestRiderCreateRequest.java  TestRiderReadResponse.java
      service/  TestRiderCommandService.java  TestRiderReadService.java
      controller/  TestRiderCommandController.java  TestRiderReadController.java
    matching/
      domain/  TestMatching.java  TestServiceType.java  TestContractType.java
               TestHandoverType.java  TestValidationStatus.java
      repository/  TestMatchingRepository.java
      dto/  TestMatchingCreateRequest.java  TestMatchingReadResponse.java
      service/  TestMatchingCommandService.java  TestMatchingReadService.java
      controller/  TestMatchingCommandController.java  TestMatchingReadController.java
    excel/
      TestMatchingExcelService.java
      TestMatchingExcelController.java

front-admin-web/
  lib/services/
    service-ops-api.ts        (modify: add test-matching types + methods)
    test-matching-data.ts     (new)
  app/
    test-matching/
      page.tsx                (new)
      actions.ts              (new)
      test-matching.css       (new)
    api/test-matching/
      export/[type]/route.ts  (new: Excel proxy)
  components/test-matching/
    VehicleSection.tsx        (new)
    RiderSection.tsx          (new)
    MatchingSection.tsx       (new)
```

---

## Task 1: DB Migration + Apache POI Dependency

**Files:**
- Modify: `service-ops-api/build.gradle.kts`
- Create: `service-ops-api/src/main/resources/db/migration/V29__create_test_matching_tables.sql`

- [ ] **Step 1: Add Apache POI to build.gradle.kts**

Open `service-ops-api/build.gradle.kts`. In the `dependencies { }` block, add after the last `implementation(...)` line:

```kotlin
	implementation("org.apache.poi:poi-ooxml:5.3.0")
```

The `dependencies` block should now end with:
```kotlin
	implementation("org.apache.poi:poi-ooxml:5.3.0")
	runtimeOnly("org.postgresql:postgresql")
	testImplementation(...)
```

- [ ] **Step 2: Write the Flyway migration SQL**

Create `service-ops-api/src/main/resources/db/migration/V29__create_test_matching_tables.sql`:

```sql
-- 차량·라이더 매칭 테스트용 분리 스키마 (추후 production 테이블과 합칠 예정)

CREATE TABLE test_vehicles (
    id          UUID             NOT NULL PRIMARY KEY,
    idx         BIGSERIAL        NOT NULL UNIQUE,
    plate_number VARCHAR(50)     NOT NULL,
    bike_type   VARCHAR(20)      NOT NULL,
    engine_type VARCHAR(20)      NOT NULL,
    imei        VARCHAR(15),
    created_at  TIMESTAMPTZ      NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ      NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ,
    created_by  UUID,
    updated_by  UUID,
    deleted_by  UUID
);

CREATE UNIQUE INDEX ux_test_vehicles_plate_number_active
    ON test_vehicles(plate_number) WHERE deleted_at IS NULL;

CREATE TABLE test_riders (
    id                 UUID         NOT NULL PRIMARY KEY,
    idx                BIGSERIAL    NOT NULL UNIQUE,
    name               VARCHAR(100) NOT NULL,
    phone_number       VARCHAR(30)  NOT NULL,
    training_completed BOOLEAN      NOT NULL DEFAULT false,
    team_name          VARCHAR(100),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ,
    created_by  UUID,
    updated_by  UUID,
    deleted_by  UUID
);

CREATE UNIQUE INDEX ux_test_riders_phone_number_active
    ON test_riders(phone_number) WHERE deleted_at IS NULL;

-- 매칭에는 중복 unique 제약 없음 — 의도적으로 중복을 허용해 validation 표시를 테스트함
CREATE TABLE test_matchings (
    id              UUID         NOT NULL PRIMARY KEY,
    idx             BIGSERIAL    NOT NULL UNIQUE,
    test_vehicle_id UUID         NOT NULL REFERENCES test_vehicles(id),
    service_type    VARCHAR(30)  NOT NULL,
    test_rider_id   UUID         NOT NULL REFERENCES test_riders(id),
    contract_type   VARCHAR(20)  NOT NULL,
    handover_type   VARCHAR(20)  NOT NULL,
    start_date      DATE         NOT NULL,
    end_date        DATE         NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ,
    created_by  UUID,
    updated_by  UUID,
    deleted_by  UUID
);
```

- [ ] **Step 3: Compile to verify dependency resolves**

Run from `service-ops-api/`:
```bash
./gradlew compileJava
```
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 4: Commit**

```bash
git add service-ops-api/build.gradle.kts \
        service-ops-api/src/main/resources/db/migration/V29__create_test_matching_tables.sql
git commit -m "feat: add test-matching schema (V29) and Apache POI dependency"
```

---

## Task 2: TestVehicle Backend Slice

**Files:**
- Create: `service-ops-api/src/main/java/com/thundercrew/opsapi/testmatching/vehicle/domain/TestBikeType.java`
- Create: `service-ops-api/src/main/java/com/thundercrew/opsapi/testmatching/vehicle/domain/TestEngineType.java`
- Create: `service-ops-api/src/main/java/com/thundercrew/opsapi/testmatching/vehicle/domain/TestVehicle.java`
- Create: `service-ops-api/src/main/java/com/thundercrew/opsapi/testmatching/vehicle/repository/TestVehicleRepository.java`
- Create: `service-ops-api/src/main/java/com/thundercrew/opsapi/testmatching/vehicle/dto/TestVehicleCreateRequest.java`
- Create: `service-ops-api/src/main/java/com/thundercrew/opsapi/testmatching/vehicle/dto/TestVehicleReadResponse.java`
- Create: `service-ops-api/src/main/java/com/thundercrew/opsapi/testmatching/vehicle/service/TestVehicleCommandService.java`
- Create: `service-ops-api/src/main/java/com/thundercrew/opsapi/testmatching/vehicle/service/TestVehicleReadService.java`
- Create: `service-ops-api/src/main/java/com/thundercrew/opsapi/testmatching/vehicle/controller/TestVehicleCommandController.java`
- Create: `service-ops-api/src/main/java/com/thundercrew/opsapi/testmatching/vehicle/controller/TestVehicleReadController.java`

- [ ] **Step 1: Write domain enums**

`TestBikeType.java`:
```java
package com.thundercrew.opsapi.testmatching.vehicle.domain;

public enum TestBikeType {
    TWO_WHEEL, FOUR_WHEEL
}
```

`TestEngineType.java`:
```java
package com.thundercrew.opsapi.testmatching.vehicle.domain;

public enum TestEngineType {
    ELECTRIC, ICE
}
```

- [ ] **Step 2: Write TestVehicle entity**

`TestVehicle.java`:
```java
package com.thundercrew.opsapi.testmatching.vehicle.domain;

import com.thundercrew.opsapi.common.domain.DisplaySequencedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

@Entity
@Table(name = "test_vehicles")
public class TestVehicle extends DisplaySequencedEntity {

    @Column(nullable = false, length = 50)
    private String plateNumber;

    @Enumerated(EnumType.STRING)
    @Column(name = "bike_type", nullable = false, length = 20)
    private TestBikeType bikeType;

    @Enumerated(EnumType.STRING)
    @Column(name = "engine_type", nullable = false, length = 20)
    private TestEngineType engineType;

    @Column(length = 15)
    private String imei;

    public static TestVehicle create(
            String plateNumber, TestBikeType bikeType, TestEngineType engineType, String imei) {
        TestVehicle v = new TestVehicle();
        v.plateNumber = plateNumber;
        v.bikeType = bikeType;
        v.engineType = engineType;
        v.imei = imei;
        return v;
    }

    public String getPlateNumber() { return plateNumber; }
    public TestBikeType getBikeType() { return bikeType; }
    public TestEngineType getEngineType() { return engineType; }
    public String getImei() { return imei; }

    protected TestVehicle() {}
}
```

- [ ] **Step 3: Write repository + DTOs**

`TestVehicleRepository.java`:
```java
package com.thundercrew.opsapi.testmatching.vehicle.repository;

import com.thundercrew.opsapi.testmatching.vehicle.domain.TestVehicle;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TestVehicleRepository extends JpaRepository<TestVehicle, UUID> {
    Optional<TestVehicle> findByIdAndDeletedAtIsNull(UUID id);
    List<TestVehicle> findAllByDeletedAtIsNullOrderByIdxAsc();
    boolean existsByPlateNumberAndDeletedAtIsNull(String plateNumber);
}
```

`TestVehicleCreateRequest.java`:
```java
package com.thundercrew.opsapi.testmatching.vehicle.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.thundercrew.opsapi.testmatching.vehicle.domain.TestBikeType;
import com.thundercrew.opsapi.testmatching.vehicle.domain.TestEngineType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@JsonIgnoreProperties(ignoreUnknown = true)
public record TestVehicleCreateRequest(
        @NotBlank @Size(max = 50) String plateNumber,
        @NotNull TestBikeType bikeType,
        @NotNull TestEngineType engineType,
        @Size(min = 15, max = 15) @Pattern(regexp = "\\d{15}", message = "IMEI는 15자리 숫자여야 합니다") String imei
) {}
```

`TestVehicleReadResponse.java`:
```java
package com.thundercrew.opsapi.testmatching.vehicle.dto;

import com.thundercrew.opsapi.testmatching.vehicle.domain.TestBikeType;
import com.thundercrew.opsapi.testmatching.vehicle.domain.TestEngineType;
import com.thundercrew.opsapi.testmatching.vehicle.domain.TestVehicle;
import java.time.Instant;
import java.util.UUID;

public record TestVehicleReadResponse(
        UUID id, Long idx, String plateNumber,
        TestBikeType bikeType, TestEngineType engineType, String imei,
        Instant createdAt, Instant updatedAt
) {
    public static TestVehicleReadResponse from(TestVehicle v) {
        return new TestVehicleReadResponse(
                v.getId(), v.getIdx(), v.getPlateNumber(),
                v.getBikeType(), v.getEngineType(), v.getImei(),
                v.getCreatedAt(), v.getUpdatedAt());
    }
}
```

- [ ] **Step 4: Write services**

`TestVehicleCommandService.java`:
```java
package com.thundercrew.opsapi.testmatching.vehicle.service;

import com.thundercrew.opsapi.common.api.DuplicateActiveResourceException;
import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import com.thundercrew.opsapi.testmatching.vehicle.domain.TestVehicle;
import com.thundercrew.opsapi.testmatching.vehicle.dto.TestVehicleCreateRequest;
import com.thundercrew.opsapi.testmatching.vehicle.dto.TestVehicleReadResponse;
import com.thundercrew.opsapi.testmatching.vehicle.repository.TestVehicleRepository;
import jakarta.persistence.EntityManager;
import java.time.Clock;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TestVehicleCommandService {

    private final TestVehicleRepository repo;
    private final EntityManager em;
    private final Clock clock;

    public TestVehicleCommandService(TestVehicleRepository repo, EntityManager em, Clock clock) {
        this.repo = repo;
        this.em = em;
        this.clock = clock;
    }

    @Transactional
    public TestVehicleReadResponse create(TestVehicleCreateRequest request) {
        if (repo.existsByPlateNumberAndDeletedAtIsNull(request.plateNumber())) {
            throw new DuplicateActiveResourceException("TestVehicle", "plateNumber");
        }
        String imei = (request.imei() != null && !request.imei().isBlank()) ? request.imei() : null;
        TestVehicle saved = repo.save(
                TestVehicle.create(request.plateNumber(), request.bikeType(), request.engineType(), imei));
        try {
            em.flush();
            em.refresh(saved);
        } catch (DataIntegrityViolationException e) {
            throw new DuplicateActiveResourceException("TestVehicle", "plateNumber");
        }
        return TestVehicleReadResponse.from(saved);
    }

    @Transactional
    public void delete(UUID id) {
        TestVehicle v = repo.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("TestVehicle", id));
        v.markDeleted(null, clock.instant());
    }
}
```

`TestVehicleReadService.java`:
```java
package com.thundercrew.opsapi.testmatching.vehicle.service;

import com.thundercrew.opsapi.testmatching.vehicle.dto.TestVehicleReadResponse;
import com.thundercrew.opsapi.testmatching.vehicle.repository.TestVehicleRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TestVehicleReadService {

    private final TestVehicleRepository repo;

    public TestVehicleReadService(TestVehicleRepository repo) {
        this.repo = repo;
    }

    @Transactional(readOnly = true)
    public List<TestVehicleReadResponse> listAll() {
        return repo.findAllByDeletedAtIsNullOrderByIdxAsc()
                .stream().map(TestVehicleReadResponse::from).toList();
    }
}
```

- [ ] **Step 5: Write controllers**

`TestVehicleCommandController.java`:
```java
package com.thundercrew.opsapi.testmatching.vehicle.controller;

import com.thundercrew.opsapi.testmatching.vehicle.dto.TestVehicleCreateRequest;
import com.thundercrew.opsapi.testmatching.vehicle.dto.TestVehicleReadResponse;
import com.thundercrew.opsapi.testmatching.vehicle.service.TestVehicleCommandService;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/test-matching/vehicles")
public class TestVehicleCommandController {

    private final TestVehicleCommandService service;

    public TestVehicleCommandController(TestVehicleCommandService service) {
        this.service = service;
    }

    @PostMapping
    ResponseEntity<TestVehicleReadResponse> create(@Valid @RequestBody TestVehicleCreateRequest request) {
        TestVehicleReadResponse response = service.create(request);
        return ResponseEntity.created(URI.create("/api/v1/test-matching/vehicles/" + response.id()))
                .body(response);
    }

    @DeleteMapping("/{id}")
    ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
```

`TestVehicleReadController.java`:
```java
package com.thundercrew.opsapi.testmatching.vehicle.controller;

import com.thundercrew.opsapi.testmatching.vehicle.dto.TestVehicleReadResponse;
import com.thundercrew.opsapi.testmatching.vehicle.service.TestVehicleReadService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/test-matching/vehicles")
public class TestVehicleReadController {

    private final TestVehicleReadService service;

    public TestVehicleReadController(TestVehicleReadService service) {
        this.service = service;
    }

    @GetMapping
    List<TestVehicleReadResponse> listAll() {
        return service.listAll();
    }
}
```

- [ ] **Step 6: Compile**

```bash
cd service-ops-api && ./gradlew compileJava
```
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 7: Commit**

```bash
git add service-ops-api/src/main/java/com/thundercrew/opsapi/testmatching/vehicle/
git commit -m "feat: add TestVehicle backend slice (entity, repo, service, controller)"
```

---

## Task 3: TestRider Backend Slice

**Files:**
- Create: `...testmatching/rider/domain/TestTrainingStatus.java`
- Create: `...testmatching/rider/domain/TestRider.java`
- Create: `...testmatching/rider/repository/TestRiderRepository.java`
- Create: `...testmatching/rider/dto/TestRiderCreateRequest.java`
- Create: `...testmatching/rider/dto/TestRiderReadResponse.java`
- Create: `...testmatching/rider/service/TestRiderCommandService.java`
- Create: `...testmatching/rider/service/TestRiderReadService.java`
- Create: `...testmatching/rider/controller/TestRiderCommandController.java`
- Create: `...testmatching/rider/controller/TestRiderReadController.java`

Base path for all: `service-ops-api/src/main/java/com/thundercrew/opsapi/testmatching/rider/`

- [ ] **Step 1: Write enum + entity**

`domain/TestTrainingStatus.java`:
```java
package com.thundercrew.opsapi.testmatching.rider.domain;

public enum TestTrainingStatus {
    COMPLETED, INCOMPLETE
}
```

`domain/TestRider.java`:
```java
package com.thundercrew.opsapi.testmatching.rider.domain;

import com.thundercrew.opsapi.common.domain.DisplaySequencedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "test_riders")
public class TestRider extends DisplaySequencedEntity {

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, length = 30)
    private String phoneNumber;

    @Column(nullable = false)
    private boolean trainingCompleted;

    @Column(length = 100)
    private String teamName;

    public static TestRider create(
            String name, String phoneNumber, boolean trainingCompleted, String teamName) {
        TestRider r = new TestRider();
        r.name = name;
        r.phoneNumber = phoneNumber;
        r.trainingCompleted = trainingCompleted;
        r.teamName = teamName;
        return r;
    }

    public String getName() { return name; }
    public String getPhoneNumber() { return phoneNumber; }
    public boolean isTrainingCompleted() { return trainingCompleted; }
    public String getTeamName() { return teamName; }

    protected TestRider() {}
}
```

- [ ] **Step 2: Write repository + DTOs**

`repository/TestRiderRepository.java`:
```java
package com.thundercrew.opsapi.testmatching.rider.repository;

import com.thundercrew.opsapi.testmatching.rider.domain.TestRider;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TestRiderRepository extends JpaRepository<TestRider, UUID> {
    Optional<TestRider> findByIdAndDeletedAtIsNull(UUID id);
    List<TestRider> findAllByDeletedAtIsNullOrderByIdxAsc();
    boolean existsByPhoneNumberAndDeletedAtIsNull(String phoneNumber);
}
```

`dto/TestRiderCreateRequest.java`:
```java
package com.thundercrew.opsapi.testmatching.rider.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@JsonIgnoreProperties(ignoreUnknown = true)
public record TestRiderCreateRequest(
        @NotBlank @Size(max = 100) String name,
        @NotBlank @Pattern(regexp = "010-\\d{4}-\\d{4}", message = "연락처 형식: 010-XXXX-XXXX") String phoneNumber,
        @NotNull Boolean trainingCompleted,
        @Size(max = 100) String teamName
) {}
```

`dto/TestRiderReadResponse.java`:
```java
package com.thundercrew.opsapi.testmatching.rider.dto;

import com.thundercrew.opsapi.testmatching.rider.domain.TestRider;
import java.time.Instant;
import java.util.UUID;

public record TestRiderReadResponse(
        UUID id, Long idx, String name, String phoneNumber,
        boolean trainingCompleted, String teamName,
        Instant createdAt, Instant updatedAt
) {
    public static TestRiderReadResponse from(TestRider r) {
        return new TestRiderReadResponse(
                r.getId(), r.getIdx(), r.getName(), r.getPhoneNumber(),
                r.isTrainingCompleted(), r.getTeamName(),
                r.getCreatedAt(), r.getUpdatedAt());
    }
}
```

- [ ] **Step 3: Write services**

`service/TestRiderCommandService.java`:
```java
package com.thundercrew.opsapi.testmatching.rider.service;

import com.thundercrew.opsapi.common.api.DuplicateActiveResourceException;
import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import com.thundercrew.opsapi.testmatching.rider.domain.TestRider;
import com.thundercrew.opsapi.testmatching.rider.dto.TestRiderCreateRequest;
import com.thundercrew.opsapi.testmatching.rider.dto.TestRiderReadResponse;
import com.thundercrew.opsapi.testmatching.rider.repository.TestRiderRepository;
import jakarta.persistence.EntityManager;
import java.time.Clock;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TestRiderCommandService {

    private final TestRiderRepository repo;
    private final EntityManager em;
    private final Clock clock;

    public TestRiderCommandService(TestRiderRepository repo, EntityManager em, Clock clock) {
        this.repo = repo;
        this.em = em;
        this.clock = clock;
    }

    @Transactional
    public TestRiderReadResponse create(TestRiderCreateRequest request) {
        if (repo.existsByPhoneNumberAndDeletedAtIsNull(request.phoneNumber())) {
            throw new DuplicateActiveResourceException("TestRider", "phoneNumber");
        }
        String teamName = (request.teamName() != null && !request.teamName().isBlank())
                ? request.teamName() : null;
        TestRider saved = repo.save(
                TestRider.create(request.name(), request.phoneNumber(),
                        Boolean.TRUE.equals(request.trainingCompleted()), teamName));
        try {
            em.flush();
            em.refresh(saved);
        } catch (DataIntegrityViolationException e) {
            throw new DuplicateActiveResourceException("TestRider", "phoneNumber");
        }
        return TestRiderReadResponse.from(saved);
    }

    @Transactional
    public void delete(UUID id) {
        TestRider r = repo.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("TestRider", id));
        r.markDeleted(null, clock.instant());
    }
}
```

`service/TestRiderReadService.java`:
```java
package com.thundercrew.opsapi.testmatching.rider.service;

import com.thundercrew.opsapi.testmatching.rider.dto.TestRiderReadResponse;
import com.thundercrew.opsapi.testmatching.rider.repository.TestRiderRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TestRiderReadService {

    private final TestRiderRepository repo;

    public TestRiderReadService(TestRiderRepository repo) {
        this.repo = repo;
    }

    @Transactional(readOnly = true)
    public List<TestRiderReadResponse> listAll() {
        return repo.findAllByDeletedAtIsNullOrderByIdxAsc()
                .stream().map(TestRiderReadResponse::from).toList();
    }
}
```

- [ ] **Step 4: Write controllers**

`controller/TestRiderCommandController.java`:
```java
package com.thundercrew.opsapi.testmatching.rider.controller;

import com.thundercrew.opsapi.testmatching.rider.dto.TestRiderCreateRequest;
import com.thundercrew.opsapi.testmatching.rider.dto.TestRiderReadResponse;
import com.thundercrew.opsapi.testmatching.rider.service.TestRiderCommandService;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/test-matching/riders")
public class TestRiderCommandController {

    private final TestRiderCommandService service;

    public TestRiderCommandController(TestRiderCommandService service) {
        this.service = service;
    }

    @PostMapping
    ResponseEntity<TestRiderReadResponse> create(@Valid @RequestBody TestRiderCreateRequest request) {
        TestRiderReadResponse response = service.create(request);
        return ResponseEntity.created(URI.create("/api/v1/test-matching/riders/" + response.id()))
                .body(response);
    }

    @DeleteMapping("/{id}")
    ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
```

`controller/TestRiderReadController.java`:
```java
package com.thundercrew.opsapi.testmatching.rider.controller;

import com.thundercrew.opsapi.testmatching.rider.dto.TestRiderReadResponse;
import com.thundercrew.opsapi.testmatching.rider.service.TestRiderReadService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/test-matching/riders")
public class TestRiderReadController {

    private final TestRiderReadService service;

    public TestRiderReadController(TestRiderReadService service) {
        this.service = service;
    }

    @GetMapping
    List<TestRiderReadResponse> listAll() {
        return service.listAll();
    }
}
```

- [ ] **Step 5: Compile + commit**

```bash
cd service-ops-api && ./gradlew compileJava
git add service-ops-api/src/main/java/com/thundercrew/opsapi/testmatching/rider/
git commit -m "feat: add TestRider backend slice"
```

---

## Task 4: TestMatching Backend Slice with Validation

**Files:**
- Create all files under `...testmatching/matching/`

Base path: `service-ops-api/src/main/java/com/thundercrew/opsapi/testmatching/matching/`

- [ ] **Step 1: Write domain enums**

`domain/TestServiceType.java`:
```java
package com.thundercrew.opsapi.testmatching.matching.domain;

public enum TestServiceType {
    CALL_DELIVERY,        // 콜배송
    DESIGNATED_DELIVERY,  // 지정배송
    COLLECTION_CARE,      // 수거케어
    BATCH_COLLECTION      // 일괄수거
}
```

`domain/TestContractType.java`:
```java
package com.thundercrew.opsapi.testmatching.matching.domain;

public enum TestContractType {
    SUBSCRIPTION, // 구독
    RENTAL        // 렌탈
}
```

`domain/TestHandoverType.java`:
```java
package com.thundercrew.opsapi.testmatching.matching.domain;

public enum TestHandoverType {
    TAKEOVER, // 인수형
    RETURN    // 반납형
}
```

`domain/TestValidationStatus.java`:
```java
package com.thundercrew.opsapi.testmatching.matching.domain;

public enum TestValidationStatus {
    VALID, INVALID
}
```

- [ ] **Step 2: Write TestMatching entity**

`domain/TestMatching.java`:
```java
package com.thundercrew.opsapi.testmatching.matching.domain;

import com.thundercrew.opsapi.common.domain.DisplaySequencedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "test_matchings")
public class TestMatching extends DisplaySequencedEntity {

    @Column(name = "test_vehicle_id", nullable = false)
    private UUID testVehicleId;

    @Enumerated(EnumType.STRING)
    @Column(name = "service_type", nullable = false, length = 30)
    private TestServiceType serviceType;

    @Column(name = "test_rider_id", nullable = false)
    private UUID testRiderId;

    @Enumerated(EnumType.STRING)
    @Column(name = "contract_type", nullable = false, length = 20)
    private TestContractType contractType;

    @Enumerated(EnumType.STRING)
    @Column(name = "handover_type", nullable = false, length = 20)
    private TestHandoverType handoverType;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    public static TestMatching create(
            UUID testVehicleId, TestServiceType serviceType, UUID testRiderId,
            TestContractType contractType, TestHandoverType handoverType,
            LocalDate startDate, LocalDate endDate) {
        TestMatching m = new TestMatching();
        m.testVehicleId = testVehicleId;
        m.serviceType = serviceType;
        m.testRiderId = testRiderId;
        m.contractType = contractType;
        m.handoverType = handoverType;
        m.startDate = startDate;
        m.endDate = endDate;
        return m;
    }

    public UUID getTestVehicleId() { return testVehicleId; }
    public TestServiceType getServiceType() { return serviceType; }
    public UUID getTestRiderId() { return testRiderId; }
    public TestContractType getContractType() { return contractType; }
    public TestHandoverType getHandoverType() { return handoverType; }
    public LocalDate getStartDate() { return startDate; }
    public LocalDate getEndDate() { return endDate; }

    protected TestMatching() {}
}
```

- [ ] **Step 3: Write repository + DTOs**

`repository/TestMatchingRepository.java`:
```java
package com.thundercrew.opsapi.testmatching.matching.repository;

import com.thundercrew.opsapi.testmatching.matching.domain.TestMatching;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TestMatchingRepository extends JpaRepository<TestMatching, UUID> {
    Optional<TestMatching> findByIdAndDeletedAtIsNull(UUID id);
    List<TestMatching> findAllByDeletedAtIsNullOrderByIdxAsc();
}
```

`dto/TestMatchingCreateRequest.java`:
```java
package com.thundercrew.opsapi.testmatching.matching.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.thundercrew.opsapi.testmatching.matching.domain.TestContractType;
import com.thundercrew.opsapi.testmatching.matching.domain.TestHandoverType;
import com.thundercrew.opsapi.testmatching.matching.domain.TestServiceType;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.UUID;

@JsonIgnoreProperties(ignoreUnknown = true)
public record TestMatchingCreateRequest(
        @NotNull UUID testVehicleId,
        @NotNull TestServiceType serviceType,
        @NotNull UUID testRiderId,
        @NotNull TestContractType contractType,
        @NotNull TestHandoverType handoverType,
        @NotNull @JsonFormat(pattern = "yyyy-MM-dd") LocalDate startDate,
        @NotNull @JsonFormat(pattern = "yyyy-MM-dd") LocalDate endDate
) {
    @AssertTrue(message = "시작일은 종료일보다 이전이어야 합니다")
    boolean isDateRangeValid() {
        return startDate == null || endDate == null || startDate.isBefore(endDate);
    }
}
```

`dto/TestMatchingReadResponse.java`:
```java
package com.thundercrew.opsapi.testmatching.matching.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.thundercrew.opsapi.testmatching.matching.domain.TestContractType;
import com.thundercrew.opsapi.testmatching.matching.domain.TestHandoverType;
import com.thundercrew.opsapi.testmatching.matching.domain.TestMatching;
import com.thundercrew.opsapi.testmatching.matching.domain.TestServiceType;
import com.thundercrew.opsapi.testmatching.matching.domain.TestValidationStatus;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record TestMatchingReadResponse(
        UUID id,
        Long idx,
        UUID testVehicleId,
        String plateNumber,
        TestServiceType serviceType,
        UUID testRiderId,
        String riderName,
        String phoneNumber,
        TestContractType contractType,
        TestHandoverType handoverType,
        @JsonFormat(pattern = "yyyy-MM-dd") LocalDate startDate,
        @JsonFormat(pattern = "yyyy-MM-dd") LocalDate endDate,
        TestValidationStatus validationStatus,
        String validationMessage,
        Instant createdAt,
        Instant updatedAt
) {
    public static TestMatchingReadResponse of(
            TestMatching m,
            String plateNumber, String riderName, String phoneNumber,
            TestValidationStatus status, String message) {
        return new TestMatchingReadResponse(
                m.getId(), m.getIdx(), m.getTestVehicleId(), plateNumber,
                m.getServiceType(), m.getTestRiderId(), riderName, phoneNumber,
                m.getContractType(), m.getHandoverType(),
                m.getStartDate(), m.getEndDate(),
                status, message,
                m.getCreatedAt(), m.getUpdatedAt());
    }
}
```

- [ ] **Step 4: Write TestMatchingCommandService**

`service/TestMatchingCommandService.java`:
```java
package com.thundercrew.opsapi.testmatching.matching.service;

import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import com.thundercrew.opsapi.testmatching.matching.domain.TestMatching;
import com.thundercrew.opsapi.testmatching.matching.dto.TestMatchingCreateRequest;
import com.thundercrew.opsapi.testmatching.matching.dto.TestMatchingReadResponse;
import com.thundercrew.opsapi.testmatching.matching.repository.TestMatchingRepository;
import com.thundercrew.opsapi.testmatching.vehicle.repository.TestVehicleRepository;
import com.thundercrew.opsapi.testmatching.rider.repository.TestRiderRepository;
import jakarta.persistence.EntityManager;
import java.time.Clock;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TestMatchingCommandService {

    private final TestMatchingRepository matchingRepo;
    private final TestVehicleRepository vehicleRepo;
    private final TestRiderRepository riderRepo;
    private final TestMatchingReadService readService;
    private final EntityManager em;
    private final Clock clock;

    public TestMatchingCommandService(
            TestMatchingRepository matchingRepo,
            TestVehicleRepository vehicleRepo,
            TestRiderRepository riderRepo,
            TestMatchingReadService readService,
            EntityManager em,
            Clock clock) {
        this.matchingRepo = matchingRepo;
        this.vehicleRepo = vehicleRepo;
        this.riderRepo = riderRepo;
        this.readService = readService;
        this.em = em;
        this.clock = clock;
    }

    @Transactional
    public TestMatchingReadResponse create(TestMatchingCreateRequest request) {
        // Verify vehicle and rider exist (soft-delete aware)
        if (vehicleRepo.findByIdAndDeletedAtIsNull(request.testVehicleId()).isEmpty()) {
            throw new ResourceNotFoundException("TestVehicle", request.testVehicleId());
        }
        if (riderRepo.findByIdAndDeletedAtIsNull(request.testRiderId()).isEmpty()) {
            throw new ResourceNotFoundException("TestRider", request.testRiderId());
        }
        TestMatching saved = matchingRepo.save(TestMatching.create(
                request.testVehicleId(), request.serviceType(), request.testRiderId(),
                request.contractType(), request.handoverType(),
                request.startDate(), request.endDate()));
        em.flush();
        em.refresh(saved);
        return readService.toResponse(saved);
    }

    @Transactional
    public void delete(UUID id) {
        TestMatching m = matchingRepo.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("TestMatching", id));
        m.markDeleted(null, clock.instant());
    }
}
```

- [ ] **Step 5: Write TestMatchingReadService (with validation logic)**

`service/TestMatchingReadService.java`:
```java
package com.thundercrew.opsapi.testmatching.matching.service;

import com.thundercrew.opsapi.testmatching.matching.domain.TestMatching;
import com.thundercrew.opsapi.testmatching.matching.domain.TestValidationStatus;
import com.thundercrew.opsapi.testmatching.matching.dto.TestMatchingReadResponse;
import com.thundercrew.opsapi.testmatching.matching.repository.TestMatchingRepository;
import com.thundercrew.opsapi.testmatching.rider.domain.TestRider;
import com.thundercrew.opsapi.testmatching.rider.repository.TestRiderRepository;
import com.thundercrew.opsapi.testmatching.vehicle.domain.TestVehicle;
import com.thundercrew.opsapi.testmatching.vehicle.repository.TestVehicleRepository;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TestMatchingReadService {

    private final TestMatchingRepository matchingRepo;
    private final TestVehicleRepository vehicleRepo;
    private final TestRiderRepository riderRepo;

    public TestMatchingReadService(
            TestMatchingRepository matchingRepo,
            TestVehicleRepository vehicleRepo,
            TestRiderRepository riderRepo) {
        this.matchingRepo = matchingRepo;
        this.vehicleRepo = vehicleRepo;
        this.riderRepo = riderRepo;
    }

    @Transactional(readOnly = true)
    public List<TestMatchingReadResponse> listAll() {
        List<TestMatching> matchings = matchingRepo.findAllByDeletedAtIsNullOrderByIdxAsc();

        // Load lookup maps to avoid N+1 queries
        Map<UUID, TestVehicle> vehicleById = vehicleRepo.findAll().stream()
                .collect(Collectors.toMap(TestVehicle::getId, v -> v));
        Map<UUID, TestRider> riderById = riderRepo.findAll().stream()
                .collect(Collectors.toMap(TestRider::getId, r -> r));
        Set<UUID> activeVehicleIds = vehicleRepo.findAllByDeletedAtIsNullOrderByIdxAsc()
                .stream().map(TestVehicle::getId).collect(Collectors.toSet());
        Set<UUID> activeRiderIds = riderRepo.findAllByDeletedAtIsNullOrderByIdxAsc()
                .stream().map(TestRider::getId).collect(Collectors.toSet());

        // Count how many times each vehicle/rider appears in active matchings
        Map<UUID, Long> vehicleCounts = matchings.stream()
                .collect(Collectors.groupingBy(TestMatching::getTestVehicleId, Collectors.counting()));
        Map<UUID, Long> riderCounts = matchings.stream()
                .collect(Collectors.groupingBy(TestMatching::getTestRiderId, Collectors.counting()));

        return matchings.stream().map(m -> toResponse(m, vehicleById, riderById,
                activeVehicleIds, activeRiderIds, vehicleCounts, riderCounts)).toList();
    }

    /** Used by command service to return a single matching after create. */
    @Transactional(readOnly = true)
    public TestMatchingReadResponse toResponse(TestMatching m) {
        Map<UUID, TestVehicle> vehicleById = vehicleRepo.findAll().stream()
                .collect(Collectors.toMap(TestVehicle::getId, v -> v));
        Map<UUID, TestRider> riderById = riderRepo.findAll().stream()
                .collect(Collectors.toMap(TestRider::getId, r -> r));
        Set<UUID> activeVehicleIds = vehicleRepo.findAllByDeletedAtIsNullOrderByIdxAsc()
                .stream().map(TestVehicle::getId).collect(Collectors.toSet());
        Set<UUID> activeRiderIds = riderRepo.findAllByDeletedAtIsNullOrderByIdxAsc()
                .stream().map(TestRider::getId).collect(Collectors.toSet());
        List<TestMatching> allMatchings = matchingRepo.findAllByDeletedAtIsNullOrderByIdxAsc();
        Map<UUID, Long> vehicleCounts = allMatchings.stream()
                .collect(Collectors.groupingBy(TestMatching::getTestVehicleId, Collectors.counting()));
        Map<UUID, Long> riderCounts = allMatchings.stream()
                .collect(Collectors.groupingBy(TestMatching::getTestRiderId, Collectors.counting()));
        return toResponse(m, vehicleById, riderById, activeVehicleIds, activeRiderIds, vehicleCounts, riderCounts);
    }

    private TestMatchingReadResponse toResponse(
            TestMatching m,
            Map<UUID, TestVehicle> vehicleById,
            Map<UUID, TestRider> riderById,
            Set<UUID> activeVehicleIds,
            Set<UUID> activeRiderIds,
            Map<UUID, Long> vehicleCounts,
            Map<UUID, Long> riderCounts) {

        TestVehicle vehicle = vehicleById.get(m.getTestVehicleId());
        TestRider rider = riderById.get(m.getTestRiderId());
        String plateNumber = vehicle != null ? vehicle.getPlateNumber() : "(삭제됨)";
        String riderName = rider != null ? rider.getName() : "(삭제됨)";
        String phoneNumber = rider != null ? rider.getPhoneNumber() : "";

        TestValidationStatus status;
        String message;
        if (!activeVehicleIds.contains(m.getTestVehicleId())) {
            status = TestValidationStatus.INVALID;
            message = "⚠️ 차량 미등록";
        } else if (!activeRiderIds.contains(m.getTestRiderId())) {
            status = TestValidationStatus.INVALID;
            message = "⚠️ 라이더 미등록";
        } else if (vehicleCounts.getOrDefault(m.getTestVehicleId(), 0L) > 1) {
            status = TestValidationStatus.INVALID;
            message = "⚠️ 차량 중복";
        } else if (riderCounts.getOrDefault(m.getTestRiderId(), 0L) > 1) {
            status = TestValidationStatus.INVALID;
            message = "⚠️ 라이더 중복";
        } else if (!m.getStartDate().isBefore(m.getEndDate())) {
            status = TestValidationStatus.INVALID;
            message = "⚠️ 날짜 오류";
        } else {
            status = TestValidationStatus.VALID;
            message = "✅ 정상";
        }

        return TestMatchingReadResponse.of(m, plateNumber, riderName, phoneNumber, status, message);
    }
}
```

- [ ] **Step 6: Write controllers**

`controller/TestMatchingCommandController.java`:
```java
package com.thundercrew.opsapi.testmatching.matching.controller;

import com.thundercrew.opsapi.testmatching.matching.dto.TestMatchingCreateRequest;
import com.thundercrew.opsapi.testmatching.matching.dto.TestMatchingReadResponse;
import com.thundercrew.opsapi.testmatching.matching.service.TestMatchingCommandService;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/test-matching/matchings")
public class TestMatchingCommandController {

    private final TestMatchingCommandService service;

    public TestMatchingCommandController(TestMatchingCommandService service) {
        this.service = service;
    }

    @PostMapping
    ResponseEntity<TestMatchingReadResponse> create(@Valid @RequestBody TestMatchingCreateRequest request) {
        TestMatchingReadResponse response = service.create(request);
        return ResponseEntity.created(URI.create("/api/v1/test-matching/matchings/" + response.id()))
                .body(response);
    }

    @DeleteMapping("/{id}")
    ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
```

`controller/TestMatchingReadController.java`:
```java
package com.thundercrew.opsapi.testmatching.matching.controller;

import com.thundercrew.opsapi.testmatching.matching.dto.TestMatchingReadResponse;
import com.thundercrew.opsapi.testmatching.matching.service.TestMatchingReadService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/test-matching/matchings")
public class TestMatchingReadController {

    private final TestMatchingReadService service;

    public TestMatchingReadController(TestMatchingReadService service) {
        this.service = service;
    }

    @GetMapping
    List<TestMatchingReadResponse> listAll() {
        return service.listAll();
    }
}
```

- [ ] **Step 7: Compile + commit**

```bash
cd service-ops-api && ./gradlew compileJava
git add service-ops-api/src/main/java/com/thundercrew/opsapi/testmatching/matching/
git commit -m "feat: add TestMatching backend slice with real-time validation"
```

---

## Task 5: Excel Export (Apache POI)

**Files:**
- Create: `...testmatching/excel/TestMatchingExcelService.java`
- Create: `...testmatching/excel/TestMatchingExcelController.java`
- Create: `front-admin-web/app/api/test-matching/export/[type]/route.ts`

Base Java path: `service-ops-api/src/main/java/com/thundercrew/opsapi/testmatching/excel/`

- [ ] **Step 1: Write TestMatchingExcelService**

`TestMatchingExcelService.java`:
```java
package com.thundercrew.opsapi.testmatching.excel;

import com.thundercrew.opsapi.testmatching.matching.domain.TestContractType;
import com.thundercrew.opsapi.testmatching.matching.domain.TestHandoverType;
import com.thundercrew.opsapi.testmatching.matching.domain.TestServiceType;
import com.thundercrew.opsapi.testmatching.matching.domain.TestValidationStatus;
import com.thundercrew.opsapi.testmatching.matching.dto.TestMatchingReadResponse;
import com.thundercrew.opsapi.testmatching.matching.service.TestMatchingReadService;
import com.thundercrew.opsapi.testmatching.rider.dto.TestRiderReadResponse;
import com.thundercrew.opsapi.testmatching.rider.service.TestRiderReadService;
import com.thundercrew.opsapi.testmatching.vehicle.domain.TestBikeType;
import com.thundercrew.opsapi.testmatching.vehicle.domain.TestEngineType;
import com.thundercrew.opsapi.testmatching.vehicle.dto.TestVehicleReadResponse;
import com.thundercrew.opsapi.testmatching.vehicle.service.TestVehicleReadService;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.List;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

@Service
public class TestMatchingExcelService {

    private final TestVehicleReadService vehicleReadService;
    private final TestRiderReadService riderReadService;
    private final TestMatchingReadService matchingReadService;

    public TestMatchingExcelService(
            TestVehicleReadService vehicleReadService,
            TestRiderReadService riderReadService,
            TestMatchingReadService matchingReadService) {
        this.vehicleReadService = vehicleReadService;
        this.riderReadService = riderReadService;
        this.matchingReadService = matchingReadService;
    }

    public byte[] exportVehicles() throws IOException {
        try (Workbook wb = new XSSFWorkbook()) {
            Sheet sheet = wb.createSheet("차량 등록");
            CellStyle headerStyle = buildHeaderStyle(wb);
            String[] headers = {"차량번호", "구분 (2륜/4륜)", "엔진 (전기/내연)", "IMEI"};
            writeHeaderRow(sheet, headers, headerStyle);

            List<TestVehicleReadResponse> vehicles = vehicleReadService.listAll();
            for (int i = 0; i < vehicles.size(); i++) {
                TestVehicleReadResponse v = vehicles.get(i);
                Row row = sheet.createRow(i + 1);
                row.createCell(0).setCellValue(v.plateNumber());
                row.createCell(1).setCellValue(v.bikeType() == TestBikeType.TWO_WHEEL ? "2륜" : "4륜");
                row.createCell(2).setCellValue(v.engineType() == TestEngineType.ELECTRIC ? "전기" : "내연");
                row.createCell(3).setCellValue(v.imei() != null ? v.imei() : "");
            }
            autoSizeColumns(sheet, headers.length);
            return toBytes(wb);
        }
    }

    public byte[] exportRiders() throws IOException {
        try (Workbook wb = new XSSFWorkbook()) {
            Sheet sheet = wb.createSheet("라이더 등록");
            CellStyle headerStyle = buildHeaderStyle(wb);
            String[] headers = {"이름", "연락처", "교육이수 (완료/미완료)", "팀"};
            writeHeaderRow(sheet, headers, headerStyle);

            List<TestRiderReadResponse> riders = riderReadService.listAll();
            for (int i = 0; i < riders.size(); i++) {
                TestRiderReadResponse r = riders.get(i);
                Row row = sheet.createRow(i + 1);
                row.createCell(0).setCellValue(r.name());
                row.createCell(1).setCellValue(r.phoneNumber());
                row.createCell(2).setCellValue(r.trainingCompleted() ? "완료" : "미완료");
                row.createCell(3).setCellValue(r.teamName() != null ? r.teamName() : "");
            }
            autoSizeColumns(sheet, headers.length);
            return toBytes(wb);
        }
    }

    public byte[] exportMatchings() throws IOException {
        try (Workbook wb = new XSSFWorkbook()) {
            Sheet sheet = wb.createSheet("차량-라이더 매칭");
            CellStyle headerStyle = buildHeaderStyle(wb);
            CellStyle warnStyle = buildWarnStyle(wb);
            String[] headers = {
                "차량번호", "서비스유형", "라이더이름", "연락처",
                "계약형태", "인수방식", "시작일", "종료일", "검증결과"
            };
            writeHeaderRow(sheet, headers, headerStyle);

            List<TestMatchingReadResponse> matchings = matchingReadService.listAll();
            for (int i = 0; i < matchings.size(); i++) {
                TestMatchingReadResponse m = matchings.get(i);
                Row row = sheet.createRow(i + 1);
                boolean isInvalid = m.validationStatus() == TestValidationStatus.INVALID;

                setValue(row, 0, m.plateNumber(), isInvalid ? warnStyle : null);
                setValue(row, 1, serviceTypeLabel(m.serviceType()), isInvalid ? warnStyle : null);
                setValue(row, 2, m.riderName(), isInvalid ? warnStyle : null);
                setValue(row, 3, m.phoneNumber(), isInvalid ? warnStyle : null);
                setValue(row, 4, contractTypeLabel(m.contractType()), isInvalid ? warnStyle : null);
                setValue(row, 5, handoverTypeLabel(m.handoverType()), isInvalid ? warnStyle : null);
                setValue(row, 6, m.startDate() != null ? m.startDate().toString() : "", isInvalid ? warnStyle : null);
                setValue(row, 7, m.endDate() != null ? m.endDate().toString() : "", isInvalid ? warnStyle : null);
                setValue(row, 8, m.validationMessage(), isInvalid ? warnStyle : null);
            }
            autoSizeColumns(sheet, headers.length);
            return toBytes(wb);
        }
    }

    private void writeHeaderRow(Sheet sheet, String[] headers, CellStyle style) {
        Row row = sheet.createRow(0);
        for (int i = 0; i < headers.length; i++) {
            Cell cell = row.createCell(i);
            cell.setCellValue(headers[i]);
            cell.setCellStyle(style);
        }
    }

    private void setValue(Row row, int col, String value, CellStyle style) {
        Cell cell = row.createCell(col);
        cell.setCellValue(value != null ? value : "");
        if (style != null) cell.setCellStyle(style);
    }

    private CellStyle buildHeaderStyle(Workbook wb) {
        CellStyle style = wb.createCellStyle();
        style.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        Font font = wb.createFont();
        font.setBold(true);
        font.setColor(IndexedColors.WHITE.getIndex());
        style.setFont(font);
        return style;
    }

    private CellStyle buildWarnStyle(Workbook wb) {
        CellStyle style = wb.createCellStyle();
        style.setFillForegroundColor(IndexedColors.ROSE.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        return style;
    }

    private void autoSizeColumns(Sheet sheet, int count) {
        for (int i = 0; i < count; i++) sheet.autoSizeColumn(i);
    }

    private byte[] toBytes(Workbook wb) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        wb.write(out);
        return out.toByteArray();
    }

    private String serviceTypeLabel(TestServiceType t) {
        return switch (t) {
            case CALL_DELIVERY -> "콜배송";
            case DESIGNATED_DELIVERY -> "지정배송";
            case COLLECTION_CARE -> "수거케어";
            case BATCH_COLLECTION -> "일괄수거";
        };
    }

    private String contractTypeLabel(TestContractType t) {
        return switch (t) { case SUBSCRIPTION -> "구독"; case RENTAL -> "렌탈"; };
    }

    private String handoverTypeLabel(TestHandoverType t) {
        return switch (t) { case TAKEOVER -> "인수형"; case RETURN -> "반납형"; };
    }
}
```

- [ ] **Step 2: Write TestMatchingExcelController**

`TestMatchingExcelController.java`:
```java
package com.thundercrew.opsapi.testmatching.excel;

import java.io.IOException;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/test-matching/export")
public class TestMatchingExcelController {

    private final TestMatchingExcelService service;

    public TestMatchingExcelController(TestMatchingExcelService service) {
        this.service = service;
    }

    @GetMapping("/vehicles")
    ResponseEntity<byte[]> exportVehicles() throws IOException {
        return excelResponse(service.exportVehicles(), "test_vehicles.xlsx");
    }

    @GetMapping("/riders")
    ResponseEntity<byte[]> exportRiders() throws IOException {
        return excelResponse(service.exportRiders(), "test_riders.xlsx");
    }

    @GetMapping("/matchings")
    ResponseEntity<byte[]> exportMatchings() throws IOException {
        return excelResponse(service.exportMatchings(), "test_matchings.xlsx");
    }

    private ResponseEntity<byte[]> excelResponse(byte[] data, String filename) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
        headers.setContentDisposition(
                ContentDisposition.attachment().filename(filename).build());
        headers.setContentLength(data.length);
        return ResponseEntity.ok().headers(headers).body(data);
    }
}
```

- [ ] **Step 3: Write Next.js Excel proxy API route**

The frontend cannot call the backend Excel endpoints directly with a Bearer token from a `<a href>` link. This Next.js API route reads the access token from the cookie, forwards to the backend, and streams the Excel to the browser.

Create `front-admin-web/app/api/test-matching/export/[type]/route.ts`:

```typescript
import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const BACKEND_BASE = process.env.SERVICE_OPS_API_BASE_URL ?? "";
const TOKEN_COOKIE = "thundercrew_ops_access_token";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params;
  if (!["vehicles", "riders", "matchings"].includes(type)) {
    return NextResponse.json({ error: "invalid type" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const backendUrl = `${BACKEND_BASE}/api/v1/test-matching/export/${type}`;
  const upstream = await fetch(backendUrl, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!upstream.ok) {
    return NextResponse.json({ error: "backend error" }, { status: upstream.status });
  }

  const blob = await upstream.blob();
  const filename = `test_${type}.xlsx`;
  return new NextResponse(blob, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
```

- [ ] **Step 4: Compile backend + build frontend**

```bash
cd service-ops-api && ./gradlew compileJava
cd ../front-admin-web && npx tsc --noEmit
```
Both expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add service-ops-api/src/main/java/com/thundercrew/opsapi/testmatching/excel/
git add front-admin-web/app/api/test-matching/
git commit -m "feat: add Excel export for test-matching (vehicles/riders/matchings)"
```

---

## Task 6: Frontend API Client Types + Methods

**Files:**
- Modify: `front-admin-web/lib/services/service-ops-api.ts`

Add the following in three places in the file:

- [ ] **Step 1: Add type definitions**

Near the top of `service-ops-api.ts`, add after the existing type definitions (find the `// ── Bike types ──` section or similar, add below):

```typescript
// ── Test-Matching types ──

export type ServiceOpsTestVehicle = {
  id: string;
  idx: number;
  plateNumber: string;
  bikeType: "TWO_WHEEL" | "FOUR_WHEEL";
  engineType: "ELECTRIC" | "ICE";
  imei: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ServiceOpsTestRider = {
  id: string;
  idx: number;
  name: string;
  phoneNumber: string;
  trainingCompleted: boolean;
  teamName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ServiceOpsTestMatching = {
  id: string;
  idx: number;
  testVehicleId: string;
  plateNumber: string;
  serviceType: "CALL_DELIVERY" | "DESIGNATED_DELIVERY" | "COLLECTION_CARE" | "BATCH_COLLECTION";
  testRiderId: string;
  riderName: string;
  phoneNumber: string;
  contractType: "SUBSCRIPTION" | "RENTAL";
  handoverType: "TAKEOVER" | "RETURN";
  startDate: string;  // "YYYY-MM-DD"
  endDate: string;    // "YYYY-MM-DD"
  validationStatus: "VALID" | "INVALID";
  validationMessage: string;
  createdAt: string;
  updatedAt: string;
};

export type TestVehicleCreateInput = {
  plateNumber: string;
  bikeType: "TWO_WHEEL" | "FOUR_WHEEL";
  engineType: "ELECTRIC" | "ICE";
  imei?: string | null;
};

export type TestRiderCreateInput = {
  name: string;
  phoneNumber: string;
  trainingCompleted: boolean;
  teamName?: string | null;
};

export type TestMatchingCreateInput = {
  testVehicleId: string;
  serviceType: "CALL_DELIVERY" | "DESIGNATED_DELIVERY" | "COLLECTION_CARE" | "BATCH_COLLECTION";
  testRiderId: string;
  contractType: "SUBSCRIPTION" | "RENTAL";
  handoverType: "TAKEOVER" | "RETURN";
  startDate: string;  // "YYYY-MM-DD"
  endDate: string;    // "YYYY-MM-DD"
};
```

- [ ] **Step 2: Add methods to the ServiceOpsApiClient interface**

Find the `ServiceOpsApiClient` interface in `service-ops-api.ts`. Add at the end of the interface (before the closing `}`):

```typescript
  // Test-Matching
  listTestVehicles: () => Promise<ServiceOpsTestVehicle[]>;
  createTestVehicle: (input: TestVehicleCreateInput) => Promise<ServiceOpsTestVehicle>;
  deleteTestVehicle: (id: string) => Promise<void>;

  listTestRiders: () => Promise<ServiceOpsTestRider[]>;
  createTestRider: (input: TestRiderCreateInput) => Promise<ServiceOpsTestRider>;
  deleteTestRider: (id: string) => Promise<void>;

  listTestMatchings: () => Promise<ServiceOpsTestMatching[]>;
  createTestMatching: (input: TestMatchingCreateInput) => Promise<ServiceOpsTestMatching>;
  deleteTestMatching: (id: string) => Promise<void>;
```

- [ ] **Step 3: Add method implementations**

Find the `createServiceOpsApiClient` function and add these inside its returned object (at the end, before the closing `}`):

```typescript
    // ── Test-Matching ──
    listTestVehicles: async () =>
      request<ServiceOpsTestVehicle[]>("/test-matching/vehicles", { method: "GET" }),

    createTestVehicle: async (input) =>
      request<ServiceOpsTestVehicle>("/test-matching/vehicles", {
        method: "POST",
        body: JSON.stringify(input),
      }),

    deleteTestVehicle: async (id) => {
      await request<void>(`/test-matching/vehicles/${encodeURIComponent(id)}`, { method: "DELETE" });
    },

    listTestRiders: async () =>
      request<ServiceOpsTestRider[]>("/test-matching/riders", { method: "GET" }),

    createTestRider: async (input) =>
      request<ServiceOpsTestRider>("/test-matching/riders", {
        method: "POST",
        body: JSON.stringify(input),
      }),

    deleteTestRider: async (id) => {
      await request<void>(`/test-matching/riders/${encodeURIComponent(id)}`, { method: "DELETE" });
    },

    listTestMatchings: async () =>
      request<ServiceOpsTestMatching[]>("/test-matching/matchings", { method: "GET" }),

    createTestMatching: async (input) =>
      request<ServiceOpsTestMatching>("/test-matching/matchings", {
        method: "POST",
        body: JSON.stringify(input),
      }),

    deleteTestMatching: async (id) => {
      await request<void>(`/test-matching/matchings/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
```

- [ ] **Step 4: Type-check**

```bash
cd front-admin-web && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add front-admin-web/lib/services/service-ops-api.ts
git commit -m "feat: add test-matching types and API client methods"
```

---

## Task 7: Data Loader + Server Actions

**Files:**
- Create: `front-admin-web/lib/services/test-matching-data.ts`
- Create: `front-admin-web/app/test-matching/actions.ts`

- [ ] **Step 1: Write data loader**

`front-admin-web/lib/services/test-matching-data.ts`:
```typescript
import {
  createAuthenticatedServiceOpsApiClient,
  serviceOpsApiConfigured,
  type ServiceOpsTestMatching,
  type ServiceOpsTestRider,
  type ServiceOpsTestVehicle,
} from "@/lib/services/service-ops-api";

export type TestMatchingPageData = {
  vehicles: ServiceOpsTestVehicle[];
  riders: ServiceOpsTestRider[];
  matchings: ServiceOpsTestMatching[];
  notice?: string;
};

export async function loadTestMatchingData(): Promise<TestMatchingPageData> {
  if (!serviceOpsApiConfigured()) {
    return { vehicles: [], riders: [], matchings: [] };
  }
  const client = await createAuthenticatedServiceOpsApiClient();
  if (!client) {
    return {
      vehicles: [],
      riders: [],
      matchings: [],
      notice: "세션이 없어 데이터를 불러올 수 없습니다.",
    };
  }
  try {
    const [vehicles, riders, matchings] = await Promise.all([
      client.listTestVehicles(),
      client.listTestRiders(),
      client.listTestMatchings(),
    ]);
    return { vehicles, riders, matchings };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { vehicles: [], riders: [], matchings: [], notice: `로드 실패: ${message}` };
  }
}
```

- [ ] **Step 2: Write server actions**

`front-admin-web/app/test-matching/actions.ts`:
```typescript
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createAuthenticatedServiceOpsApiClient,
  serviceOpsApiConfigured,
} from "@/lib/services/service-ops-api";

const PAGE = "/test-matching";

function getClient() {
  if (!serviceOpsApiConfigured()) redirect(PAGE);
  return createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
}

// ── Vehicles ──

export async function createTestVehicleAction(formData: FormData): Promise<void> {
  const client = await getClient();
  if (!client) redirect(`/login?status=session-required`);

  const plateNumber = String(formData.get("plateNumber") ?? "").trim();
  const bikeType = String(formData.get("bikeType") ?? "") as "TWO_WHEEL" | "FOUR_WHEEL";
  const engineType = String(formData.get("engineType") ?? "") as "ELECTRIC" | "ICE";
  const imeiRaw = String(formData.get("imei") ?? "").trim();
  const imei = imeiRaw.length === 15 ? imeiRaw : null;

  try {
    await client.createTestVehicle({ plateNumber, bikeType, engineType, imei });
  } catch {
    redirect(`${PAGE}?error=vehicle-create`);
  }
  revalidatePath(PAGE);
  redirect(PAGE);
}

export async function deleteTestVehicleAction(formData: FormData): Promise<void> {
  const client = await getClient();
  if (!client) redirect(`/login?status=session-required`);
  const id = String(formData.get("id") ?? "").trim();
  try {
    await client.deleteTestVehicle(id);
  } catch {
    redirect(`${PAGE}?error=vehicle-delete`);
  }
  revalidatePath(PAGE);
  redirect(PAGE);
}

// ── Riders ──

export async function createTestRiderAction(formData: FormData): Promise<void> {
  const client = await getClient();
  if (!client) redirect(`/login?status=session-required`);

  const name = String(formData.get("name") ?? "").trim();
  const phoneNumber = String(formData.get("phoneNumber") ?? "").trim();
  const trainingCompleted = formData.get("trainingCompleted") === "COMPLETED";
  const teamNameRaw = String(formData.get("teamName") ?? "").trim();
  const teamName = teamNameRaw || null;

  try {
    await client.createTestRider({ name, phoneNumber, trainingCompleted, teamName });
  } catch {
    redirect(`${PAGE}?error=rider-create`);
  }
  revalidatePath(PAGE);
  redirect(PAGE);
}

export async function deleteTestRiderAction(formData: FormData): Promise<void> {
  const client = await getClient();
  if (!client) redirect(`/login?status=session-required`);
  const id = String(formData.get("id") ?? "").trim();
  try {
    await client.deleteTestRider(id);
  } catch {
    redirect(`${PAGE}?error=rider-delete`);
  }
  revalidatePath(PAGE);
  redirect(PAGE);
}

// ── Matchings ──

export async function createTestMatchingAction(formData: FormData): Promise<void> {
  const client = await getClient();
  if (!client) redirect(`/login?status=session-required`);

  const testVehicleId = String(formData.get("testVehicleId") ?? "").trim();
  const serviceType = String(formData.get("serviceType") ?? "") as
    "CALL_DELIVERY" | "DESIGNATED_DELIVERY" | "COLLECTION_CARE" | "BATCH_COLLECTION";
  const testRiderId = String(formData.get("testRiderId") ?? "").trim();
  const contractType = String(formData.get("contractType") ?? "") as "SUBSCRIPTION" | "RENTAL";
  const handoverType = String(formData.get("handoverType") ?? "") as "TAKEOVER" | "RETURN";
  const startDate = String(formData.get("startDate") ?? "").trim();
  const endDate = String(formData.get("endDate") ?? "").trim();

  try {
    await client.createTestMatching({
      testVehicleId, serviceType, testRiderId,
      contractType, handoverType, startDate, endDate,
    });
  } catch {
    redirect(`${PAGE}?error=matching-create`);
  }
  revalidatePath(PAGE);
  redirect(PAGE);
}

export async function deleteTestMatchingAction(formData: FormData): Promise<void> {
  const client = await getClient();
  if (!client) redirect(`/login?status=session-required`);
  const id = String(formData.get("id") ?? "").trim();
  try {
    await client.deleteTestMatching(id);
  } catch {
    redirect(`${PAGE}?error=matching-delete`);
  }
  revalidatePath(PAGE);
  redirect(PAGE);
}
```

- [ ] **Step 3: Type-check**

```bash
cd front-admin-web && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add front-admin-web/lib/services/test-matching-data.ts \
        front-admin-web/app/test-matching/actions.ts
git commit -m "feat: add test-matching data loader and server actions"
```

---

## Task 8: Page + CSS

**Files:**
- Create: `front-admin-web/app/test-matching/page.tsx`
- Create: `front-admin-web/app/test-matching/test-matching.css`

- [ ] **Step 1: Write the page server component**

`front-admin-web/app/test-matching/page.tsx`:
```tsx
import "@/app/test-matching/test-matching.css";
import { AppShell } from "@/components/layout/AppShell";
import { VehicleSection } from "@/components/test-matching/VehicleSection";
import { RiderSection } from "@/components/test-matching/RiderSection";
import { MatchingSection } from "@/components/test-matching/MatchingSection";
import { loadTestMatchingData } from "@/lib/services/test-matching-data";

export const dynamic = "force-dynamic";
export const metadata = { title: "차량·라이더 등록 테스트" };

export default async function TestMatchingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const { vehicles, riders, matchings, notice } = await loadTestMatchingData();
  const error = params.error ?? null;

  return (
    <AppShell>
      <div className="tm-page">
        <h1 className="tm-title">차량·라이더 등록 테스트</h1>
        <p className="tm-subtitle">
          차량 등록 → 라이더 등록 → 차량·라이더 매칭 순서로 입력하세요.
          별도 테스트 DB를 사용하며 완료 후 운영 DB에 통합됩니다.
        </p>

        {notice && <div className="tm-notice">{notice}</div>}
        {error && (
          <div className="tm-error">
            {{
              "vehicle-create": "차량 등록 실패. 차량번호 중복 또는 입력 오류를 확인하세요.",
              "vehicle-delete": "차량 삭제 실패.",
              "rider-create": "라이더 등록 실패. 연락처 중복 또는 입력 오류를 확인하세요.",
              "rider-delete": "라이더 삭제 실패.",
              "matching-create": "매칭 등록 실패. 입력값을 확인하세요.",
              "matching-delete": "매칭 삭제 실패.",
            }[error] ?? "오류가 발생했습니다."}
          </div>
        )}

        <VehicleSection vehicles={vehicles} />
        <RiderSection riders={riders} />
        <MatchingSection matchings={matchings} vehicles={vehicles} riders={riders} />
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 2: Write CSS**

`front-admin-web/app/test-matching/test-matching.css`:
```css
/* ── Page shell ── */
.tm-page {
  max-width: 1100px;
  margin: 0 auto;
  padding: 2rem 1.5rem 4rem;
}

.tm-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 0.25rem;
}

.tm-subtitle {
  font-size: 0.875rem;
  color: var(--color-muted, #666);
  margin: 0 0 1.5rem;
}

.tm-notice {
  background: #fff8dc;
  border: 1px solid #e6c840;
  border-radius: 6px;
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  margin-bottom: 1rem;
}

.tm-error {
  background: #fdecea;
  border: 1px solid #e53e3e;
  border-radius: 6px;
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  color: #c53030;
  margin-bottom: 1rem;
}

/* ── Section card ── */
.tm-section {
  background: var(--color-surface, #fff);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 10px;
  padding: 1.25rem 1.5rem;
  margin-bottom: 1.5rem;
}

.tm-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.tm-section-title {
  font-size: 1.1rem;
  font-weight: 700;
  margin: 0;
}

.tm-section-actions {
  display: flex;
  gap: 0.5rem;
}

/* ── Table ── */
.tm-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.tm-table th {
  text-align: left;
  padding: 0.5rem 0.75rem;
  background: #1f3864;
  color: #fff;
  font-weight: 600;
  white-space: nowrap;
}

.tm-table td {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--color-border, #e2e8f0);
  vertical-align: middle;
}

.tm-table tr:last-child td { border-bottom: none; }

.tm-table tr.tm-row-invalid td {
  background: #fdecea;
  color: #c53030;
}

.tm-empty {
  color: var(--color-muted, #999);
  font-size: 0.875rem;
  padding: 0.75rem 0;
}

/* ── Add form ── */
.tm-add-form {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px dashed var(--color-border, #ddd);
}

.tm-add-form-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-muted, #555);
  margin: 0 0 0.75rem;
}

.tm-form-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: flex-end;
}

.tm-form-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.tm-form-field label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-muted, #555);
}

.tm-form-field input,
.tm-form-field select {
  height: 2rem;
  padding: 0 0.5rem;
  border: 1px solid var(--color-border, #ddd);
  border-radius: 4px;
  font-size: 0.875rem;
  background: var(--color-surface, #fff);
  min-width: 120px;
}

/* ── Buttons ── */
.tm-btn {
  height: 2rem;
  padding: 0 0.875rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  white-space: nowrap;
}

.tm-btn-primary {
  background: #1f3864;
  color: #fff;
}

.tm-btn-secondary {
  background: transparent;
  border: 1px solid var(--color-border, #ccc);
  color: var(--color-text, #333);
}

.tm-btn-danger {
  background: transparent;
  border: 1px solid #e53e3e;
  color: #c53030;
  font-size: 0.75rem;
  height: 1.75rem;
  padding: 0 0.5rem;
}

.tm-btn-download {
  background: #276749;
  color: #fff;
}

/* ── Validation badge ── */
.tm-valid { color: #276749; font-weight: 600; }
.tm-invalid { color: #c53030; font-weight: 600; }

/* ── Matching summary ── */
.tm-matching-summary {
  margin-bottom: 0.75rem;
  font-size: 0.875rem;
  font-weight: 600;
}

.tm-matching-summary.all-valid { color: #276749; }
.tm-matching-summary.has-invalid { color: #c53030; }
```

- [ ] **Step 3: Type-check**

```bash
cd front-admin-web && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add front-admin-web/app/test-matching/
git commit -m "feat: add /test-matching page skeleton with CSS"
```

---

## Task 9: VehicleSection + RiderSection Components

**Files:**
- Create: `front-admin-web/components/test-matching/VehicleSection.tsx`
- Create: `front-admin-web/components/test-matching/RiderSection.tsx`

- [ ] **Step 1: Write VehicleSection**

`front-admin-web/components/test-matching/VehicleSection.tsx`:
```tsx
import {
  createTestVehicleAction,
  deleteTestVehicleAction,
} from "@/app/test-matching/actions";
import type { ServiceOpsTestVehicle } from "@/lib/services/service-ops-api";

const BIKE_TYPE_LABELS: Record<string, string> = {
  TWO_WHEEL: "2륜",
  FOUR_WHEEL: "4륜",
};
const ENGINE_TYPE_LABELS: Record<string, string> = {
  ELECTRIC: "전기",
  ICE: "내연",
};

export function VehicleSection({
  vehicles,
}: {
  vehicles: ServiceOpsTestVehicle[];
}) {
  return (
    <section className="tm-section">
      <div className="tm-section-header">
        <h2 className="tm-section-title">🚲 차량 등록</h2>
        <div className="tm-section-actions">
          <a
            href="/api/test-matching/export/vehicles"
            className="tm-btn tm-btn-download"
            download="test_vehicles.xlsx"
          >
            엑셀 다운로드
          </a>
        </div>
      </div>

      {vehicles.length === 0 ? (
        <p className="tm-empty">등록된 차량이 없습니다.</p>
      ) : (
        <table className="tm-table">
          <thead>
            <tr>
              <th>#</th>
              <th>차량번호</th>
              <th>구분</th>
              <th>엔진</th>
              <th>IMEI</th>
              <th>등록일</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map((v, i) => (
              <tr key={v.id}>
                <td>{i + 1}</td>
                <td>{v.plateNumber}</td>
                <td>{BIKE_TYPE_LABELS[v.bikeType] ?? v.bikeType}</td>
                <td>{ENGINE_TYPE_LABELS[v.engineType] ?? v.engineType}</td>
                <td>{v.imei ?? "—"}</td>
                <td>{v.createdAt.slice(0, 10)}</td>
                <td>
                  <form action={deleteTestVehicleAction}>
                    <input type="hidden" name="id" value={v.id} />
                    <button type="submit" className="tm-btn tm-btn-danger">
                      삭제
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="tm-add-form">
        <p className="tm-add-form-title">차량 추가</p>
        <form action={createTestVehicleAction}>
          <div className="tm-form-row">
            <div className="tm-form-field">
              <label htmlFor="v-plate">차량번호 *</label>
              <input id="v-plate" name="plateNumber" required placeholder="12가3456" />
            </div>
            <div className="tm-form-field">
              <label htmlFor="v-bike-type">구분 *</label>
              <select id="v-bike-type" name="bikeType" required defaultValue="TWO_WHEEL">
                <option value="TWO_WHEEL">2륜</option>
                <option value="FOUR_WHEEL">4륜</option>
              </select>
            </div>
            <div className="tm-form-field">
              <label htmlFor="v-engine">엔진 *</label>
              <select id="v-engine" name="engineType" required defaultValue="ELECTRIC">
                <option value="ELECTRIC">전기</option>
                <option value="ICE">내연</option>
              </select>
            </div>
            <div className="tm-form-field">
              <label htmlFor="v-imei">IMEI (15자리, 선택)</label>
              <input id="v-imei" name="imei" placeholder="123456789012345" maxLength={15} />
            </div>
            <button type="submit" className="tm-btn tm-btn-primary">
              추가
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Write RiderSection**

`front-admin-web/components/test-matching/RiderSection.tsx`:
```tsx
import {
  createTestRiderAction,
  deleteTestRiderAction,
} from "@/app/test-matching/actions";
import type { ServiceOpsTestRider } from "@/lib/services/service-ops-api";

export function RiderSection({ riders }: { riders: ServiceOpsTestRider[] }) {
  return (
    <section className="tm-section">
      <div className="tm-section-header">
        <h2 className="tm-section-title">🧑 라이더 등록</h2>
        <div className="tm-section-actions">
          <a
            href="/api/test-matching/export/riders"
            className="tm-btn tm-btn-download"
            download="test_riders.xlsx"
          >
            엑셀 다운로드
          </a>
        </div>
      </div>

      {riders.length === 0 ? (
        <p className="tm-empty">등록된 라이더가 없습니다.</p>
      ) : (
        <table className="tm-table">
          <thead>
            <tr>
              <th>#</th>
              <th>이름</th>
              <th>연락처</th>
              <th>교육이수</th>
              <th>팀</th>
              <th>등록일</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {riders.map((r, i) => (
              <tr key={r.id}>
                <td>{i + 1}</td>
                <td>{r.name}</td>
                <td>{r.phoneNumber}</td>
                <td>{r.trainingCompleted ? "✅ 완료" : "❌ 미완료"}</td>
                <td>{r.teamName ?? "—"}</td>
                <td>{r.createdAt.slice(0, 10)}</td>
                <td>
                  <form action={deleteTestRiderAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <button type="submit" className="tm-btn tm-btn-danger">
                      삭제
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="tm-add-form">
        <p className="tm-add-form-title">라이더 추가</p>
        <form action={createTestRiderAction}>
          <div className="tm-form-row">
            <div className="tm-form-field">
              <label htmlFor="r-name">이름 *</label>
              <input id="r-name" name="name" required placeholder="홍길동" />
            </div>
            <div className="tm-form-field">
              <label htmlFor="r-phone">연락처 * (010-XXXX-XXXX)</label>
              <input
                id="r-phone"
                name="phoneNumber"
                required
                placeholder="010-1234-5678"
                pattern="010-\d{4}-\d{4}"
              />
            </div>
            <div className="tm-form-field">
              <label htmlFor="r-training">교육이수 *</label>
              <select id="r-training" name="trainingCompleted" required defaultValue="COMPLETED">
                <option value="COMPLETED">완료</option>
                <option value="INCOMPLETE">미완료</option>
              </select>
            </div>
            <div className="tm-form-field">
              <label htmlFor="r-team">팀 (선택)</label>
              <input id="r-team" name="teamName" placeholder="강남팀" />
            </div>
            <button type="submit" className="tm-btn tm-btn-primary">
              추가
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
cd front-admin-web && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add front-admin-web/components/test-matching/VehicleSection.tsx \
        front-admin-web/components/test-matching/RiderSection.tsx
git commit -m "feat: add VehicleSection and RiderSection components"
```

---

## Task 10: MatchingSection + End-to-End Verification

**Files:**
- Create: `front-admin-web/components/test-matching/MatchingSection.tsx`

- [ ] **Step 1: Write MatchingSection**

`front-admin-web/components/test-matching/MatchingSection.tsx`:
```tsx
import {
  createTestMatchingAction,
  deleteTestMatchingAction,
} from "@/app/test-matching/actions";
import type {
  ServiceOpsTestMatching,
  ServiceOpsTestRider,
  ServiceOpsTestVehicle,
} from "@/lib/services/service-ops-api";

const SERVICE_TYPE_LABELS: Record<string, string> = {
  CALL_DELIVERY: "콜배송",
  DESIGNATED_DELIVERY: "지정배송",
  COLLECTION_CARE: "수거케어",
  BATCH_COLLECTION: "일괄수거",
};
const CONTRACT_TYPE_LABELS: Record<string, string> = {
  SUBSCRIPTION: "구독",
  RENTAL: "렌탈",
};
const HANDOVER_TYPE_LABELS: Record<string, string> = {
  TAKEOVER: "인수형",
  RETURN: "반납형",
};

export function MatchingSection({
  matchings,
  vehicles,
  riders,
}: {
  matchings: ServiceOpsTestMatching[];
  vehicles: ServiceOpsTestVehicle[];
  riders: ServiceOpsTestRider[];
}) {
  const invalidCount = matchings.filter((m) => m.validationStatus === "INVALID").length;
  const allValid = matchings.length > 0 && invalidCount === 0;

  return (
    <section className="tm-section">
      <div className="tm-section-header">
        <h2 className="tm-section-title">🔗 차량·라이더 매칭</h2>
        <div className="tm-section-actions">
          <a
            href="/api/test-matching/export/matchings"
            className="tm-btn tm-btn-download"
            download="test_matchings.xlsx"
          >
            엑셀 다운로드
          </a>
        </div>
      </div>

      {matchings.length > 0 && (
        <p className={`tm-matching-summary ${allValid ? "all-valid" : "has-invalid"}`}>
          {allValid
            ? `✅ 전체 ${matchings.length}개 정상`
            : `⚠️ ${matchings.length}개 중 ${invalidCount}개 오류`}
        </p>
      )}

      {matchings.length === 0 ? (
        <p className="tm-empty">등록된 매칭이 없습니다.</p>
      ) : (
        <table className="tm-table">
          <thead>
            <tr>
              <th>#</th>
              <th>차량번호</th>
              <th>서비스유형</th>
              <th>라이더</th>
              <th>연락처</th>
              <th>계약</th>
              <th>인수방식</th>
              <th>시작일</th>
              <th>종료일</th>
              <th>검증</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {matchings.map((m, i) => {
              const isInvalid = m.validationStatus === "INVALID";
              return (
                <tr key={m.id} className={isInvalid ? "tm-row-invalid" : ""}>
                  <td>{i + 1}</td>
                  <td>{m.plateNumber}</td>
                  <td>{SERVICE_TYPE_LABELS[m.serviceType] ?? m.serviceType}</td>
                  <td>{m.riderName}</td>
                  <td>{m.phoneNumber}</td>
                  <td>{CONTRACT_TYPE_LABELS[m.contractType] ?? m.contractType}</td>
                  <td>{HANDOVER_TYPE_LABELS[m.handoverType] ?? m.handoverType}</td>
                  <td>{m.startDate}</td>
                  <td>{m.endDate}</td>
                  <td>
                    <span className={isInvalid ? "tm-invalid" : "tm-valid"}>
                      {m.validationMessage}
                    </span>
                  </td>
                  <td>
                    <form action={deleteTestMatchingAction}>
                      <input type="hidden" name="id" value={m.id} />
                      <button type="submit" className="tm-btn tm-btn-danger">
                        삭제
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <div className="tm-add-form">
        <p className="tm-add-form-title">매칭 추가</p>
        <form action={createTestMatchingAction}>
          <div className="tm-form-row">
            <div className="tm-form-field">
              <label htmlFor="m-vehicle">차량번호 *</label>
              <select id="m-vehicle" name="testVehicleId" required>
                <option value="">선택...</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plateNumber}
                  </option>
                ))}
              </select>
            </div>
            <div className="tm-form-field">
              <label htmlFor="m-service">서비스유형 *</label>
              <select id="m-service" name="serviceType" required defaultValue="CALL_DELIVERY">
                <option value="CALL_DELIVERY">콜배송</option>
                <option value="DESIGNATED_DELIVERY">지정배송</option>
                <option value="COLLECTION_CARE">수거케어</option>
                <option value="BATCH_COLLECTION">일괄수거</option>
              </select>
            </div>
            <div className="tm-form-field">
              <label htmlFor="m-rider">라이더 *</label>
              <select id="m-rider" name="testRiderId" required>
                <option value="">선택...</option>
                {riders.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.phoneNumber})
                  </option>
                ))}
              </select>
            </div>
            <div className="tm-form-field">
              <label htmlFor="m-contract">계약형태 *</label>
              <select id="m-contract" name="contractType" required defaultValue="SUBSCRIPTION">
                <option value="SUBSCRIPTION">구독</option>
                <option value="RENTAL">렌탈</option>
              </select>
            </div>
            <div className="tm-form-field">
              <label htmlFor="m-handover">인수방식 *</label>
              <select id="m-handover" name="handoverType" required defaultValue="TAKEOVER">
                <option value="TAKEOVER">인수형</option>
                <option value="RETURN">반납형</option>
              </select>
            </div>
            <div className="tm-form-field">
              <label htmlFor="m-start">시작일 *</label>
              <input id="m-start" name="startDate" type="date" required />
            </div>
            <div className="tm-form-field">
              <label htmlFor="m-end">종료일 *</label>
              <input id="m-end" name="endDate" type="date" required />
            </div>
            <button type="submit" className="tm-btn tm-btn-primary">
              추가
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Final type-check + build**

```bash
cd front-admin-web && npx tsc --noEmit && npm run build
```
Expected: `✓ Compiled successfully`

- [ ] **Step 3: Start backend + verify migration applies**

In `service-ops-api/`:
```bash
./gradlew bootRun
```
Check logs for:
```
Flyway ... Successfully applied 1 migration to schema "public" (V29__create_test_matching_tables)
```

- [ ] **Step 4: Smoke-test backend endpoints**

With the backend running, from a terminal that has the JWT token:
```bash
# Replace TOKEN with a valid JWT from your local session
TOKEN="your_jwt_here"

# Create a test vehicle
curl -s -X POST http://localhost:8080/api/v1/test-matching/vehicles \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"plateNumber":"12가3456","bikeType":"TWO_WHEEL","engineType":"ELECTRIC"}' | python -m json.tool

# List vehicles
curl -s http://localhost:8080/api/v1/test-matching/vehicles \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool
```
Expected: vehicle appears in list with `"validationStatus"` field absent (vehicles don't have validation).

```bash
# Create a rider
curl -s -X POST http://localhost:8080/api/v1/test-matching/riders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"홍길동","phoneNumber":"010-1234-5678","trainingCompleted":true}' | python -m json.tool
```

```bash
# Create a matching (use UUIDs from above responses)
curl -s -X POST http://localhost:8080/api/v1/test-matching/matchings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "testVehicleId":"<vehicle-id>",
    "serviceType":"CALL_DELIVERY",
    "testRiderId":"<rider-id>",
    "contractType":"SUBSCRIPTION",
    "handoverType":"TAKEOVER",
    "startDate":"2025-01-01",
    "endDate":"2025-12-31"
  }' | python -m json.tool
```
Expected: matching returned with `"validationStatus":"VALID"` and `"validationMessage":"✅ 정상"`.

- [ ] **Step 5: Verify frontend page**

Start frontend: `cd front-admin-web && npm run dev`

Navigate to `http://localhost:3000/test-matching`.

Verify:
1. Page loads with three sections (차량, 라이더, 매칭)
2. Add a vehicle via the form → page refreshes → vehicle appears in table
3. Add a rider via the form → rider appears in table
4. Add a matching → matching appears with "✅ 정상"
5. Add a duplicate matching (same vehicle) → "⚠️ 차량 중복" shown in red
6. Delete an entry → it disappears
7. "엑셀 다운로드" links trigger file downloads with correct data

- [ ] **Step 6: Final commit**

```bash
git add front-admin-web/components/test-matching/MatchingSection.tsx
git commit -m "feat: add MatchingSection with validation display — /test-matching page complete"
```
