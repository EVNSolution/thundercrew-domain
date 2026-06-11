# Excel Import/Export Implementation Plan (Group B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 차량·라이더·매칭을 Excel로 일괄 등록·수정·조회할 수 있는 Import/Export 기능 구현

**Architecture:** BikeWheelType 및 RiderTrainingStatus 신규 enum 추가, V30 DB 마이그레이션, 공용 ExcelParser/ExcelExporter 유틸리티, 도메인별 BulkController/BulkService 계층, Next.js App Router 페이지 + 서버 액션

**Tech Stack:** Java 17 / Spring Boot, Apache POI (기존), PostgreSQL + Flyway, Next.js 14 App Router, TypeScript, Server Actions

---

## File Map

### 백엔드 신규 파일
```
service-ops-api/src/main/resources/db/migration/
  V30__add_bike_wheel_type_and_rider_training_status.sql

service-ops-api/src/main/java/com/thundercrew/opsapi/
  bike/domain/BikeWheelType.java
  rider/domain/RiderTrainingStatus.java
  common/bulk/BulkRowStatus.java
  common/bulk/BulkRowResult.java
  common/bulk/BulkSummary.java
  common/bulk/BulkPreviewResponse.java
  common/bulk/BulkApplyResponse.java
  common/excel/ExcelParser.java
  common/excel/ExcelExporter.java
  bike/service/BikeBulkService.java
  bike/controller/BikeBulkController.java
  rider/service/RiderBulkService.java
  rider/controller/RiderBulkController.java
  contract/service/ContractBulkService.java
  contract/controller/ContractBulkController.java
```

### 백엔드 수정 파일
```
  bike/domain/Bike.java                          — wheelType, imei 필드 추가
  rider/domain/Rider.java                        — trainingStatus 필드 추가
  bike/repository/BikeRepository.java            — findByPlateNumberAndDeletedAtIsNull 추가
  rider/repository/RiderRepository.java          — findByPhoneNumberAndDeletedAtIsNull 추가
  contract/repository/ContractTemplateRepository.java  — findByCategoryAndReturnType 추가
  contract/repository/RiderBikeContractRepository.java — findActiveByBikeIdAndRiderId 추가
  contract/domain/RiderBikeContract.java         — updateDates() 메서드 추가
```

### 백엔드 테스트 신규 파일
```
service-ops-api/src/test/java/com/thundercrew/opsapi/
  BikeBulkApiTests.java
  RiderBulkApiTests.java
  ContractBulkApiTests.java
```

### 프론트엔드 신규 파일
```
front-admin-web/
  app/management/vehicles/page.tsx
  app/management/vehicles/actions.ts
  app/management/riders/page.tsx
  app/management/riders/actions.ts
  app/management/matching/page.tsx
  app/management/matching/actions.ts
  components/management/BulkPreviewModal.tsx
  components/management/BulkPreviewModal.css
  components/management/ExcelImportButton.tsx
  components/management/VehiclesManagementPanel.tsx
  components/management/RidersManagementPanel.tsx
  components/management/MatchingManagementPanel.tsx
```

### 프론트엔드 수정 파일
```
  lib/services/service-ops-api.ts  — BulkRowStatus, BulkRowResult, BulkPreviewResponse 타입 + bulk 메서드 추가
```

---

## Excel 컬럼 인덱스 (DATA_START_ROW 기준)

### vehicles-template.xlsx (DATA_START_ROW = 2)
| col | 값 | 비고 |
|-----|-----|------|
| 0 | plateNumber | upsert 키 |
| 1 | wheelType | "2륜" / "4륜" |
| 2 | engineType | "전기" / "내연" |
| 3 | imei | 선택, 15자리 |

### riders-template.xlsx (DATA_START_ROW = 2)
| col | 값 | 비고 |
|-----|-----|------|
| 0 | name | |
| 1 | phoneNumber | upsert 키 |
| 2 | trainingStatus | "온라인" / "오프라인" / "미완료" |
| 3 | teamName | 선택 |

### matching-template.xlsx (DATA_START_ROW = 3)
| col | 값 | 비고 |
|-----|-----|------|
| 0 | plateNumber | → bikeId 교차검증 |
| 1 | riderName | 참고용 |
| 2 | phoneNumber | → riderId 교차검증 |
| 3 | category | "구독" / "렌탈" |
| 4 | returnType | "인수형" / "반납형" |
| 5 | startAt | YYYY-MM-DD |
| 6 | endAt | YYYY-MM-DD |
| 7 | includesInsurance | "Y" / "N" (참고용) |

---

## Task 1: V30 DB Migration + BikeWheelType + RiderTrainingStatus enums

**Files:**
- Create: `service-ops-api/src/main/resources/db/migration/V30__add_bike_wheel_type_and_rider_training_status.sql`
- Create: `service-ops-api/src/main/java/com/thundercrew/opsapi/bike/domain/BikeWheelType.java`
- Create: `service-ops-api/src/main/java/com/thundercrew/opsapi/rider/domain/RiderTrainingStatus.java`

- [ ] **Step 1: Write migration SQL**

```sql
-- V30__add_bike_wheel_type_and_rider_training_status.sql
ALTER TABLE bikes ADD COLUMN wheel_type VARCHAR(20) NOT NULL DEFAULT 'TWO_WHEEL';
ALTER TABLE bikes ADD COLUMN imei VARCHAR(15);

ALTER TABLE riders ADD COLUMN training_status VARCHAR(20);
```

- [ ] **Step 2: Create BikeWheelType enum**

```java
// bike/domain/BikeWheelType.java
package com.thundercrew.opsapi.bike.domain;

public enum BikeWheelType {
    TWO_WHEEL,
    FOUR_WHEEL
}
```

- [ ] **Step 3: Create RiderTrainingStatus enum**

```java
// rider/domain/RiderTrainingStatus.java
package com.thundercrew.opsapi.rider.domain;

public enum RiderTrainingStatus {
    ONLINE,
    OFFLINE,
    INCOMPLETE
}
```

- [ ] **Step 4: Run tests to confirm migration applies cleanly**

```bash
cd service-ops-api
./gradlew test --tests "com.thundercrew.opsapi.BikeCommandApiContractTests" -i
```

Expected: PASS (existing tests still pass — migration is additive)

- [ ] **Step 5: Commit**

```bash
git add service-ops-api/src/main/resources/db/migration/V30__add_bike_wheel_type_and_rider_training_status.sql
git add service-ops-api/src/main/java/com/thundercrew/opsapi/bike/domain/BikeWheelType.java
git add service-ops-api/src/main/java/com/thundercrew/opsapi/rider/domain/RiderTrainingStatus.java
git commit -m "feat: V30 migration — add wheel_type/imei to bikes, training_status to riders"
```

---

## Task 2: Bike Entity + Rider Entity updates

**Files:**
- Modify: `service-ops-api/src/main/java/com/thundercrew/opsapi/bike/domain/Bike.java`
- Modify: `service-ops-api/src/main/java/com/thundercrew/opsapi/rider/domain/Rider.java`

- [ ] **Step 1: Add wheelType + imei to Bike**

In `Bike.java`, after the `engineType` field, add:

```java
@Enumerated(EnumType.STRING)
@Column(name = "wheel_type", nullable = false, length = 20)
private BikeWheelType wheelType = BikeWheelType.TWO_WHEEL;

@Column(length = 15)
private String imei;
```

Add getter and setter:

```java
public BikeWheelType getWheelType() { return wheelType; }
public void setWheelType(BikeWheelType wheelType) { this.wheelType = wheelType; }
public String getImei() { return imei; }
public void setImei(String imei) { this.imei = imei; }
```

- [ ] **Step 2: Add trainingStatus to Rider**

In `Rider.java`, after the `teamName` field, add:

```java
@Enumerated(EnumType.STRING)
@Column(name = "training_status", length = 20)
private RiderTrainingStatus trainingStatus;
```

Add getter and setter:

```java
public RiderTrainingStatus getTrainingStatus() { return trainingStatus; }
public void setTrainingStatus(RiderTrainingStatus trainingStatus) {
    this.trainingStatus = trainingStatus;
}
```

- [ ] **Step 3: Add updateDates to RiderBikeContract**

In `RiderBikeContract.java`, add:

```java
public void updateDates(UUID contractTemplateId, Instant startAt, Instant endAt) {
    this.contractTemplateId = contractTemplateId;
    this.startAt = startAt;
    this.endAt = endAt;
}
```

- [ ] **Step 4: Run tests**

```bash
./gradlew test --tests "com.thundercrew.opsapi.BikeCommandApiContractTests" -i
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add service-ops-api/src/main/java/com/thundercrew/opsapi/bike/domain/Bike.java
git add service-ops-api/src/main/java/com/thundercrew/opsapi/rider/domain/Rider.java
git add service-ops-api/src/main/java/com/thundercrew/opsapi/contract/domain/RiderBikeContract.java
git commit -m "feat: add wheelType/imei to Bike, trainingStatus to Rider, updateDates to RiderBikeContract"
```

---

## Task 3: Repository additions

**Files:**
- Modify: `service-ops-api/src/main/java/com/thundercrew/opsapi/bike/repository/BikeRepository.java`
- Modify: `service-ops-api/src/main/java/com/thundercrew/opsapi/rider/repository/RiderRepository.java`
- Modify: `service-ops-api/src/main/java/com/thundercrew/opsapi/contract/repository/ContractTemplateRepository.java`
- Modify: `service-ops-api/src/main/java/com/thundercrew/opsapi/contract/repository/RiderBikeContractRepository.java`

- [ ] **Step 1: Add to BikeRepository**

```java
Optional<Bike> findByPlateNumberAndDeletedAtIsNull(String plateNumber);

List<Bike> findAllByDeletedAtIsNull();
```

- [ ] **Step 2: Add to RiderRepository**

```java
Optional<Rider> findByPhoneNumberAndDeletedAtIsNull(String phoneNumber);

List<Rider> findAllByDeletedAtIsNull();
```

- [ ] **Step 3: Add to ContractTemplateRepository**

```java
import com.thundercrew.opsapi.contract.domain.ContractCategory;
import com.thundercrew.opsapi.contract.domain.ContractReturnType;

Optional<ContractTemplate> findFirstByCategoryAndReturnTypeAndEnabledTrueAndDeletedAtIsNull(
        ContractCategory category, ContractReturnType returnType);
```

