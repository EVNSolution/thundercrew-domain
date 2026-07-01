# Vehicle Service Type Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 차량에 서비스 유형(배송/클리닝/기타)을 추가해 백엔드 DB에 저장하고, 프론트엔드에서 필터 탭과 편집 폼으로 관리할 수 있게 한다.

**Architecture:** 백엔드(service-ops-api, Java Spring Boot)에 `BikeServiceType` enum과 Flyway 마이그레이션을 추가하고, 기존 `engineType` 패턴을 그대로 따라 DTO·서비스·컨트롤러를 수정한다. 프론트엔드(front-admin-web, Next.js)에서는 타입·API 클라이언트·편집 폼·필터 탭·지도 필터를 순서대로 추가한다.

**Tech Stack:** Java 17, Spring Boot, JPA, Flyway, PostgreSQL / Next.js 14, TypeScript, React

---

## File Map

### Backend (service-ops-api)

| 파일 | 역할 |
|------|------|
| `bike/domain/BikeServiceType.java` | 새 enum DELIVERY / CLEANING / OTHER |
| `db/migration/V25__add_bikes_service_type.sql` | bikes 테이블에 service_type 컬럼 추가 |
| `bike/domain/Bike.java` | serviceType 필드·getter·create·updateBasicProfile |
| `bike/dto/BikeCreateRequest.java` | serviceType 파라미터 (nullable, 기본 DELIVERY) |
| `bike/dto/BikeUpdateRequest.java` | serviceType 파라미터 (nullable = 변경 없음) |
| `bike/dto/BikeReadResponse.java` | serviceType 응답 필드 |
| `bike/service/BikeCommandService.java` | create/update에서 serviceType 처리 |
| `test/BikeCommandApiContractTests.java` | serviceType 포함 create/update 계약 테스트 |

### Frontend (front-admin-web)

| 파일 | 역할 |
|------|------|
| `lib/services/service-ops-api.ts` | ServiceOpsBikeServiceType 타입·FrontendVehicle 확장·toFrontendVehicle |
| `components/overview/ServiceTypeFilterTabs.tsx` | 재사용 필터 탭 컴포넌트 (전체/배송/클리닝/기타) |
| `components/management/VehicleDetailDialog.tsx` | 편집 폼에 serviceType select + 뷰에 유형 표시 |
| `app/actions.ts` | updateVehicleFromOverviewAction에 serviceType 전달 |
| `components/management/VehiclesPanel.tsx` | ServiceTypeFilterTabs 연결 + 목록 필터링 |
| `components/overview/OverviewMapBanner.tsx` | ServiceTypeFilterTabs 연결 + 지도 마커 필터링 |
| `components/overview/FullscreenMapHost.tsx` | 동일 (전체화면 지도) |
| `app/globals.css` | 필터 탭 스타일 |

---

## Task 1: BikeServiceType enum + DB 마이그레이션

**Files:**
- Create: `development/service-ops-api/src/main/java/com/thundercrew/opsapi/bike/domain/BikeServiceType.java`
- Create: `development/service-ops-api/src/main/resources/db/migration/V25__add_bikes_service_type.sql`

- [ ] **Step 1: BikeServiceType enum 생성**

```java
// development/service-ops-api/src/main/java/com/thundercrew/opsapi/bike/domain/BikeServiceType.java
package com.thundercrew.opsapi.bike.domain;

/**
 * 차량의 서비스 유형. 배송(오토바이)과 클리닝(자동차)을 운영자 필터·알림 분기의
 * 기준 축으로 구분한다. engineType(동력 종류)과 직교하는 독립 분류.
 */
public enum BikeServiceType {
    /** 배송 서비스 (오토바이). 기존 차량의 기본값. */
    DELIVERY,
    /** 클리닝 서비스 (자동차). 세스코라이프케어 등. */
    CLEANING,
    /** 기타 서비스. */
    OTHER
}
```

- [ ] **Step 2: Flyway 마이그레이션 SQL 생성**