- [ ] **Step 4: Add to RiderBikeContractRepository**

```java
import java.util.List;

@Query(value = """
        select * from rider_bike_contracts
        where bike_id = :bikeId
          and rider_id = :riderId
          and terminated_at is null
          and deleted_at is null
        """, nativeQuery = true)
Optional<RiderBikeContract> findActiveByBikeIdAndRiderId(
        @Param("bikeId") UUID bikeId,
        @Param("riderId") UUID riderId);

List<RiderBikeContract> findAllByTerminatedAtIsNullAndDeletedAtIsNull();
```

- [ ] **Step 5: Run tests**

```bash
./gradlew test -i
```

Expected: PASS (no behavior changes — only new query methods)

- [ ] **Step 6: Commit**

```bash
git add service-ops-api/src/main/java/com/thundercrew/opsapi/bike/repository/BikeRepository.java
git add service-ops-api/src/main/java/com/thundercrew/opsapi/rider/repository/RiderRepository.java
git add service-ops-api/src/main/java/com/thundercrew/opsapi/contract/repository/ContractTemplateRepository.java
git add service-ops-api/src/main/java/com/thundercrew/opsapi/contract/repository/RiderBikeContractRepository.java
git commit -m "feat: add findBy* lookup methods to repositories for bulk upsert"
```

---

## Task 4: Common bulk DTOs + Excel utilities

**Files:**
- Create: `common/bulk/BulkRowStatus.java`
- Create: `common/bulk/BulkRowResult.java`
- Create: `common/bulk/BulkSummary.java`
- Create: `common/bulk/BulkPreviewResponse.java`
- Create: `common/bulk/BulkApplyResponse.java`
- Create: `common/excel/ExcelParser.java`
- Create: `common/excel/ExcelExporter.java`

All files in package `com.thundercrew.opsapi.common.bulk` or `com.thundercrew.opsapi.common.excel`.

- [ ] **Step 1: Create BulkRowStatus enum**

```java
// common/bulk/BulkRowStatus.java
package com.thundercrew.opsapi.common.bulk;

public enum BulkRowStatus {
    UNCHANGED, UPDATE, NEW, ERROR
}
```

- [ ] **Step 2: Create BulkRowResult record**

```java
// common/bulk/BulkRowResult.java
package com.thundercrew.opsapi.common.bulk;

import java.util.List;

public record BulkRowResult(
        int rowNumber,
        BulkRowStatus status,
        String key,
        List<String> changes,
        String errorMessage
) {
    public static BulkRowResult unchanged(int row, String key) {
        return new BulkRowResult(row, BulkRowStatus.UNCHANGED, key, List.of(), null);
    }

    public static BulkRowResult update(int row, String key, List<String> changes) {
        return new BulkRowResult(row, BulkRowStatus.UPDATE, key, changes, null);
    }

    public static BulkRowResult newRow(int row, String key) {
        return new BulkRowResult(row, BulkRowStatus.NEW, key, List.of(), null);
    }

    public static BulkRowResult error(int row, String key, String message) {
        return new BulkRowResult(row, BulkRowStatus.ERROR, key, List.of(), message);
    }
}
```

- [ ] **Step 3: Create BulkSummary + BulkPreviewResponse + BulkApplyResponse**

```java
// common/bulk/BulkSummary.java
package com.thundercrew.opsapi.common.bulk;

import java.util.List;

public record BulkSummary(long unchanged, long update, long newRows, long error, long total) {
    public static BulkSummary of(List<BulkRowResult> rows) {
        long unchanged = rows.stream().filter(r -> r.status() == BulkRowStatus.UNCHANGED).count();
        long update    = rows.stream().filter(r -> r.status() == BulkRowStatus.UPDATE).count();
        long newRows   = rows.stream().filter(r -> r.status() == BulkRowStatus.NEW).count();
        long error     = rows.stream().filter(r -> r.status() == BulkRowStatus.ERROR).count();
        return new BulkSummary(unchanged, update, newRows, error, rows.size());
    }
}
```

```java
// common/bulk/BulkPreviewResponse.java
package com.thundercrew.opsapi.common.bulk;

import java.util.List;

public record BulkPreviewResponse(List<BulkRowResult> rows, BulkSummary summary) {
    public static BulkPreviewResponse of(List<BulkRowResult> rows) {
        return new BulkPreviewResponse(rows, BulkSummary.of(rows));
    }
}
```

```java
// common/bulk/BulkApplyResponse.java
package com.thundercrew.opsapi.common.bulk;

public record BulkApplyResponse(long applied, long skipped) {}
```

- [ ] **Step 4: Create ExcelParser**

```java
// common/excel/ExcelParser.java
package com.thundercrew.opsapi.common.excel;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;

public class ExcelParser {

    public static List<List<String>> parseRows(InputStream stream, int dataStartRow) throws IOException {
        try (Workbook wb = WorkbookFactory.create(stream)) {
            Sheet sheet = wb.getSheetAt(0);
            List<List<String>> result = new ArrayList<>();
            for (int i = dataStartRow; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null) continue;
                List<String> cells = new ArrayList<>();
                boolean allEmpty = true;
                for (int j = 0; j < row.getLastCellNum(); j++) {
                    String val = cellString(row.getCell(j));
                    cells.add(val);
                    if (!val.isBlank()) allEmpty = false;
                }
                if (!allEmpty) result.add(cells);
            }
            return result;
        }
    }

    private static String cellString(Cell cell) {
        if (cell == null) return "";
        return switch (cell.getCellType()) {
            case STRING -> cell.getStringCellValue().trim();
            case NUMERIC -> {
                double d = cell.getNumericCellValue();
                yield d == Math.floor(d) ? String.valueOf((long) d) : String.valueOf(d);
            }
            case BOOLEAN -> String.valueOf(cell.getBooleanCellValue());
            default -> "";
        };
    }
}
```

- [ ] **Step 5: Create ExcelExporter**

```java
// common/excel/ExcelExporter.java
package com.thundercrew.opsapi.common.excel;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;

public class ExcelExporter {

    public static byte[] export(Class<?> resourceBase, String templateName,
                                int dataStartRow, List<List<String>> rows) throws IOException {
        InputStream tpl = resourceBase.getResourceAsStream("/templates/excel/" + templateName);
        if (tpl == null) throw new IllegalStateException("Template not found: " + templateName);
        try (tpl; Workbook wb = WorkbookFactory.create(tpl)) {
            Sheet sheet = wb.getSheetAt(0);
            clearDataRows(sheet, dataStartRow);
            CellStyle unlocked = wb.createCellStyle();
            unlocked.setLocked(false);
            for (int i = 0; i < rows.size(); i++) {
                Row row = sheet.createRow(dataStartRow + i);
                List<String> cols = rows.get(i);
                for (int j = 0; j < cols.size(); j++) {
                    Cell cell = row.createCell(j);
                    cell.setCellValue(cols.get(j));
                    cell.setCellStyle(unlocked);
                }
            }
            sheet.protectSheet("");
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            wb.write(out);
            return out.toByteArray();
        }
    }

    private static void clearDataRows(Sheet sheet, int firstDataRow) {
        for (int i = sheet.getLastRowNum(); i >= firstDataRow; i--) {
            Row row = sheet.getRow(i);
            if (row != null) sheet.removeRow(row);
        }
    }
}
```

- [ ] **Step 6: Compile check**

```bash
./gradlew compileJava
```

Expected: BUILD SUCCESSFUL

- [ ] **Step 7: Commit**

```bash
git add service-ops-api/src/main/java/com/thundercrew/opsapi/common/
git commit -m "feat: BulkRowResult/BulkPreviewResponse DTOs + ExcelParser/ExcelExporter utilities"
```

---

## Task 5: Bike Bulk Backend

**Files:**
- Create: `bike/service/BikeBulkService.java`
- Create: `bike/controller/BikeBulkController.java`

- [ ] **Step 1: Write failing test (BikeBulkApiTests.java)**