```sql
-- development/service-ops-api/src/main/resources/db/migration/V25__add_bikes_service_type.sql
-- 차량의 서비스 유형을 저장하는 컬럼. engineType(동력)과 직교하는 분류.
-- 기존 행은 모두 배송 차량으로 간주해 DELIVERY 기본값으로 초기화.
alter table bikes
    add column service_type varchar(20) not null default 'DELIVERY';

update bikes set service_type = 'DELIVERY' where service_type is null;

alter table bikes
    add constraint ck_bikes_service_type
        check (service_type in ('DELIVERY', 'CLEANING', 'OTHER'));

create index ix_bikes_service_type_active
    on bikes(service_type)
    where deleted_at is null;
```

- [ ] **Step 3: 백엔드 테스트 실행해서 기존 테스트 통과 확인**

```bash
cd development/service-ops-api
./gradlew test
```

Expected: 모든 기존 테스트 PASS (마이그레이션만 추가됐고 로직 변경 없음)

- [ ] **Step 4: 커밋**

```bash
git add development/service-ops-api/src/main/java/com/thundercrew/opsapi/bike/domain/BikeServiceType.java
git add development/service-ops-api/src/main/resources/db/migration/V25__add_bikes_service_type.sql
git commit -m "feat(service-ops-api): BikeServiceType enum + V25 마이그레이션 추가"
```

---

## Task 2: Bike 엔티티에 serviceType 필드 추가

**Files:**
- Modify: `development/service-ops-api/src/main/java/com/thundercrew/opsapi/bike/domain/Bike.java`

- [ ] **Step 1: Bike.java에 serviceType 필드 추가**

`engineType` 필드 바로 아래에 삽입:

```java
@Enumerated(EnumType.STRING)
@Column(name = "service_type", nullable = false, length = 20)
private BikeServiceType serviceType;
```

import 추가 (파일 상단):
```java
import com.thundercrew.opsapi.bike.domain.BikeServiceType;
```

- [ ] **Step 2: create() 팩토리 메서드에 serviceType 추가**

기존:
```java
public static Bike create(
        String plateNumber,
        String vin,
        String modelName,
        BikeEngineType engineType,
        BikeOperationStatus operationStatus,
        String memo
) {
    Bike bike = new Bike();
    bike.plateNumber = plateNumber;
    bike.vin = vin;
    bike.modelName = modelName;
    bike.engineType = engineType;
    bike.operationStatus = operationStatus;
    bike.memo = memo;
    return bike;
}
```

변경 후:
```java
public static Bike create(
        String plateNumber,
        String vin,
        String modelName,
        BikeEngineType engineType,
        BikeServiceType serviceType,
        BikeOperationStatus operationStatus,
        String memo
) {
    Bike bike = new Bike();
    bike.plateNumber = plateNumber;
    bike.vin = vin;
    bike.modelName = modelName;
    bike.engineType = engineType;
    bike.serviceType = serviceType;
    bike.operationStatus = operationStatus;
    bike.memo = memo;
    return bike;
}
```

- [ ] **Step 3: updateBasicProfile()에 serviceType 추가**

기존:
```java
public void updateBasicProfile(
        String plateNumber,
        String vin,
        String modelName,
        BikeEngineType engineType,
        String memo
) {
    if (plateNumber != null) { this.plateNumber = plateNumber; }
    if (vin != null) { this.vin = vin; }
    if (modelName != null) { this.modelName = modelName; }
    if (engineType != null) { this.engineType = engineType; }
    if (memo != null) { this.memo = memo; }
}
```

변경 후:
```java
public void updateBasicProfile(
        String plateNumber,
        String vin,
        String modelName,
        BikeEngineType engineType,
        BikeServiceType serviceType,
        String memo
) {
    if (plateNumber != null) { this.plateNumber = plateNumber; }
    if (vin != null) { this.vin = vin; }
    if (modelName != null) { this.modelName = modelName; }
    if (engineType != null) { this.engineType = engineType; }
    if (serviceType != null) { this.serviceType = serviceType; }
    if (memo != null) { this.memo = memo; }
}
```

- [ ] **Step 4: getter 추가** (`getEngineType()` 아래에)

```java
public BikeServiceType getServiceType() {
    return serviceType;
}
```

- [ ] **Step 5: 컴파일 확인**

```bash
cd development/service-ops-api
./gradlew compileJava
```

Expected: BUILD SUCCESSFUL (BikeCommandService가 아직 old signature 참조 → 다음 Task에서 수정)
실제로는 컴파일 에러가 날 것임 — Task 3에서 BikeCommandService 수정 후 함께 통과 확인.