```java
// src/test/java/com/thundercrew/opsapi/BikeBulkApiTests.java
package com.thundercrew.opsapi;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import java.io.ByteArrayOutputStream;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.apache.poi.ss.usermodel.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class BikeBulkApiTests extends PostgresContainerSupport {

    private static final UUID ADMIN_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final Pattern TOKEN_PATTERN = Pattern.compile("\"accessToken\"\\s*:\\s*\"([^\"]+)\"");

    @Autowired MockMvc mockMvc;
    @Autowired JdbcTemplate jdbcTemplate;
    @Autowired PasswordEncoder passwordEncoder;
    private String accessToken;

    @DynamicPropertySource
    static void postgresProperties(DynamicPropertyRegistry r) { registerPostgresProperties(r); }

    @BeforeEach
    void resetRows() throws Exception {
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

    @Test
    void previewNewBike() throws Exception {
        MockMultipartFile file = buildBikeExcel("12가3456", "2륜", "전기", "");

        mockMvc.perform(multipart("/api/v1/bikes/bulk-preview")
                        .file(file)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rows[0].status").value("NEW"))
                .andExpect(jsonPath("$.rows[0].key").value("12가3456"))
                .andExpect(jsonPath("$.summary.newRows").value(1))
                .andExpect(jsonPath("$.summary.total").value(1));
    }

    @Test
    void previewExistingUnchangedBike() throws Exception {
        jdbcTemplate.update("""
                insert into bikes (id, idx, plate_number, engine_type, service_type,
                                   operation_status, wheel_type, ignition_blocked)
                values (gen_random_uuid(), nextval('bikes_idx_seq'), '34나5678', 'ELECTRIC', 'DELIVERY',
                        'READY', 'TWO_WHEEL', false)
                """);

        MockMultipartFile file = buildBikeExcel("34나5678", "2륜", "전기", "");

        mockMvc.perform(multipart("/api/v1/bikes/bulk-preview")
                        .file(file)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rows[0].status").value("UNCHANGED"))
                .andExpect(jsonPath("$.summary.unchanged").value(1));
    }

    @Test
    void previewExistingUpdateBike() throws Exception {
        jdbcTemplate.update("""
                insert into bikes (id, idx, plate_number, engine_type, service_type,
                                   operation_status, wheel_type, ignition_blocked)
                values (gen_random_uuid(), nextval('bikes_idx_seq'), '56다7890', 'ELECTRIC', 'DELIVERY',
                        'READY', 'TWO_WHEEL', false)
                """);

        MockMultipartFile file = buildBikeExcel("56다7890", "4륜", "전기", "");

        mockMvc.perform(multipart("/api/v1/bikes/bulk-preview")
                        .file(file)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rows[0].status").value("UPDATE"))
                .andExpect(jsonPath("$.rows[0].changes[0]").value("wheelType"))
                .andExpect(jsonPath("$.summary.update").value(1));
    }

    @Test
    void applyCreatesAndUpdatesBikes() throws Exception {
        jdbcTemplate.update("""
                insert into bikes (id, idx, plate_number, engine_type, service_type,
                                   operation_status, wheel_type, ignition_blocked)
                values (gen_random_uuid(), nextval('bikes_idx_seq'), '34나5678', 'ELECTRIC', 'DELIVERY',
                        'READY', 'TWO_WHEEL', false)
                """);

        // File: 1 new + 1 existing with changed wheelType
        MockMultipartFile file = buildBikeExcelMultiRow(
                new String[]{"12가3456", "2륜", "전기", ""},
                new String[]{"34나5678", "4륜", "전기", ""}
        );

        mockMvc.perform(multipart("/api/v1/bikes/bulk-apply")
                        .file(file)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.applied").value(2))
                .andExpect(jsonPath("$.skipped").value(0));
    }

    @Test
    void exportReturnsBikeSpreadsheet() throws Exception {
        jdbcTemplate.update("""
                insert into bikes (id, idx, plate_number, engine_type, service_type,
                                   operation_status, wheel_type, ignition_blocked)
                values (gen_random_uuid(), nextval('bikes_idx_seq'), '12가3456', 'ELECTRIC', 'DELIVERY',
                        'READY', 'TWO_WHEEL', false)
                """);

        mockMvc.perform(get("/api/v1/bikes/export")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_TYPE,
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
    }

    // --- helpers ---

    private String loginAndExtractToken() throws Exception {
        MvcResult r = mockMvc.perform(
                org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"loginId\":\"ops-admin\",\"password\":\"correct-password\"}"))
                .andReturn();
        Matcher m = TOKEN_PATTERN.matcher(r.getResponse().getContentAsString());
        if (!m.find()) throw new IllegalStateException("No token in response");
        return m.group(1);
    }

    private MockMultipartFile buildBikeExcel(String plate, String wheel, String engine, String imei)
            throws Exception {
        return buildBikeExcelMultiRow(new String[]{plate, wheel, engine, imei});
    }

    private MockMultipartFile buildBikeExcelMultiRow(String[]... rows) throws Exception {
        XSSFWorkbook wb = new XSSFWorkbook();
        Sheet sheet = wb.createSheet();
        sheet.createRow(0); // header row 1
        sheet.createRow(1); // header row 2 (columns)
        for (int i = 0; i < rows.length; i++) {
            Row row = sheet.createRow(2 + i);
            for (int j = 0; j < rows[i].length; j++) {
                row.createCell(j).setCellValue(rows[i][j]);
            }
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        wb.write(out);
        wb.close();
        return new MockMultipartFile("file", "bikes.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                out.toByteArray());
    }
}
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
./gradlew test --tests "com.thundercrew.opsapi.BikeBulkApiTests" -i 2>&1 | tail -20
```

Expected: FAIL with 404 (endpoints not yet created)

- [ ] **Step 3: Create BikeBulkService**

```java
// bike/service/BikeBulkService.java
package com.thundercrew.opsapi.bike.service;

import com.thundercrew.opsapi.bike.domain.Bike;
import com.thundercrew.opsapi.bike.domain.BikeEngineType;
import com.thundercrew.opsapi.bike.domain.BikeOperationStatus;
import com.thundercrew.opsapi.bike.domain.BikeServiceType;
import com.thundercrew.opsapi.bike.domain.BikeWheelType;
import com.thundercrew.opsapi.bike.repository.BikeRepository;
import com.thundercrew.opsapi.common.bulk.BulkApplyResponse;
import com.thundercrew.opsapi.common.bulk.BulkPreviewResponse;
import com.thundercrew.opsapi.common.bulk.BulkRowResult;
import com.thundercrew.opsapi.common.excel.ExcelExporter;
import com.thundercrew.opsapi.common.excel.ExcelParser;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BikeBulkService {

    private static final int DATA_START_ROW = 2;

    private final BikeRepository bikeRepository;

    public BikeBulkService(BikeRepository bikeRepository) {
        this.bikeRepository = bikeRepository;
    }

    public BulkPreviewResponse preview(InputStream excelStream) throws IOException {
        List<List<String>> rows = ExcelParser.parseRows(excelStream, DATA_START_ROW);
        List<BulkRowResult> results = new ArrayList<>();
        int rowNum = DATA_START_ROW + 2; // 1-indexed Excel row number
        for (List<String> cols : rows) {
            results.add(evaluateRow(cols, rowNum++));
        }
        return BulkPreviewResponse.of(results);
    }

    @Transactional
    public BulkApplyResponse apply(InputStream excelStream) throws IOException {
        List<List<String>> rows = ExcelParser.parseRows(excelStream, DATA_START_ROW);
        long applied = 0, skipped = 0;
        for (List<String> cols : rows) {
            try {
                String plateNumber = cell(cols, 0);
                if (plateNumber.isBlank()) { skipped++; continue; }
                BikeWheelType wheelType = parseWheelType(cell(cols, 1));
                BikeEngineType engineType = parseEngineType(cell(cols, 2));
                String imei = cell(cols, 3).isBlank() ? null : cell(cols, 3);

                Optional<Bike> existing = bikeRepository.findByPlateNumberAndDeletedAtIsNull(plateNumber);
                if (existing.isPresent()) {
                    Bike bike = existing.get();
                    bike.setWheelType(wheelType);
                    bike.setImei(imei);
                    // engineType update via existing updateBasicProfile
                    bike.updateBasicProfile(null, null, null, engineType, null, null);
                    bikeRepository.save(bike);
                } else {
                    Bike bike = Bike.create(plateNumber, null, null, engineType,
                            BikeServiceType.DELIVERY, BikeOperationStatus.READY, null);
                    bike.setWheelType(wheelType);
                    bike.setImei(imei);
                    bikeRepository.save(bike);
                }
                applied++;
            } catch (Exception e) {
                skipped++;
            }
        }
        return new BulkApplyResponse(applied, skipped);
    }

    public byte[] export() throws IOException {
        List<Bike> bikes = bikeRepository.findAllByDeletedAtIsNull();
        List<List<String>> rows = bikes.stream().map(b -> List.of(
                b.getPlateNumber(),
                b.getWheelType() == BikeWheelType.TWO_WHEEL ? "2륜" : "4륜",
                b.getEngineType() == BikeEngineType.ELECTRIC ? "전기" : "내연",
                b.getImei() != null ? b.getImei() : ""
        )).toList();
        return ExcelExporter.export(BikeBulkService.class, "vehicles-template.xlsx",
                DATA_START_ROW, rows);
    }

    private BulkRowResult evaluateRow(List<String> cols, int rowNum) {
        String plateNumber = cell(cols, 0);
        if (plateNumber.isBlank()) return BulkRowResult.error(rowNum, "(빈 행)", "차량번호 없음");
        try {
            BikeWheelType newWheel = parseWheelType(cell(cols, 1));
            BikeEngineType newEngine = parseEngineType(cell(cols, 2));
            String newImei = cell(cols, 3).isBlank() ? null : cell(cols, 3);
            Optional<Bike> existing = bikeRepository.findByPlateNumberAndDeletedAtIsNull(plateNumber);
            if (existing.isEmpty()) return BulkRowResult.newRow(rowNum, plateNumber);
            Bike bike = existing.get();
            List<String> changes = new ArrayList<>();
            if (bike.getWheelType() != newWheel) changes.add("wheelType");
            if (bike.getEngineType() != newEngine) changes.add("engineType");
            if (!equalNullable(bike.getImei(), newImei)) changes.add("imei");
            return changes.isEmpty()
                    ? BulkRowResult.unchanged(rowNum, plateNumber)
                    : BulkRowResult.update(rowNum, plateNumber, changes);
        } catch (IllegalArgumentException e) {
            return BulkRowResult.error(rowNum, plateNumber, e.getMessage());
        }
    }

    private BikeWheelType parseWheelType(String val) {
        return switch (val) {
            case "2륜" -> BikeWheelType.TWO_WHEEL;
            case "4륜" -> BikeWheelType.FOUR_WHEEL;
            default -> throw new IllegalArgumentException("알 수 없는 차종: " + val);
        };
    }

    private BikeEngineType parseEngineType(String val) {
        return switch (val) {
            case "전기" -> BikeEngineType.ELECTRIC;
            case "내연" -> BikeEngineType.ICE;
            default -> throw new IllegalArgumentException("알 수 없는 동력: " + val);
        };
    }

    private static String cell(List<String> cols, int idx) {
        return idx < cols.size() ? cols.get(idx) : "";
    }

    private static boolean equalNullable(String a, String b) {
        if (a == null && b == null) return true;
        if (a == null || b == null) return false;
        return a.equals(b);
    }
}
```

- [ ] **Step 4: Create BikeBulkController**

```java
// bike/controller/BikeBulkController.java
package com.thundercrew.opsapi.bike.controller;

import com.thundercrew.opsapi.bike.service.BikeBulkService;
import com.thundercrew.opsapi.common.bulk.BulkApplyResponse;
import com.thundercrew.opsapi.common.bulk.BulkPreviewResponse;
import java.io.IOException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/bikes")
public class BikeBulkController {

    private final BikeBulkService bikeBulkService;

    public BikeBulkController(BikeBulkService bikeBulkService) {
        this.bikeBulkService = bikeBulkService;
    }

    @PostMapping("/bulk-preview")
    BulkPreviewResponse bulkPreview(@RequestPart("file") MultipartFile file) throws IOException {
        return bikeBulkService.preview(file.getInputStream());
    }

    @PostMapping("/bulk-apply")
    BulkApplyResponse bulkApply(@RequestPart("file") MultipartFile file) throws IOException {
        return bikeBulkService.apply(file.getInputStream());
    }

    @GetMapping("/export")
    ResponseEntity<byte[]> export() throws IOException {
        byte[] bytes = bikeBulkService.export();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"vehicles.xlsx\"")
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(bytes);
    }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
./gradlew test --tests "com.thundercrew.opsapi.BikeBulkApiTests" -i
```