- [ ] **Step 6: 커밋**

```bash
git add development/service-ops-api/src/main/java/com/thundercrew/opsapi/bike/domain/Bike.java
git commit -m "feat(service-ops-api): Bike 엔티티에 serviceType 필드 추가"
```

---

## Task 3: DTO + 서비스 레이어 업데이트

**Files:**
- Modify: `development/service-ops-api/src/main/java/com/thundercrew/opsapi/bike/dto/BikeCreateRequest.java`
- Modify: `development/service-ops-api/src/main/java/com/thundercrew/opsapi/bike/dto/BikeUpdateRequest.java`
- Modify: `development/service-ops-api/src/main/java/com/thundercrew/opsapi/bike/dto/BikeReadResponse.java`
- Modify: `development/service-ops-api/src/main/java/com/thundercrew/opsapi/bike/service/BikeCommandService.java`

- [ ] **Step 1: BikeCreateRequest.java 수정**

```java
package com.thundercrew.opsapi.bike.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.thundercrew.opsapi.bike.domain.BikeEngineType;
import com.thundercrew.opsapi.bike.domain.BikeOperationStatus;
import com.thundercrew.opsapi.bike.domain.BikeServiceType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

@JsonIgnoreProperties(ignoreUnknown = true)
public record BikeCreateRequest(
        @NotBlank @Size(max = 50) String plateNumber,
        @Size(max = 100) String vin,
        @Size(max = 100) String modelName,
        BikeEngineType engineType,
        /**
         * 서비스 유형. null 이면 서비스 측에서 DELIVERY 로 기본값 잡음.
         * 클리닝·기타 차량은 운영자가 명시적으로 선택해야 등록된다.
         */
        BikeServiceType serviceType,
        @NotNull BikeOperationStatus operationStatus,
        String memo
) {
}
```

- [ ] **Step 2: BikeUpdateRequest.java 수정**

```java
package com.thundercrew.opsapi.bike.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.thundercrew.opsapi.bike.domain.BikeEngineType;
import com.thundercrew.opsapi.bike.domain.BikeServiceType;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@JsonIgnoreProperties(ignoreUnknown = true)
public record BikeUpdateRequest(
        @Size(max = 50) @Pattern(regexp = ".*\\S.*", message = "must not be blank when provided") String plateNumber,
        @Size(max = 100) @Pattern(regexp = ".*\\S.*", message = "must not be blank when provided") String vin,
        @Size(max = 100) String modelName,
        BikeEngineType engineType,
        /** null 이면 변경 안 함 (다른 필드와 동일한 partial-update 규약). */
        BikeServiceType serviceType,
        String memo
) {
}
```

- [ ] **Step 3: BikeReadResponse.java 수정**

```java
package com.thundercrew.opsapi.bike.dto;

import com.thundercrew.opsapi.bike.domain.Bike;
import com.thundercrew.opsapi.bike.domain.BikeEngineType;
import com.thundercrew.opsapi.bike.domain.BikeOperationStatus;
import com.thundercrew.opsapi.bike.domain.BikeServiceType;
import java.time.Instant;
import java.util.UUID;

public record BikeReadResponse(
        UUID id,
        Long idx,
        String plateNumber,
        String vin,
        String modelName,
        BikeEngineType engineType,
        BikeServiceType serviceType,
        BikeOperationStatus operationStatus,
        boolean ignitionBlocked,
        String memo,
        Instant createdAt,
        Instant updatedAt
) {
    public static BikeReadResponse from(Bike bike) {
        return new BikeReadResponse(
                bike.getId(),
                bike.getIdx(),
                bike.getPlateNumber(),
                bike.getVin(),
                bike.getModelName(),
                bike.getEngineType(),
                bike.getServiceType(),
                bike.getOperationStatus(),
                bike.isIgnitionBlocked(),
                bike.getMemo(),
                bike.getCreatedAt(),
                bike.getUpdatedAt()
        );
    }
}
```

- [ ] **Step 4: BikeCommandService.java 수정**

`create()` 메서드에서 serviceType 기본값 처리 추가:

```java
// engineType 기본값 처리 바로 아래에 추가
BikeServiceType serviceType = request.serviceType() != null
        ? request.serviceType()
        : BikeServiceType.DELIVERY;
Bike bike = Bike.create(
        request.plateNumber(),
        vin,
        request.modelName(),
        engineType,
        serviceType,
        request.operationStatus(),
        request.memo()
);
```

`update()` 메서드에서 serviceType 전달:

```java
bike.updateBasicProfile(
        request.plateNumber(),
        request.vin(),
        request.modelName(),
        request.engineType(),
        request.serviceType(),
        request.memo()
);
```

import 추가 (파일 상단):
```java
import com.thundercrew.opsapi.bike.domain.BikeServiceType;
```

- [ ] **Step 5: 컴파일 + 테스트 실행**

```bash
cd development/service-ops-api
./gradlew test
```

Expected: BUILD SUCCESSFUL, 모든 기존 테스트 PASS

- [ ] **Step 6: 커밋**

```bash
git add development/service-ops-api/src/main/java/com/thundercrew/opsapi/bike/dto/BikeCreateRequest.java
git add development/service-ops-api/src/main/java/com/thundercrew/opsapi/bike/dto/BikeUpdateRequest.java
git add development/service-ops-api/src/main/java/com/thundercrew/opsapi/bike/dto/BikeReadResponse.java
git add development/service-ops-api/src/main/java/com/thundercrew/opsapi/bike/service/BikeCommandService.java
git commit -m "feat(service-ops-api): serviceType DTO + 서비스 레이어 반영"
```

---

## Task 4: 백엔드 계약 테스트 추가

**Files:**
- Modify: `development/service-ops-api/src/test/java/com/thundercrew/opsapi/BikeCommandApiContractTests.java`

- [ ] **Step 1: seedBike 헬퍼에 service_type 컬럼 추가**

기존 `seedBike` 메서드를 찾아서 수정:

```java
private void seedBike(UUID id, String plateNumber, String vin, String operationStatus, String deletedAtSql) {
    String deletedAtExpression = deletedAtSql == null ? "null" : deletedAtSql;
    jdbcTemplate.update("""
            insert into bikes (id, plate_number, vin, model_name, engine_type, service_type, operation_status, memo, deleted_at)
            values (?, ?, ?, 'Thunder M1', 'ELECTRIC', 'DELIVERY', ?, 'fixture bike', %s)
            """.formatted(deletedAtExpression), id, plateNumber, vin, operationStatus);
}
```

- [ ] **Step 2: serviceType 포함 create 테스트 추가**

클래스 안에 새 테스트 메서드 추가:

```java
@Test
void createBikeWithServiceTypeStoresAndReturnsThatType() throws Exception {
    mockMvc.perform(post("/api/v1/bikes")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""
                            {
                              "plateNumber":"서울B-2001",
                              "operationStatus":"READY",
                              "serviceType":"CLEANING"
                            }
                            """))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.serviceType").value("CLEANING"));
}

@Test
void createBikeWithoutServiceTypeDefaultsToDelivery() throws Exception {
    mockMvc.perform(post("/api/v1/bikes")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""
                            {
                              "plateNumber":"서울B-2002",
                              "operationStatus":"READY"
                            }
                            """))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.serviceType").value("DELIVERY"));
}

@Test
void updateBikeServiceTypeChangesStoredValue() throws Exception {
    seedBike(BIKE_ID, "서울A-1001", "VIN-BIKE-001", "READY", null);

    mockMvc.perform(patch("/api/v1/bikes/" + BIKE_ID)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""
                            {"serviceType":"CLEANING"}
                            """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.serviceType").value("CLEANING"));
}
```

- [ ] **Step 3: 테스트 실행 — 새 테스트 포함 전체 통과 확인**

```bash
cd development/service-ops-api
./gradlew test
```

Expected: BUILD SUCCESSFUL, 새 테스트 3개 포함 전체 PASS

- [ ] **Step 4: 커밋**

```bash
git add development/service-ops-api/src/test/java/com/thundercrew/opsapi/BikeCommandApiContractTests.java
git commit -m "test(service-ops-api): serviceType create/update 계약 테스트 추가"
```

---

## Task 5: 프론트엔드 타입 + API 클라이언트 업데이트