Expected: PASS (4/4)

- [ ] **Step 6: Commit**

```bash
git add service-ops-api/src/main/java/com/thundercrew/opsapi/bike/service/BikeBulkService.java
git add service-ops-api/src/main/java/com/thundercrew/opsapi/bike/controller/BikeBulkController.java
git add service-ops-api/src/test/java/com/thundercrew/opsapi/BikeBulkApiTests.java
git commit -m "feat: bike bulk preview/apply/export endpoints"
```

---

## Task 6: Rider Bulk Backend

**Files:**
- Create: `rider/service/RiderBulkService.java`
- Create: `rider/controller/RiderBulkController.java`
- Test: `src/test/java/com/thundercrew/opsapi/RiderBulkApiTests.java`

- [ ] **Step 1: Write failing test**

```java
// src/test/java/com/thundercrew/opsapi/RiderBulkApiTests.java
package com.thundercrew.opsapi;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.ByteArrayOutputStream;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.apache.poi.ss.usermodel.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class RiderBulkApiTests extends PostgresContainerSupport {

    private static final UUID ADMIN_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final Pattern TOKEN_PATTERN = Pattern.compile("\"accessToken\"\\s*:\\s*\"([^\"]+)\"");

    @Autowired MockMvc mockMvc;
    @Autowired JdbcTemplate jdbcTemplate;
    @Autowired PasswordEncoder passwordEncoder;
    private String accessToken;

    @DynamicPropertySource
    static void postgresProperties(DynamicPropertyRegistry r) { registerPostgresProperties(r); }

    @BeforeEach
    void resetRows() throws Exception {
        jdbcTemplate.update("delete from rider_bike_contracts");
        jdbcTemplate.update("delete from riders");
        jdbcTemplate.update("delete from admin_users");
        jdbcTemplate.update("""
                insert into admin_users (id, login_id, email, password_hash, display_name, enabled)
                values (?, 'ops-admin', 'ops@example.test', ?, 'Ops Admin', true)
                """, ADMIN_ID, passwordEncoder.encode("correct-password"));
        accessToken = loginAndExtractToken();
    }

    @Test
    void previewNewRider() throws Exception {
        MockMultipartFile file = buildRiderExcel("홍길동", "010-1234-5678", "온라인", "팀A");

        mockMvc.perform(multipart("/api/v1/riders/bulk-preview")
                        .file(file)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rows[0].status").value("NEW"))
                .andExpect(jsonPath("$.rows[0].key").value("010-1234-5678"))
                .andExpect(jsonPath("$.summary.newRows").value(1));
    }

    @Test
    void previewUpdateRider() throws Exception {
        jdbcTemplate.update("""
                insert into riders (id, idx, name, phone_number, app_account_linked)
                values (gen_random_uuid(), nextval('riders_idx_seq'), '홍길동', '010-1234-5678', false)
                """);

        MockMultipartFile file = buildRiderExcel("홍길동", "010-1234-5678", "온라인", "팀B");

        mockMvc.perform(multipart("/api/v1/riders/bulk-preview")
                        .file(file)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rows[0].status").value("UPDATE"))
                .andExpect(jsonPath("$.summary.update").value(1));
    }

    @Test
    void applyCreatesRider() throws Exception {
        MockMultipartFile file = buildRiderExcel("홍길동", "010-1234-5678", "온라인", "팀A");

        mockMvc.perform(multipart("/api/v1/riders/bulk-apply")
                        .file(file)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.applied").value(1));
    }

    private String loginAndExtractToken() throws Exception {
        MvcResult r = mockMvc.perform(
                org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"loginId\":\"ops-admin\",\"password\":\"correct-password\"}"))
                .andReturn();
        Matcher m = TOKEN_PATTERN.matcher(r.getResponse().getContentAsString());
        if (!m.find()) throw new IllegalStateException("No token in response");
        return m.group(1);
    }

    private MockMultipartFile buildRiderExcel(String name, String phone, String training, String team)
            throws Exception {
        XSSFWorkbook wb = new XSSFWorkbook();
        Sheet sheet = wb.createSheet();
        sheet.createRow(0);
        sheet.createRow(1);
        Row row = sheet.createRow(2);
        row.createCell(0).setCellValue(name);
        row.createCell(1).setCellValue(phone);
        row.createCell(2).setCellValue(training);
        row.createCell(3).setCellValue(team);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        wb.write(out);
        wb.close();
        return new MockMultipartFile("file", "riders.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                out.toByteArray());
    }
}
```

- [ ] **Step 2: Run test to confirm failure**

```bash
./gradlew test --tests "com.thundercrew.opsapi.RiderBulkApiTests" -i 2>&1 | tail -10
```

Expected: FAIL (404)

- [ ] **Step 3: Create RiderBulkService**

```java
// rider/service/RiderBulkService.java
package com.thundercrew.opsapi.rider.service;

import com.thundercrew.opsapi.common.bulk.BulkApplyResponse;
import com.thundercrew.opsapi.common.bulk.BulkPreviewResponse;
import com.thundercrew.opsapi.common.bulk.BulkRowResult;
import com.thundercrew.opsapi.common.excel.ExcelExporter;
import com.thundercrew.opsapi.common.excel.ExcelParser;
import com.thundercrew.opsapi.rider.domain.Rider;
import com.thundercrew.opsapi.rider.domain.RiderTrainingStatus;
import com.thundercrew.opsapi.rider.repository.RiderRepository;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RiderBulkService {

    private static final int DATA_START_ROW = 2;

    private final RiderRepository riderRepository;

    public RiderBulkService(RiderRepository riderRepository) {
        this.riderRepository = riderRepository;
    }

    public BulkPreviewResponse preview(InputStream excelStream) throws IOException {
        List<List<String>> rows = ExcelParser.parseRows(excelStream, DATA_START_ROW);
        List<BulkRowResult> results = new ArrayList<>();
        int rowNum = DATA_START_ROW + 2;
        for (List<String> cols : rows) {
            results.add(evaluateRow(cols, rowNum++));
        }
        return BulkPreviewResponse.of(results);
    }

    @Transactional
    public BulkApplyResponse apply(InputStream excelStream) throws IOException {
        List<List<String>> rows = ExcelParser.parseRows(excelStream, DATA_START_ROW);
        long applied = 0, skipped = 0;
        for (List<String> cols : rows) {
            try {
                String name = cell(cols, 0);
                String phone = cell(cols, 1);
                if (name.isBlank() || phone.isBlank()) { skipped++; continue; }
                RiderTrainingStatus training = parseTraining(cell(cols, 2));
                String team = cell(cols, 3).isBlank() ? null : cell(cols, 3);

                Optional<Rider> existing = riderRepository.findByPhoneNumberAndDeletedAtIsNull(phone);
                if (existing.isPresent()) {
                    Rider rider = existing.get();
                    rider.updateBasicProfile(name, null, team, null, null);
                    rider.setTrainingStatus(training);
                    riderRepository.save(rider);
                } else {
                    Rider rider = Rider.create(name, phone, team, null, null);
                    rider.setTrainingStatus(training);
                    riderRepository.save(rider);
                }
                applied++;
            } catch (Exception e) {
                skipped++;
            }
        }
        return new BulkApplyResponse(applied, skipped);
    }

    public byte[] export() throws IOException {
        List<Rider> riders = riderRepository.findAllByDeletedAtIsNull();
        List<List<String>> rows = riders.stream().map(r -> List.of(
                r.getName(),
                r.getPhoneNumber(),
                trainingLabel(r.getTrainingStatus()),
                r.getTeamName() != null ? r.getTeamName() : ""
        )).toList();
        return ExcelExporter.export(RiderBulkService.class, "riders-template.xlsx",
                DATA_START_ROW, rows);
    }

    private BulkRowResult evaluateRow(List<String> cols, int rowNum) {
        String phone = cell(cols, 1);
        if (phone.isBlank()) return BulkRowResult.error(rowNum, "(빈 행)", "연락처 없음");
        try {
            String name = cell(cols, 0);
            RiderTrainingStatus training = parseTraining(cell(cols, 2));
            String team = cell(cols, 3).isBlank() ? null : cell(cols, 3);
            Optional<Rider> existing = riderRepository.findByPhoneNumberAndDeletedAtIsNull(phone);
            if (existing.isEmpty()) return BulkRowResult.newRow(rowNum, phone);
            Rider rider = existing.get();
            List<String> changes = new ArrayList<>();
            if (!rider.getName().equals(name)) changes.add("name");
            if (!equalNullable(trainingLabel(rider.getTrainingStatus()), cell(cols, 2))) changes.add("trainingStatus");
            if (!equalNullable(rider.getTeamName(), team)) changes.add("teamName");
            return changes.isEmpty()
                    ? BulkRowResult.unchanged(rowNum, phone)
                    : BulkRowResult.update(rowNum, phone, changes);
        } catch (IllegalArgumentException e) {
            return BulkRowResult.error(rowNum, phone, e.getMessage());
        }
    }

    private RiderTrainingStatus parseTraining(String val) {
        return switch (val) {
            case "온라인" -> RiderTrainingStatus.ONLINE;
            case "오프라인" -> RiderTrainingStatus.OFFLINE;
            case "미완료", "" -> RiderTrainingStatus.INCOMPLETE;
            default -> throw new IllegalArgumentException("알 수 없는 교육이수: " + val);
        };
    }

    private String trainingLabel(RiderTrainingStatus status) {
        if (status == null) return "미완료";
        return switch (status) {
            case ONLINE -> "온라인";
            case OFFLINE -> "오프라인";
            case INCOMPLETE -> "미완료";
        };
    }

    private static String cell(List<String> cols, int idx) {
        return idx < cols.size() ? cols.get(idx) : "";
    }

    private static boolean equalNullable(String a, String b) {
        if (a == null && b == null) return true;
        if (a == null || b == null) return false;
        return a.equals(b);
    }
}
```

- [ ] **Step 4: Create RiderBulkController**