**Files:**
- Modify: `development/front-admin-web/lib/services/service-ops-api.ts`

- [ ] **Step 1: ServiceOpsBikeServiceType 타입 추가**

`service-ops-api.ts` 파일에서 `ServiceOpsBikeEngineType` 타입을 찾아 바로 아래에 추가:

```ts
export type ServiceOpsBikeServiceType = "DELIVERY" | "CLEANING" | "OTHER";
```

- [ ] **Step 2: ServiceOpsBike에 serviceType 추가**

`ServiceOpsBike` 타입 정의에서 `engineType` 필드 바로 아래에:

```ts
serviceType?: ServiceOpsBikeServiceType;
```

- [ ] **Step 3: FrontendVehicle에 serviceType 추가**

`FrontendVehicle` 타입 정의에서 `engineType` 필드 바로 아래에:

```ts
serviceType?: ServiceOpsBikeServiceType;
```

- [ ] **Step 4: toFrontendVehicle()에서 serviceType 매핑**

`toFrontendVehicle()` 함수 내부에서 `engineType` 매핑 라인 바로 아래에:

```ts
serviceType: raw.serviceType,
```

- [ ] **Step 5: 타입스크립트 컴파일 확인**

```bash
cd development/front-admin-web
npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 6: 커밋**

```bash
git add development/front-admin-web/lib/services/service-ops-api.ts
git commit -m "feat(front): ServiceOpsBikeServiceType 타입 + FrontendVehicle 확장"
```

---

## Task 6: ServiceTypeFilterTabs 공용 컴포넌트

**Files:**
- Create: `development/front-admin-web/components/overview/ServiceTypeFilterTabs.tsx`
- Modify: `development/front-admin-web/app/globals.css`

- [ ] **Step 1: ServiceTypeFilterTabs.tsx 생성**

```tsx
// development/front-admin-web/components/overview/ServiceTypeFilterTabs.tsx
"use client";

import type { ServiceOpsBikeServiceType } from "@/lib/services/service-ops-api";

export type ServiceTypeFilter = ServiceOpsBikeServiceType | "ALL";

const TABS: { value: ServiceTypeFilter; label: string }[] = [
  { value: "ALL", label: "전체" },
  { value: "DELIVERY", label: "배송" },
  { value: "CLEANING", label: "클리닝" },
  { value: "OTHER", label: "기타" }
];