```java
// rider/controller/RiderBulkController.java
package com.thundercrew.opsapi.rider.controller;

import com.thundercrew.opsapi.common.bulk.BulkApplyResponse;
import com.thundercrew.opsapi.common.bulk.BulkPreviewResponse;
import com.thundercrew.opsapi.rider.service.RiderBulkService;
import java.io.IOException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/riders")
public class RiderBulkController {

    private final RiderBulkService riderBulkService;

    public RiderBulkController(RiderBulkService riderBulkService) {
        this.riderBulkService = riderBulkService;
    }

    @PostMapping("/bulk-preview")
    BulkPreviewResponse bulkPreview(@RequestPart("file") MultipartFile file) throws IOException {
        return riderBulkService.preview(file.getInputStream());
    }

    @PostMapping("/bulk-apply")
    BulkApplyResponse bulkApply(@RequestPart("file") MultipartFile file) throws IOException {
        return riderBulkService.apply(file.getInputStream());
    }

    @GetMapping("/export")
    ResponseEntity<byte[]> export() throws IOException {
        byte[] bytes = riderBulkService.export();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"riders.xlsx\"")
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(bytes);
    }
}
```

- [ ] **Step 5: Run tests**

```bash
./gradlew test --tests "com.thundercrew.opsapi.RiderBulkApiTests" -i
```

Expected: PASS (3/3)

- [ ] **Step 6: Commit**

```bash
git add service-ops-api/src/main/java/com/thundercrew/opsapi/rider/service/RiderBulkService.java
git add service-ops-api/src/main/java/com/thundercrew/opsapi/rider/controller/RiderBulkController.java
git add service-ops-api/src/test/java/com/thundercrew/opsapi/RiderBulkApiTests.java
git commit -m "feat: rider bulk preview/apply/export endpoints"
```

---

## Task 7: Contract Bulk Backend

**Files:**
- Create: `contract/service/ContractBulkService.java`
- Create: `contract/controller/ContractBulkController.java`
- Test: `src/test/java/com/thundercrew/opsapi/ContractBulkApiTests.java`

- [ ] **Step 1: Write failing test**

```java
// src/test/java/com/thundercrew/opsapi/ContractBulkApiTests.java
package com.thundercrew.opsapi;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.ByteArrayOutputStream;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.apache.poi.ss.usermodel.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ContractBulkApiTests extends PostgresContainerSupport {

    private static final UUID ADMIN_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final UUID TEMPLATE_ID = UUID.fromString("cccccccc-cccc-cccc-cccc-cccccccccccc");
    private static final UUID BIKE_ID = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private static final UUID RIDER_ID = UUID.fromString("dddddddd-dddd-dddd-dddd-dddddddddddd");
    private static final Pattern TOKEN_PATTERN = Pattern.compile("\"accessToken\"\\s*:\\s*\"([^\"]+)\"");

    @Autowired MockMvc mockMvc;
    @Autowired JdbcTemplate jdbcTemplate;
    @Autowired PasswordEncoder passwordEncoder;
    private String accessToken;

    @DynamicPropertySource
    static void postgresProperties(DynamicPropertyRegistry r) { registerPostgresProperties(r); }

    @BeforeEach
    void resetRows() throws Exception {
        jdbcTemplate.update("delete from rider_bike_contracts");
        jdbcTemplate.update("delete from riders");
        jdbcTemplate.update("delete from bike_operation_status_histories");
        jdbcTemplate.update("delete from bikes");
        jdbcTemplate.update("delete from contract_templates");
        jdbcTemplate.update("delete from admin_users");
        jdbcTemplate.update("""
                insert into admin_users (id, login_id, email, password_hash, display_name, enabled)
                values (?, 'ops-admin', 'ops@example.test', ?, 'Ops Admin', true)
                """, ADMIN_ID, passwordEncoder.encode("correct-password"));
        jdbcTemplate.update("""
                insert into bikes (id, idx, plate_number, engine_type, service_type,
                                   operation_status, wheel_type, ignition_blocked)
                values (?, nextval('bikes_idx_seq'), '12가3456', 'ELECTRIC', 'DELIVERY', 'READY',
                        'TWO_WHEEL', false)
                """, BIKE_ID);
        jdbcTemplate.update("""
                insert into riders (id, idx, name, phone_number, app_account_linked)
                values (?, nextval('riders_idx_seq'), '홍길동', '010-1234-5678', false)
                """, RIDER_ID);
        jdbcTemplate.update("""
                insert into contract_templates (id, idx, name, category, return_type,
                                                enabled, system_template, includes_insurance)
                values (?, nextval('contract_templates_idx_seq'), '구독-인수형', 'SUBSCRIPTION', 'TAKEOVER',
                        true, false, false)
                """, TEMPLATE_ID);
        accessToken = loginAndExtractToken();
    }

    @Test
    void previewNewContract() throws Exception {
        MockMultipartFile file = buildContractExcel(
                "12가3456", "홍길동", "010-1234-5678", "구독", "인수형", "2026-07-01", "2027-06-30", "N");

        mockMvc.perform(multipart("/api/v1/contracts/bulk-preview")
                        .file(file)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rows[0].status").value("NEW"))
                .andExpect(jsonPath("$.summary.newRows").value(1));
    }

    @Test
    void previewErrorWhenBikeNotFound() throws Exception {
        MockMultipartFile file = buildContractExcel(
                "99나9999", "홍길동", "010-1234-5678", "구독", "인수형", "2026-07-01", "2027-06-30", "N");

        mockMvc.perform(multipart("/api/v1/contracts/bulk-preview")
                        .file(file)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rows[0].status").value("ERROR"))
                .andExpect(jsonPath("$.summary.error").value(1));
    }

    @Test
    void previewErrorWhenRiderNotFound() throws Exception {
        MockMultipartFile file = buildContractExcel(
                "12가3456", "김철수", "010-9999-9999", "구독", "인수형", "2026-07-01", "2027-06-30", "N");

        mockMvc.perform(multipart("/api/v1/contracts/bulk-preview")
                        .file(file)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rows[0].status").value("ERROR"));
    }

    @Test
    void applyCreatesContract() throws Exception {
        MockMultipartFile file = buildContractExcel(
                "12가3456", "홍길동", "010-1234-5678", "구독", "인수형", "2026-07-01", "2027-06-30", "N");

        mockMvc.perform(multipart("/api/v1/contracts/bulk-apply")
                        .file(file)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.applied").value(1));
    }

    private String loginAndExtractToken() throws Exception {
        MvcResult r = mockMvc.perform(
                org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"loginId\":\"ops-admin\",\"password\":\"correct-password\"}"))
                .andReturn();
        Matcher m = TOKEN_PATTERN.matcher(r.getResponse().getContentAsString());
        if (!m.find()) throw new IllegalStateException("No token in response");
        return m.group(1);
    }

    private MockMultipartFile buildContractExcel(String plate, String riderName, String phone,
            String category, String returnType, String startAt, String endAt, String insurance)
            throws Exception {
        XSSFWorkbook wb = new XSSFWorkbook();
        Sheet sheet = wb.createSheet();
        sheet.createRow(0);
        sheet.createRow(1);
        sheet.createRow(2);
        Row row = sheet.createRow(3); // DATA_START_ROW = 3
        row.createCell(0).setCellValue(plate);
        row.createCell(1).setCellValue(riderName);
        row.createCell(2).setCellValue(phone);
        row.createCell(3).setCellValue(category);
        row.createCell(4).setCellValue(returnType);
        row.createCell(5).setCellValue(startAt);
        row.createCell(6).setCellValue(endAt);
        row.createCell(7).setCellValue(insurance);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        wb.write(out);
        wb.close();
        return new MockMultipartFile("file", "matching.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                out.toByteArray());
    }
}
```

- [ ] **Step 2: Run to confirm failure**

```bash
./gradlew test --tests "com.thundercrew.opsapi.ContractBulkApiTests" -i 2>&1 | tail -10
```

Expected: FAIL (404)

- [ ] **Step 3: Create ContractBulkService**

```java
// contract/service/ContractBulkService.java
package com.thundercrew.opsapi.contract.service;

import com.thundercrew.opsapi.bike.domain.Bike;
import com.thundercrew.opsapi.bike.repository.BikeRepository;
import com.thundercrew.opsapi.common.bulk.BulkApplyResponse;
import com.thundercrew.opsapi.common.bulk.BulkPreviewResponse;
import com.thundercrew.opsapi.common.bulk.BulkRowResult;
import com.thundercrew.opsapi.common.excel.ExcelExporter;
import com.thundercrew.opsapi.common.excel.ExcelParser;
import com.thundercrew.opsapi.contract.domain.ContractCategory;
import com.thundercrew.opsapi.contract.domain.ContractReturnType;
import com.thundercrew.opsapi.contract.domain.ContractTemplate;
import com.thundercrew.opsapi.contract.domain.RiderBikeContract;
import com.thundercrew.opsapi.contract.repository.ContractTemplateRepository;
import com.thundercrew.opsapi.contract.repository.RiderBikeContractRepository;
import com.thundercrew.opsapi.rider.domain.Rider;
import com.thundercrew.opsapi.rider.repository.RiderRepository;
import java.io.IOException;
import java.io.InputStream;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ContractBulkService {

    private static final int DATA_START_ROW = 3;

    private final BikeRepository bikeRepository;
    private final RiderRepository riderRepository;
    private final ContractTemplateRepository templateRepository;
    private final RiderBikeContractRepository contractRepository;

    public ContractBulkService(
            BikeRepository bikeRepository,
            RiderRepository riderRepository,
            ContractTemplateRepository templateRepository,
            RiderBikeContractRepository contractRepository) {
        this.bikeRepository = bikeRepository;
        this.riderRepository = riderRepository;
        this.templateRepository = templateRepository;
        this.contractRepository = contractRepository;
    }

    public BulkPreviewResponse preview(InputStream excelStream) throws IOException {
        List<List<String>> rows = ExcelParser.parseRows(excelStream, DATA_START_ROW);
        List<BulkRowResult> results = new ArrayList<>();
        int rowNum = DATA_START_ROW + 2;
        for (List<String> cols : rows) {
            results.add(evaluateRow(cols, rowNum++));
        }
        return BulkPreviewResponse.of(results);
    }

    @Transactional
    public BulkApplyResponse apply(InputStream excelStream) throws IOException {
        List<List<String>> rows = ExcelParser.parseRows(excelStream, DATA_START_ROW);
        long applied = 0, skipped = 0;
        for (List<String> cols : rows) {
            try {
                String plate = cell(cols, 0);
                String phone = cell(cols, 2);
                if (plate.isBlank() || phone.isBlank()) { skipped++; continue; }

                Optional<Bike> bike = bikeRepository.findByPlateNumberAndDeletedAtIsNull(plate);
                Optional<Rider> rider = riderRepository.findByPhoneNumberAndDeletedAtIsNull(phone);
                if (bike.isEmpty() || rider.isEmpty()) { skipped++; continue; }

                ContractCategory category = parseCategory(cell(cols, 3));
                ContractReturnType returnType = parseReturnType(cell(cols, 4));
                Optional<ContractTemplate> template = templateRepository
                        .findFirstByCategoryAndReturnTypeAndEnabledTrueAndDeletedAtIsNull(category, returnType);
                if (template.isEmpty()) { skipped++; continue; }

                Instant startAt = parseDate(cell(cols, 5));
                Instant endAt = parseDate(cell(cols, 6));

                Optional<RiderBikeContract> existing = contractRepository
                        .findActiveByBikeIdAndRiderId(bike.get().getId(), rider.get().getId());
                if (existing.isPresent()) {
                    existing.get().updateDates(template.get().getId(), startAt, endAt);
                    contractRepository.save(existing.get());
                } else {
                    contractRepository.save(RiderBikeContract.create(
                            rider.get().getId(), bike.get().getId(),
                            template.get().getId(), startAt, endAt, null));
                }
                applied++;
            } catch (Exception e) {
                skipped++;
            }
        }
        return new BulkApplyResponse(applied, skipped);
    }

    public byte[] export() throws IOException {
        List<RiderBikeContract> contracts = contractRepository
                .findAllByTerminatedAtIsNullAndDeletedAtIsNull();
        List<List<String>> rows = contracts.stream().map(c -> List.of(
                "", "", "", "", "", // cross-ref fields need join — return empty for now
                c.getStartAt().toString(),
                c.getEndAt() != null ? c.getEndAt().toString() : "",
                "N"
        )).toList();
        return ExcelExporter.export(ContractBulkService.class, "matching-template.xlsx",
                DATA_START_ROW, rows);
    }

    private BulkRowResult evaluateRow(List<String> cols, int rowNum) {
        String plate = cell(cols, 0);
        String phone = cell(cols, 2);
        String key = plate + " / " + phone;
        if (plate.isBlank() || phone.isBlank())
            return BulkRowResult.error(rowNum, key, "차량번호 또는 연락처 없음");
        try {
            Optional<Bike> bike = bikeRepository.findByPlateNumberAndDeletedAtIsNull(plate);
            if (bike.isEmpty()) return BulkRowResult.error(rowNum, key, "차량 없음: " + plate);
            Optional<Rider> rider = riderRepository.findByPhoneNumberAndDeletedAtIsNull(phone);
            if (rider.isEmpty()) return BulkRowResult.error(rowNum, key, "라이더 없음: " + phone);
            ContractCategory category = parseCategory(cell(cols, 3));
            ContractReturnType returnType = parseReturnType(cell(cols, 4));
            Optional<ContractTemplate> template = templateRepository
                    .findFirstByCategoryAndReturnTypeAndEnabledTrueAndDeletedAtIsNull(category, returnType);
            if (template.isEmpty())
                return BulkRowResult.error(rowNum, key,
                        "계약 템플릿 없음: " + cell(cols, 3) + "/" + cell(cols, 4));
            Optional<RiderBikeContract> existing = contractRepository
                    .findActiveByBikeIdAndRiderId(bike.get().getId(), rider.get().getId());
            if (existing.isEmpty()) return BulkRowResult.newRow(rowNum, key);
            List<String> changes = new ArrayList<>();
            if (!existing.get().getContractTemplateId().equals(template.get().getId())) changes.add("template");
            Instant newStart = parseDate(cell(cols, 5));
            Instant newEnd = parseDate(cell(cols, 6));
            if (!existing.get().getStartAt().equals(newStart)) changes.add("startAt");
            if (!equalNullable(existing.get().getEndAt(), newEnd)) changes.add("endAt");
            return changes.isEmpty()
                    ? BulkRowResult.unchanged(rowNum, key)
                    : BulkRowResult.update(rowNum, key, changes);
        } catch (IllegalArgumentException e) {
            return BulkRowResult.error(rowNum, key, e.getMessage());
        }
    }

    private ContractCategory parseCategory(String val) {
        return switch (val) {
            case "구독" -> ContractCategory.SUBSCRIPTION;
            case "렌탈" -> ContractCategory.RENTAL;
            default -> throw new IllegalArgumentException("알 수 없는 계약구분: " + val);
        };
    }

    private ContractReturnType parseReturnType(String val) {
        return switch (val) {
            case "인수형" -> ContractReturnType.TAKEOVER;
            case "반납형" -> ContractReturnType.RETURN;
            default -> throw new IllegalArgumentException("알 수 없는 반납형태: " + val);
        };
    }

    private Instant parseDate(String val) {
        return LocalDate.parse(val).atStartOfDay(ZoneOffset.UTC).toInstant();
    }

    private static String cell(List<String> cols, int idx) {
        return idx < cols.size() ? cols.get(idx) : "";
    }

    private static boolean equalNullable(Instant a, Instant b) {
        if (a == null && b == null) return true;
        if (a == null || b == null) return false;
        return a.equals(b);
    }
}
```

- [ ] **Step 4: Create ContractBulkController**

```java
// contract/controller/ContractBulkController.java
package com.thundercrew.opsapi.contract.controller;

import com.thundercrew.opsapi.common.bulk.BulkApplyResponse;
import com.thundercrew.opsapi.common.bulk.BulkPreviewResponse;
import com.thundercrew.opsapi.contract.service.ContractBulkService;
import java.io.IOException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/contracts")
public class ContractBulkController {

    private final ContractBulkService contractBulkService;

    public ContractBulkController(ContractBulkService contractBulkService) {
        this.contractBulkService = contractBulkService;
    }

    @PostMapping("/bulk-preview")
    BulkPreviewResponse bulkPreview(@RequestPart("file") MultipartFile file) throws IOException {
        return contractBulkService.preview(file.getInputStream());
    }

    @PostMapping("/bulk-apply")
    BulkApplyResponse bulkApply(@RequestPart("file") MultipartFile file) throws IOException {
        return contractBulkService.apply(file.getInputStream());
    }

    @GetMapping("/export")
    ResponseEntity<byte[]> export() throws IOException {
        byte[] bytes = contractBulkService.export();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"matching.xlsx\"")
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(bytes);
    }
}
```

- [ ] **Step 5: Run tests**

```bash
./gradlew test --tests "com.thundercrew.opsapi.ContractBulkApiTests" -i
```

Expected: PASS (4/4)

- [ ] **Step 6: Run full test suite**

```bash
./gradlew test -i 2>&1 | tail -20
```

Expected: BUILD SUCCESSFUL, all tests pass

- [ ] **Step 7: Commit**

```bash
git add service-ops-api/src/main/java/com/thundercrew/opsapi/contract/service/ContractBulkService.java
git add service-ops-api/src/main/java/com/thundercrew/opsapi/contract/controller/ContractBulkController.java
git add service-ops-api/src/test/java/com/thundercrew/opsapi/ContractBulkApiTests.java
git commit -m "feat: contract bulk preview/apply/export endpoints with cross-validation"
```

---

## Task 8: Frontend Types + API Client Methods

**Files:**
- Modify: `front-admin-web/lib/services/service-ops-api.ts`

- [ ] **Step 1: Add types to service-ops-api.ts**

At the end of the type definitions section (around line 930, after `ServiceOpsTestMatching`), add:

```typescript
// ─── Bulk Import/Export ───────────────────────────────────────────

export type BulkRowStatus = 'UNCHANGED' | 'UPDATE' | 'NEW' | 'ERROR';

export interface BulkRowResult {
  rowNumber: number;
  status: BulkRowStatus;
  key: string;
  changes: string[];
  errorMessage: string | null;
}

export interface BulkSummary {
  unchanged: number;
  update: number;
  newRows: number;
  error: number;
  total: number;
}

export interface BulkPreviewResponse {
  rows: BulkRowResult[];
  summary: BulkSummary;
}

export interface BulkApplyResponse {
  applied: number;
  skipped: number;
}
```

- [ ] **Step 2: Add bulk methods to ServiceOpsApiClient interface**

In the `ServiceOpsApiClient` type (around line 956), add:

```typescript
  // Bulk import/export — vehicles
  bulkPreviewVehicles(file: File): Promise<BulkPreviewResponse>;
  bulkApplyVehicles(file: File): Promise<BulkApplyResponse>;
  exportVehiclesUrl(): string;

  // Bulk import/export — riders
  bulkPreviewRiders(file: File): Promise<BulkPreviewResponse>;
  bulkApplyRiders(file: File): Promise<BulkApplyResponse>;
  exportRidersUrl(): string;

  // Bulk import/export — matching
  bulkPreviewContracts(file: File): Promise<BulkPreviewResponse>;
  bulkApplyContracts(file: File): Promise<BulkApplyResponse>;
  exportContractsUrl(): string;
```

- [ ] **Step 3: Implement bulk methods in createServiceOpsApiClient**

Inside the `createServiceOpsApiClient` function implementation (near the other method implementations), add:

```typescript
    async bulkPreviewVehicles(file: File): Promise<BulkPreviewResponse> {
      const form = new FormData();
      form.append('file', file);
      return fetchJson<BulkPreviewResponse>('/api/v1/bikes/bulk-preview', {
        method: 'POST', body: form,
      });
    },
    async bulkApplyVehicles(file: File): Promise<BulkApplyResponse> {
      const form = new FormData();
      form.append('file', file);
      return fetchJson<BulkApplyResponse>('/api/v1/bikes/bulk-apply', {
        method: 'POST', body: form,
      });
    },
    exportVehiclesUrl(): string { return baseUrl + '/api/v1/bikes/export'; },

    async bulkPreviewRiders(file: File): Promise<BulkPreviewResponse> {
      const form = new FormData();
      form.append('file', file);
      return fetchJson<BulkPreviewResponse>('/api/v1/riders/bulk-preview', {
        method: 'POST', body: form,
      });
    },
    async bulkApplyRiders(file: File): Promise<BulkApplyResponse> {
      const form = new FormData();
      form.append('file', file);
      return fetchJson<BulkApplyResponse>('/api/v1/riders/bulk-apply', {
        method: 'POST', body: form,
      });
    },
    exportRidersUrl(): string { return baseUrl + '/api/v1/riders/export'; },

    async bulkPreviewContracts(file: File): Promise<BulkPreviewResponse> {
      const form = new FormData();
      form.append('file', file);
      return fetchJson<BulkPreviewResponse>('/api/v1/contracts/bulk-preview', {
        method: 'POST', body: form,
      });
    },
    async bulkApplyContracts(file: File): Promise<BulkApplyResponse> {
      const form = new FormData();
      form.append('file', file);
      return fetchJson<BulkApplyResponse>('/api/v1/contracts/bulk-apply', {
        method: 'POST', body: form,
      });
    },
    exportContractsUrl(): string { return baseUrl + '/api/v1/contracts/export'; },
```