export function ServiceTypeFilterTabs({
  value,
  onChange
}: {
  value: ServiceTypeFilter;
  onChange: (value: ServiceTypeFilter) => void;
}) {
  return (
    <div className="service-type-tabs" role="tablist" aria-label="서비스 유형 필터">
      {TABS.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={value === tab.value}
          className={value === tab.value ? "service-type-tab is-active" : "service-type-tab"}
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: globals.css에 탭 스타일 추가**

`app/globals.css` 파일 끝에 추가:

```css
/* 서비스 유형 필터 탭 — VehiclesPanel 상단 + 지도 필터에서 공유. */
.service-type-tabs { display: flex; gap: 4px; margin-bottom: 8px; }
.service-type-tab {
  padding: 4px 14px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  border: 1px solid var(--rm-line-subtle);
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: background .12s ease, color .12s ease, border-color .12s ease;
}
.service-type-tab:hover { color: var(--color-text-primary); }
.service-type-tab.is-active {
  background: var(--baemin-mint);
  color: #fff;
  border-color: var(--baemin-mint);
}
```

- [ ] **Step 3: 타입스크립트 컴파일 확인**

```bash
cd development/front-admin-web
npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add development/front-admin-web/components/overview/ServiceTypeFilterTabs.tsx
git add development/front-admin-web/app/globals.css
git commit -m "feat(front): ServiceTypeFilterTabs 공용 컴포넌트 + 탭 CSS 추가"
```

---

## Task 7: VehicleDetailDialog 편집 폼 + 뷰 업데이트

**Files:**
- Modify: `development/front-admin-web/components/management/VehicleDetailDialog.tsx`
- Modify: `development/front-admin-web/app/actions.ts`

- [ ] **Step 1: serviceTypeLabel 헬퍼 함수 추가**

`VehicleDetailDialog.tsx` 파일에서 `engineTypeLabel` 함수 바로 아래에 추가:

```ts
function serviceTypeLabel(t?: ServiceOpsBikeServiceType): string {
  if (t === "CLEANING") return "클리닝";
  if (t === "OTHER") return "기타";
  return "배송";
}
```

import 추가 (파일 상단 service-ops-api import에 추가):
```ts
import type { FrontendVehicle, ServiceOpsBikeOperationStatus, ServiceOpsBikeServiceType } from "@/lib/services/service-ops-api";
```

- [ ] **Step 2: 뷰 모드에 서비스 유형 표시**

`detail-row-grid` 안의 `<DetailField label="구분" ...>` 바로 아래에 추가:

```tsx
<DetailField label="서비스" value={serviceTypeLabel(vehicle.serviceType)} />
```

- [ ] **Step 3: 편집 폼에 serviceType select 추가**

편집 폼에서 `engineType` select 바로 아래에 추가:

```tsx
<label>
  서비스 유형
  <select name="serviceType" defaultValue={vehicle.serviceType ?? "DELIVERY"}>
    <option value="DELIVERY">배송</option>
    <option value="CLEANING">클리닝</option>
    <option value="OTHER">기타</option>
  </select>
</label>
```

- [ ] **Step 4: actions.ts의 updateVehicleFromOverviewAction에 serviceType 추가**

`app/actions.ts`에서 `updateVehicleFromOverviewAction` 함수를 찾아 `engineType` 처리 라인 바로 아래에:

```ts
const serviceType = String(formData.get("serviceType") ?? "").trim() || undefined;
```

그리고 API 요청 body에 추가:
```ts
serviceType: serviceType as ServiceOpsBikeServiceType | undefined,
```

import에 `ServiceOpsBikeServiceType` 추가 (이미 service-ops-api에서 import하는 라인 수정).

- [ ] **Step 5: 타입스크립트 컴파일 확인**

```bash
cd development/front-admin-web
npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 6: 커밋**

```bash
git add development/front-admin-web/components/management/VehicleDetailDialog.tsx
git add development/front-admin-web/app/actions.ts
git commit -m "feat(front): VehicleDetailDialog 편집 폼 + 뷰에 serviceType 추가"
```

---

## Task 8: VehiclesPanel에 필터 탭 연결

**Files:**
- Modify: `development/front-admin-web/components/management/VehiclesPanel.tsx`

- [ ] **Step 1: ServiceTypeFilterTabs import + state 추가**

`VehiclesPanel.tsx` 파일 상단 import에 추가:

```ts
import { ServiceTypeFilterTabs, type ServiceTypeFilter } from "@/components/overview/ServiceTypeFilterTabs";
```

`VehiclesPanel` 함수 내부 state 선언에 추가 (기존 filter state 옆에):

```ts
const [serviceTypeFilter, setServiceTypeFilter] = useState<ServiceTypeFilter>("ALL");
```

- [ ] **Step 2: visibleVehicles 필터링에 serviceType 적용**

기존 `effectiveVehicles`(또는 `visibleVehicles`) 계산 위에 serviceType 필터 추가:

```ts
const serviceTypeFilteredVehicles = useMemo(
  () =>
    serviceTypeFilter === "ALL"
      ? vehicles
      : vehicles.filter((v) => (v.serviceType ?? "DELIVERY") === serviceTypeFilter),
  [vehicles, serviceTypeFilter]
);
```

그 다음 기존 필터 계산에서 `vehicles` 대신 `serviceTypeFilteredVehicles`를 입력으로 사용.

- [ ] **Step 3: ServiceTypeFilterTabs UI 삽입**

기존 필터바(RiderFilterControls나 VehicleFilterControls) 바로 위에:

```tsx
<ServiceTypeFilterTabs value={serviceTypeFilter} onChange={setServiceTypeFilter} />
```

- [ ] **Step 4: 타입스크립트 컴파일 확인**

```bash
cd development/front-admin-web
npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 5: 커밋**

```bash
git add development/front-admin-web/components/management/VehiclesPanel.tsx
git commit -m "feat(front): VehiclesPanel에 서비스 유형 필터 탭 추가"
```

---

## Task 9: 지도(OverviewMapBanner + FullscreenMapHost)에 필터 연결

**Files:**
- Modify: `development/front-admin-web/components/overview/OverviewMapBanner.tsx`
- Modify: `development/front-admin-web/components/overview/FullscreenMapHost.tsx`

- [ ] **Step 1: OverviewMapBanner에 serviceTypeFilter 추가**

`OverviewMapBanner.tsx` 파일 상단 import에 추가:

```ts
import { ServiceTypeFilterTabs, type ServiceTypeFilter } from "@/components/overview/ServiceTypeFilterTabs";
```

`useState` 선언부에 추가:

```ts
const [serviceTypeFilter, setServiceTypeFilter] = useState<ServiceTypeFilter>("ALL");
```

- [ ] **Step 2: effectiveBikePins에 serviceType 필터 적용**

기존 `effectiveBikePins` useMemo를 찾아서 serviceType 필터를 추가로 적용:

```ts
const effectiveBikePins = useMemo(() => {
  let pins = filteredBikeIds === null ? overlaidBikePins : overlaidBikePins.filter((pin) => filteredBikeIds.has(pin.bikeId));
  if (serviceTypeFilter !== "ALL") {
    const vehicleServiceType = (bikeId: string) =>
      vehicleById.get(bikeId)?.serviceType ?? "DELIVERY";
    pins = pins.filter((pin) => vehicleServiceType(pin.bikeId) === serviceTypeFilter);
  }
  return pins;
}, [overlaidBikePins, filteredBikeIds, serviceTypeFilter, vehicleById]);
```

- [ ] **Step 3: 지도 위 ServiceTypeFilterTabs UI 삽입**

`overview-map-toggle-row` div 안의 토글 label 바로 아래에:

```tsx
<ServiceTypeFilterTabs value={serviceTypeFilter} onChange={setServiceTypeFilter} />
```

- [ ] **Step 4: FullscreenMapHost에 동일하게 적용**

`FullscreenMapHost.tsx`에 Steps 1~3과 동일한 변경 적용 (import, state, effectiveBikePins 필터, UI 삽입).

- [ ] **Step 5: 타입스크립트 컴파일 확인**

```bash
cd development/front-admin-web
npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 6: 커밋**

```bash
git add development/front-admin-web/components/overview/OverviewMapBanner.tsx
git add development/front-admin-web/components/overview/FullscreenMapHost.tsx
git commit -m "feat(front): 지도 뷰에 서비스 유형 필터 탭 연결"
```

---

## Task 10: 최종 검증 + PR

**Files:** 없음 (검증 및 PR 생성)

- [ ] **Step 1: 백엔드 전체 테스트 최종 확인**

```bash
cd development/service-ops-api
./gradlew test
```

Expected: BUILD SUCCESSFUL

- [ ] **Step 2: 프론트엔드 타입 최종 확인**

```bash
cd development/front-admin-web
npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 3: 동작 수동 확인 체크리스트**

- 차량 탭 → 차량 행 클릭 → 편집 → "서비스 유형" select에서 "클리닝" 선택 → 저장 → 뷰에 "클리닝" 표시
- 차량 목록 상단 탭에서 [클리닝] 클릭 → 클리닝 차량만 표시
- 지도 열기 → [클리닝] 탭 → 클리닝 차량 마커만 표시
- [전체] 탭 → 전체 마커 복귀
- 새로 등록한 차량은 serviceType 기본값이 "배송"으로 저장됨

- [ ] **Step 4: PR 생성**

```bash
git push origin dev
gh pr create --base main \
  --title "feat: 차량 서비스 유형(배송/클리닝/기타) 분류 + 필터" \
  --body "$(cat <<'EOF'
## Summary
- 백엔드: BikeServiceType enum(DELIVERY/CLEANING/OTHER) + V25 마이그레이션 + DTO/서비스 반영
- 프론트: 편집 폼 serviceType select + 차량 목록 필터 탭 + 지도 마커 필터
- 기존 차량은 기본값 DELIVERY로 유지

## Test plan
- [ ] 차량 수정 → 서비스 유형 변경 → 저장 → 반영 확인
- [ ] VehiclesPanel 필터 탭 [배송/클리닝/기타/전체] 동작
- [ ] 지도 필터 탭 동작
- [ ] 백엔드 테스트 전체 통과
🤖 Generated with Claude Code
EOF
)"
```