Note: `fetchJson` is the internal helper already used in this file — check its signature before adding (look for `fetchJson` definition in the file). The FormData upload should NOT set `Content-Type` manually — browser sets it automatically with boundary.

- [ ] **Step 4: Typecheck**

```bash
cd front-admin-web
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add front-admin-web/lib/services/service-ops-api.ts
git commit -m "feat: bulk import/export types and API client methods"
```

---

## Task 9: Server Actions

**Files:**
- Create: `app/management/vehicles/actions.ts`
- Create: `app/management/riders/actions.ts`
- Create: `app/management/matching/actions.ts`

- [ ] **Step 1: Create vehicles actions**

```typescript
// app/management/vehicles/actions.ts
'use server';

import { serviceOpsApiBaseUrl } from '@/lib/services/service-ops-api';
import { redirect } from 'next/navigation';
import type { BulkPreviewResponse, BulkApplyResponse } from '@/lib/services/service-ops-api';

const BASE = serviceOpsApiBaseUrl();
const AUTH = process.env.SERVICE_OPS_API_TOKEN ?? '';

async function postFormData(path: string, formData: FormData) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${AUTH}` },
    body: formData,
  });
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return res.json();
}

export async function bulkPreviewVehiclesAction(
  formData: FormData
): Promise<BulkPreviewResponse> {
  return postFormData('/api/v1/bikes/bulk-preview', formData);
}

export async function bulkApplyVehiclesAction(
  formData: FormData
): Promise<BulkApplyResponse> {
  return postFormData('/api/v1/bikes/bulk-apply', formData);
}
```

- [ ] **Step 2: Create riders actions**

```typescript
// app/management/riders/actions.ts
'use server';

import { serviceOpsApiBaseUrl } from '@/lib/services/service-ops-api';
import type { BulkPreviewResponse, BulkApplyResponse } from '@/lib/services/service-ops-api';

const BASE = serviceOpsApiBaseUrl();
const AUTH = process.env.SERVICE_OPS_API_TOKEN ?? '';

async function postFormData(path: string, formData: FormData) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${AUTH}` },
    body: formData,
  });
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return res.json();
}

export async function bulkPreviewRidersAction(
  formData: FormData
): Promise<BulkPreviewResponse> {
  return postFormData('/api/v1/riders/bulk-preview', formData);
}

export async function bulkApplyRidersAction(
  formData: FormData
): Promise<BulkApplyResponse> {
  return postFormData('/api/v1/riders/bulk-apply', formData);
}
```

- [ ] **Step 3: Create matching actions**

```typescript
// app/management/matching/actions.ts
'use server';

import { serviceOpsApiBaseUrl } from '@/lib/services/service-ops-api';
import type { BulkPreviewResponse, BulkApplyResponse } from '@/lib/services/service-ops-api';

const BASE = serviceOpsApiBaseUrl();
const AUTH = process.env.SERVICE_OPS_API_TOKEN ?? '';

async function postFormData(path: string, formData: FormData) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${AUTH}` },
    body: formData,
  });
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return res.json();
}

export async function bulkPreviewContractsAction(
  formData: FormData
): Promise<BulkPreviewResponse> {
  return postFormData('/api/v1/contracts/bulk-preview', formData);
}

export async function bulkApplyContractsAction(
  formData: FormData
): Promise<BulkApplyResponse> {
  return postFormData('/api/v1/contracts/bulk-apply', formData);
}
```

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add front-admin-web/app/management/
git commit -m "feat: server actions for bulk preview/apply (vehicles, riders, matching)"
```

---

## Task 10: BulkPreviewModal + ExcelImportButton Components

**Files:**
- Create: `components/management/BulkPreviewModal.tsx`
- Create: `components/management/BulkPreviewModal.css`
- Create: `components/management/ExcelImportButton.tsx`

- [ ] **Step 1: Create BulkPreviewModal.css**

```css
/* components/management/BulkPreviewModal.css */
.bpm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.bpm-dialog {
  background: var(--card-bg, #fff);
  border-radius: 8px;
  width: 90vw;
  max-width: 800px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.bpm-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color, #e2e8f0);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.bpm-title { font-size: 16px; font-weight: 600; }

.bpm-close {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 18px;
  padding: 4px;
  color: var(--text-muted, #64748b);
}

.bpm-summary {
  padding: 12px 20px;
  display: flex;
  gap: 16px;
  font-size: 13px;
  border-bottom: 1px solid var(--border-color, #e2e8f0);
}

.bpm-badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 600;
}

.bpm-badge-unchanged { background: #f1f5f9; color: #475569; }
.bpm-badge-update    { background: #fef3c7; color: #92400e; }
.bpm-badge-new       { background: #dcfce7; color: #166534; }
.bpm-badge-error     { background: #fee2e2; color: #991b1b; }

.bpm-table-wrap { overflow-y: auto; flex: 1; }

.bpm-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.bpm-table th {
  background: var(--table-header-bg, #f8fafc);
  padding: 8px 12px;
  text-align: left;
  font-weight: 600;
  position: sticky;
  top: 0;
  border-bottom: 1px solid var(--border-color, #e2e8f0);
}

.bpm-table td {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color, #e2e8f0);
}

.bpm-row-unchanged { }
.bpm-row-update { background: #fffbeb; }
.bpm-row-new    { background: #f0fdf4; }
.bpm-row-error  { background: #fef2f2; }

.bpm-footer {
  padding: 12px 20px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  border-top: 1px solid var(--border-color, #e2e8f0);
}

.bpm-btn-cancel {
  padding: 8px 16px;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 6px;
  background: none;
  cursor: pointer;
}

.bpm-btn-apply {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  background: var(--primary, #2563eb);
  color: #fff;
  cursor: pointer;
  font-weight: 600;
}

.bpm-btn-apply:disabled { opacity: 0.5; cursor: not-allowed; }
```

- [ ] **Step 2: Create BulkPreviewModal.tsx**

```tsx
// components/management/BulkPreviewModal.tsx
'use client';

import '@/components/management/BulkPreviewModal.css';
import type { BulkPreviewResponse, BulkRowStatus } from '@/lib/services/service-ops-api';

interface Props {
  preview: BulkPreviewResponse;
  onApply: () => Promise<void>;
  onClose: () => void;
  applying: boolean;
}

const STATUS_LABEL: Record<BulkRowStatus, string> = {
  UNCHANGED: '변경없음',
  UPDATE: '업데이트',
  NEW: '신규',
  ERROR: '오류',
};

export function BulkPreviewModal({ preview, onApply, onClose, applying }: Props) {
  const { rows, summary } = preview;

  return (
    <div className="bpm-overlay" onClick={onClose}>
      <div className="bpm-dialog" onClick={e => e.stopPropagation()}>
        <div className="bpm-header">
          <span className="bpm-title">업로드 미리보기</span>
          <button className="bpm-close" onClick={onClose}>✕</button>
        </div>
        <div className="bpm-summary">
          <span className="bpm-badge bpm-badge-unchanged">변경없음 {summary.unchanged}</span>
          <span className="bpm-badge bpm-badge-update">업데이트 {summary.update}</span>
          <span className="bpm-badge bpm-badge-new">신규 {summary.newRows}</span>
          <span className="bpm-badge bpm-badge-error">오류 {summary.error}</span>
          <span>총 {summary.total}행</span>
        </div>
        <div className="bpm-table-wrap">
          <table className="bpm-table">
            <thead>
              <tr>
                <th>행</th>
                <th>상태</th>
                <th>키</th>
                <th>변경 필드</th>
                <th>오류 메시지</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.rowNumber} className={`bpm-row-${row.status.toLowerCase()}`}>
                  <td>{row.rowNumber}</td>
                  <td>{STATUS_LABEL[row.status]}</td>
                  <td>{row.key}</td>
                  <td>{row.changes.join(', ')}</td>
                  <td>{row.errorMessage ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bpm-footer">
          <button className="bpm-btn-cancel" onClick={onClose} disabled={applying}>
            취소
          </button>
          <button className="bpm-btn-apply" onClick={onApply} disabled={applying}>
            {applying ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create ExcelImportButton.tsx**

```tsx
// components/management/ExcelImportButton.tsx
'use client';

import { useRef, useState } from 'react';
import { BulkPreviewModal } from './BulkPreviewModal';
import type { BulkPreviewResponse, BulkApplyResponse } from '@/lib/services/service-ops-api';

interface Props {
  onPreview: (formData: FormData) => Promise<BulkPreviewResponse>;
  onApply: (formData: FormData) => Promise<BulkApplyResponse>;
  onApplied: () => void;
  label?: string;
}

export function ExcelImportButton({ onPreview, onApply, onApplied, label = 'Excel 업로드' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<BulkPreviewResponse | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const result = await onPreview(form);
      setPreview(result);
      setPendingFile(file);
    } catch (err) {
      setError('미리보기 실패: ' + String(err));
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleApply() {
    if (!pendingFile) return;
    setApplying(true);
    try {
      const form = new FormData();
      form.append('file', pendingFile);
      await onApply(form);
      setPreview(null);
      setPendingFile(null);
      onApplied();
    } catch (err) {
      setError('저장 실패: ' + String(err));
    } finally {
      setApplying(false);
    }
  }

  function handleClose() {
    setPreview(null);
    setPendingFile(null);
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <button onClick={() => inputRef.current?.click()}>{label}</button>
      {error && <span style={{ color: 'red', fontSize: 12 }}>{error}</span>}
      {preview && (
        <BulkPreviewModal
          preview={preview}
          onApply={handleApply}
          onClose={handleClose}
          applying={applying}
        />
      )}
    </>
  );
}
```

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add front-admin-web/components/management/BulkPreviewModal.tsx
git add front-admin-web/components/management/BulkPreviewModal.css
git add front-admin-web/components/management/ExcelImportButton.tsx
git commit -m "feat: BulkPreviewModal + ExcelImportButton shared components"
```

---

## Task 11: Management Pages (Vehicles, Riders, Matching)

**Files:**
- Create: `components/management/VehiclesManagementPanel.tsx`
- Create: `components/management/RidersManagementPanel.tsx`
- Create: `components/management/MatchingManagementPanel.tsx`
- Create: `app/management/vehicles/page.tsx`
- Create: `app/management/riders/page.tsx`
- Create: `app/management/matching/page.tsx`

- [ ] **Step 1: Create VehiclesManagementPanel.tsx**

```tsx
// components/management/VehiclesManagementPanel.tsx
'use client';

import { useCallback, useTransition } from 'react';
import { ExcelImportButton } from './ExcelImportButton';
import { bulkPreviewVehiclesAction, bulkApplyVehiclesAction } from '@/app/management/vehicles/actions';
import type { ServiceOpsBike } from '@/lib/services/service-ops-api';

interface Props {
  bikes: ServiceOpsBike[];
  exportUrl: string;
  onRefresh: () => void;
}

export function VehiclesManagementPanel({ bikes, exportUrl, onRefresh }: Props) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <a href={exportUrl} download>Excel 내려받기</a>
        <ExcelImportButton
          onPreview={bulkPreviewVehiclesAction}
          onApply={bulkApplyVehiclesAction}
          onApplied={onRefresh}
          label="Excel 업로드"
        />
      </div>
      <table>
        <thead>
          <tr>
            <th>차량번호</th>
            <th>동력</th>
            <th>서비스</th>
            <th>상태</th>
          </tr>
        </thead>
        <tbody>
          {bikes.map(bike => (
            <tr key={bike.id}>
              <td>{bike.plateNumber}</td>
              <td>{bike.engineType}</td>
              <td>{bike.serviceType}</td>
              <td>{bike.operationStatus}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Create management/vehicles/page.tsx**

First check how the service client is created in other pages (e.g. `app/test-matching/page.tsx` pattern with `loadTestMatchingData`). Then create:

```tsx
// app/management/vehicles/page.tsx
import { AppShell } from '@/components/layout/AppShell';
import { VehiclesManagementPanel } from '@/components/management/VehiclesManagementPanel';
import { createServiceOpsApiClient, serviceOpsApiBaseUrl } from '@/lib/services/service-ops-api';

export const dynamic = 'force-dynamic';
export const metadata = { title: '차량 관리' };

export default async function VehiclesManagementPage() {
  const baseUrl = serviceOpsApiBaseUrl();
  const client = baseUrl ? createServiceOpsApiClient({ baseUrl }) : null;
  const bikes = client ? (await client.listBikes({ page: 0, size: 1000 })).content : [];
  const exportUrl = client?.exportVehiclesUrl() ?? '#';

  return (
    <AppShell>
      <h1>차량 관리</h1>
      <VehiclesManagementPanel
        bikes={bikes}
        exportUrl={exportUrl}
        onRefresh={() => {}}
      />
    </AppShell>
  );
}
```

Note: Check that `client.listBikes` exists; if the method name is different, check `ServiceOpsApiClient` type and use the correct method name.

- [ ] **Step 3: Create RidersManagementPanel.tsx**

```tsx
// components/management/RidersManagementPanel.tsx
'use client';

import { ExcelImportButton } from './ExcelImportButton';
import { bulkPreviewRidersAction, bulkApplyRidersAction } from '@/app/management/riders/actions';
import type { ServiceOpsRider } from '@/lib/services/service-ops-api';

interface Props {
  riders: ServiceOpsRider[];
  exportUrl: string;
  onRefresh: () => void;
}

export function RidersManagementPanel({ riders, exportUrl, onRefresh }: Props) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <a href={exportUrl} download>Excel 내려받기</a>
        <ExcelImportButton
          onPreview={bulkPreviewRidersAction}
          onApply={bulkApplyRidersAction}
          onApplied={onRefresh}
          label="Excel 업로드"
        />
      </div>
      <table>
        <thead>
          <tr>
            <th>이름</th>
            <th>연락처</th>
            <th>팀</th>
          </tr>
        </thead>
        <tbody>
          {riders.map(rider => (
            <tr key={rider.id}>
              <td>{rider.name}</td>
              <td>{rider.phoneNumber}</td>
              <td>{rider.teamName ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Create management/riders/page.tsx**

```tsx
// app/management/riders/page.tsx
import { AppShell } from '@/components/layout/AppShell';
import { RidersManagementPanel } from '@/components/management/RidersManagementPanel';
import { createServiceOpsApiClient, serviceOpsApiBaseUrl } from '@/lib/services/service-ops-api';

export const dynamic = 'force-dynamic';
export const metadata = { title: '라이더 관리' };

export default async function RidersManagementPage() {
  const baseUrl = serviceOpsApiBaseUrl();
  const client = baseUrl ? createServiceOpsApiClient({ baseUrl }) : null;
  const riders = client ? (await client.listRiders({ page: 0, size: 1000 })).content : [];
  const exportUrl = client?.exportRidersUrl() ?? '#';

  return (
    <AppShell>
      <h1>라이더 관리</h1>
      <RidersManagementPanel
        riders={riders}
        exportUrl={exportUrl}
        onRefresh={() => {}}
      />
    </AppShell>
  );
}
```

Note: Verify method name `listRiders` in `ServiceOpsApiClient` type.

- [ ] **Step 5: Create MatchingManagementPanel.tsx**

```tsx
// components/management/MatchingManagementPanel.tsx
'use client';

import { ExcelImportButton } from './ExcelImportButton';
import { bulkPreviewContractsAction, bulkApplyContractsAction } from '@/app/management/matching/actions';
import type { ServiceOpsRiderBikeContract } from '@/lib/services/service-ops-api';

interface Props {
  contracts: ServiceOpsRiderBikeContract[];
  exportUrl: string;
  onRefresh: () => void;
}

export function MatchingManagementPanel({ contracts, exportUrl, onRefresh }: Props) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <a href={exportUrl} download>Excel 내려받기</a>
        <ExcelImportButton
          onPreview={bulkPreviewContractsAction}
          onApply={bulkApplyContractsAction}
          onApplied={onRefresh}
          label="Excel 업로드"
        />
      </div>
      <table>
        <thead>
          <tr>
            <th>라이더</th>
            <th>차량</th>
            <th>시작일</th>
            <th>종료일</th>
          </tr>
        </thead>
        <tbody>
          {contracts.map(c => (
            <tr key={c.id}>
              <td>{c.riderId}</td>
              <td>{c.bikeId}</td>
              <td>{new Date(c.startAt).toLocaleDateString('ko-KR')}</td>
              <td>{c.endAt ? new Date(c.endAt).toLocaleDateString('ko-KR') : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 6: Create management/matching/page.tsx**

```tsx
// app/management/matching/page.tsx
import { AppShell } from '@/components/layout/AppShell';
import { MatchingManagementPanel } from '@/components/management/MatchingManagementPanel';
import { createServiceOpsApiClient, serviceOpsApiBaseUrl } from '@/lib/services/service-ops-api';

export const dynamic = 'force-dynamic';
export const metadata = { title: '매칭 관리' };

export default async function MatchingManagementPage() {
  const baseUrl = serviceOpsApiBaseUrl();
  const client = baseUrl ? createServiceOpsApiClient({ baseUrl }) : null;
  const contracts = client ? (await client.listContracts({ page: 0, size: 1000 })).content : [];
  const exportUrl = client?.exportContractsUrl() ?? '#';

  return (
    <AppShell>
      <h1>매칭 관리</h1>
      <MatchingManagementPanel
        contracts={contracts}
        exportUrl={exportUrl}
        onRefresh={() => {}}
      />
    </AppShell>
  );
}
```

Note: Verify method name `listContracts` in `ServiceOpsApiClient` type.

- [ ] **Step 7: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors. If `listBikes`/`listRiders`/`listContracts` method names are wrong, check `ServiceOpsApiClient` type and fix accordingly.

- [ ] **Step 8: Commit**

```bash
git add front-admin-web/components/management/
git add front-admin-web/app/management/
git commit -m "feat: management pages for vehicles/riders/matching with Excel import/export"
```

---

## Task 12: Final Verification + PR

- [ ] **Step 1: Run full backend test suite**

```bash
cd service-ops-api
./gradlew test -i 2>&1 | tail -30
```

Expected: BUILD SUCCESSFUL, all tests pass

- [ ] **Step 2: Run frontend typecheck + build**

```bash
cd front-admin-web
npx tsc --noEmit && npm run build
```

Expected: no type errors, build success

- [ ] **Step 3: Create PR**

```bash
git push -u origin HEAD
gh pr create \
  --title "feat: Group B — Excel Import/Export for vehicles/riders/matching" \
  --body "$(cat <<'EOF'
## Summary
- V30 DB migration: add wheel_type/imei to bikes, training_status to riders
- Backend bulk endpoints: POST /bulk-preview, POST /bulk-apply, GET /export for bikes/riders/contracts
- Cross-validation for contract bulk (bike by plateNumber, rider by phoneNumber, template by category+returnType)
- Frontend: management pages at /management/vehicles, /riders, /matching
- Shared BulkPreviewModal + ExcelImportButton components

## Test Plan
- [ ] Run `./gradlew test` in service-ops-api — all tests pass
- [ ] Run `npx tsc --noEmit` in front-admin-web — no errors
- [ ] Upload vehicles Excel to /management/vehicles → preview shows UNCHANGED/UPDATE/NEW/ERROR rows
- [ ] Click 저장 → page refreshes with updated data
- [ ] Click Excel 내려받기 → file downloads
EOF
)"
```

---

## Notes

- `ExcelImportButton` passes server action directly as prop — this is valid in Next.js 14+ for client→server action interop.
- The export URL for vehicles/riders returns the auth-protected backend endpoint. For production, consider proxying through Next.js route handler to attach auth token server-side.
- `VehiclesManagementPanel`/`RidersManagementPanel` panels use `onRefresh={() => {}}` as a no-op in SSR pages. For live refresh, convert to Client Component using `router.refresh()` from `next/navigation`.
