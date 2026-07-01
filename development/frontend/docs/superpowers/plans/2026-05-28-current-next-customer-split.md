# 현재 고객 / 다음 고객 분리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CLEANING 차량 상세 패널의 "다음 고객" 단일 섹션을 "현재 고객" (읽기 전용) + "다음 고객" (편집 폼) 두 섹션으로 분리하고, WORKING→MOVING 시 다음 고객이 현재 고객으로 자동 승격되도록 DB + 백엔드 + 프론트엔드를 함께 구현한다.

**Architecture:** 기존 `bike_next_customer` 테이블에 `current_customer_*` 컬럼 5개를 추가하고 기존 next 컬럼들을 nullable 로 변경한다. 새 `POST .../promote` 백엔드 엔드포인트가 next→current 복사 + next 초기화를 원자적으로 수행한다. 프론트엔드 `FleetSimulationContext` ignitionOnAt 이펙트가 시동 ON 감지 시 promote 를 호출하고 pinsRef next 필드를 초기화한다. `VehicleDetailDialog` 는 다이얼로그 마운트 시 서버에서 current+next 를 한 번에 읽어 두 섹션에 반영하고, ignitionOnAt 변화로 로컬 상태를 동기화한다.

**Tech Stack:** Java 21 / Spring Boot 3 / PostgreSQL / Flyway (백엔드), Next.js 14 App Router / TypeScript / React (프론트엔드)

---

## File Map

**신규 파일:**
- `service-ops-api/src/main/resources/db/migration/V28__promote_current_customer.sql`

**수정 파일 — 백엔드:**
- `service-ops-api/src/main/java/com/thundercrew/opsapi/bike/domain/BikeNextCustomer.java`
- `service-ops-api/src/main/java/com/thundercrew/opsapi/bike/dto/BikeNextCustomerResponse.java`
- `service-ops-api/src/main/java/com/thundercrew/opsapi/bike/service/BikeNextCustomerService.java`
- `service-ops-api/src/main/java/com/thundercrew/opsapi/bike/controller/BikeNextCustomerController.java`
- `service-ops-api/src/main/java/com/thundercrew/opsapi/dashboard/repository/DashboardMapQueryRepository.java`
- `service-ops-api/src/main/java/com/thundercrew/opsapi/dashboard/dto/DashboardMapStateResponse.java`
- `service-ops-api/src/main/java/com/thundercrew/opsapi/dashboard/service/DashboardMapStateService.java`
- `service-ops-api/src/test/java/com/thundercrew/opsapi/BikeNextCustomerApiContractTests.java`

**수정 파일 — 프론트엔드:**
- `front-admin-web/lib/services/service-ops-api.ts`
- `front-admin-web/app/actions.ts`
- `front-admin-web/components/overview/FleetSimulationContext.tsx`
- `front-admin-web/components/management/VehicleDetailDialog.tsx`

---

## Task 1: V28 DB 마이그레이션

**Files:**
- Create: `service-ops-api/src/main/resources/db/migration/V28__promote_current_customer.sql`

- [ ] **Step 1: 마이그레이션 파일 작성**

```sql
-- bike_next_customer 테이블에 현재 고객 컬럼 추가.
-- 기존 next 컬럼들은 promote() 후 null 이 될 수 있으므로 NOT NULL 제약을 제거.
ALTER TABLE bike_next_customer
  ADD COLUMN current_customer_name    VARCHAR(100)     NULL,
  ADD COLUMN current_customer_phone   VARCHAR(20)      NULL,
  ADD COLUMN current_customer_address VARCHAR(500)     NULL,
  ADD COLUMN current_customer_lat     DOUBLE PRECISION NULL,
  ADD COLUMN current_customer_lng     DOUBLE PRECISION NULL;

ALTER TABLE bike_next_customer
  ALTER COLUMN customer_name  DROP NOT NULL,
  ALTER COLUMN customer_phone DROP NOT NULL,
  ALTER COLUMN address        DROP NOT NULL,
  ALTER COLUMN latitude       DROP NOT NULL,
  ALTER COLUMN longitude      DROP NOT NULL;
```

- [ ] **Step 2: FlywayBaselineTests 실행해 마이그레이션 검증**

백엔드 디렉토리에서:
```bash
./gradlew test --tests "com.thundercrew.opsapi.FlywayBaselineTests"
```
Expected: PASS (Flyway 가 V28 마이그레이션을 성공적으로 적용)

- [ ] **Step 3: Commit**

```bash
git add service-ops-api/src/main/resources/db/migration/V28__promote_current_customer.sql
git commit -m "feat: V28 add current_customer_* columns to bike_next_customer"
```

---

## Task 2: 엔티티 + DTO + 서비스 — promote 로직

**Files:**
- Modify: `service-ops-api/src/main/java/com/thundercrew/opsapi/bike/domain/BikeNextCustomer.java`
- Modify: `service-ops-api/src/main/java/com/thundercrew/opsapi/bike/dto/BikeNextCustomerResponse.java`
- Modify: `service-ops-api/src/main/java/com/thundercrew/opsapi/bike/service/BikeNextCustomerService.java`

- [ ] **Step 1: `BikeNextCustomer.java` 전체 교체**

`BikeNextCustomer.java` 를 아래로 교체한다 (기존 필드는 유지하고 nullable 처리 + promote() 추가):

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

    /** 다음 고객 이름. promote() 후 null. */
    @Column(name = "customer_name", length = 100)
    private String customerName;

    @Column(name = "customer_phone", length = 20)
    private String customerPhone;

    @Column(length = 500)
    private String address;

    /** Double (nullable) — promote() 후 null 허용. */
    @Column
    private Double latitude;

    @Column
    private Double longitude;

    /** 현재 고객 이름 (promote 시 next → current 복사). */
    @Column(name = "current_customer_name", length = 100)
    private String currentCustomerName;

    @Column(name = "current_customer_phone", length = 20)
    private String currentCustomerPhone;

    @Column(name = "current_customer_address", length = 500)
    private String currentCustomerAddress;

    @Column(name = "current_customer_lat")
    private Double currentCustomerLat;

    @Column(name = "current_customer_lng")
    private Double currentCustomerLng;

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

    /**
     * 다음 고객 → 현재 고객으로 승격.
     * next 필드를 null 로 초기화해 이후 PUT 이 들어올 때까지 다음 고객 없음 상태를 유지.
     */
    public void promote() {
        this.currentCustomerName    = this.customerName;
        this.currentCustomerPhone   = this.customerPhone;
        this.currentCustomerAddress = this.address;
        this.currentCustomerLat     = this.latitude;
        this.currentCustomerLng     = this.longitude;
        this.customerName    = null;
        this.customerPhone   = null;
        this.address         = null;
        this.latitude        = null;
        this.longitude       = null;
        this.updatedAt       = Instant.now();
    }

    public UUID   getBikeId()                { return bikeId; }
    public String getCustomerName()          { return customerName; }
    public String getCustomerPhone()         { return customerPhone; }
    public String getAddress()               { return address; }
    public Double getLatitude()              { return latitude; }
    public Double getLongitude()             { return longitude; }
    public String getCurrentCustomerName()   { return currentCustomerName; }
    public String getCurrentCustomerPhone()  { return currentCustomerPhone; }
    public String getCurrentCustomerAddress(){ return currentCustomerAddress; }
    public Double getCurrentCustomerLat()    { return currentCustomerLat; }
    public Double getCurrentCustomerLng()    { return currentCustomerLng; }
    public Instant getUpdatedAt()            { return updatedAt; }
}
```

- [ ] **Step 2: `BikeNextCustomerResponse.java` 전체 교체**

```java
package com.thundercrew.opsapi.bike.dto;

import com.thundercrew.opsapi.bike.domain.BikeNextCustomer;
import java.util.UUID;

public record BikeNextCustomerResponse(
        UUID   bikeId,
        // 다음 고객 (null = 설정 안 됨 또는 이미 promote 됨)
        String customerName,
        String customerPhone,
        String address,
        Double latitude,
        Double longitude,
        // 현재 고객 (null = 아직 한 번도 이동한 적 없음)
        String currentCustomerName,
        String currentCustomerPhone,
        String currentCustomerAddress,
        Double currentCustomerLat,
        Double currentCustomerLng
) {
    public static BikeNextCustomerResponse from(BikeNextCustomer entity) {
        return new BikeNextCustomerResponse(
                entity.getBikeId(),
                entity.getCustomerName(),
                entity.getCustomerPhone(),
                entity.getAddress(),
                entity.getLatitude(),
                entity.getLongitude(),
                entity.getCurrentCustomerName(),
                entity.getCurrentCustomerPhone(),
                entity.getCurrentCustomerAddress(),
                entity.getCurrentCustomerLat(),
                entity.getCurrentCustomerLng()
        );
    }
}
```

- [ ] **Step 3: `BikeNextCustomerService.java` — `promote()` 메서드 추가**

기존 파일에 `promote` 메서드를 추가한다. `upsert` 메서드 아래에 삽입:

```java
@Transactional
public void promote(UUID bikeId) {
    requireCleaningBike(bikeId);
    nextCustomerRepository.findById(bikeId).ifPresent(entity -> {
        entity.promote();
        nextCustomerRepository.save(entity);
    });
}
```

- [ ] **Step 4: 백엔드 빌드 확인**

```bash
./gradlew compileJava
```
Expected: BUILD SUCCESSFUL

- [ ] **Step 5: Commit**

```bash
git add service-ops-api/src/main/java/com/thundercrew/opsapi/bike/domain/BikeNextCustomer.java \
        service-ops-api/src/main/java/com/thundercrew/opsapi/bike/dto/BikeNextCustomerResponse.java \
        service-ops-api/src/main/java/com/thundercrew/opsapi/bike/service/BikeNextCustomerService.java
git commit -m "feat: add promote() to BikeNextCustomer — next→current customer promotion"
```

---

## Task 3: 컨트롤러 — POST promote 엔드포인트

**Files:**
- Modify: `service-ops-api/src/main/java/com/thundercrew/opsapi/bike/controller/BikeNextCustomerController.java`

- [ ] **Step 1: promote 엔드포인트 추가**

기존 `@DeleteMapping` 아래에 다음을 추가한다:

```java
import org.springframework.web.bind.annotation.PostMapping;
```

기존 import 블록에 `PostMapping` 을 추가하고, 클래스 본문에 추가:

```java
@PostMapping("/promote")
ResponseEntity<Void> promote(@PathVariable UUID bikeId) {
    bikeNextCustomerService.promote(bikeId);
    return ResponseEntity.noContent().build();
}
```

- [ ] **Step 2: 빌드 확인**

```bash
./gradlew compileJava
```
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Commit**

```bash
git add service-ops-api/src/main/java/com/thundercrew/opsapi/bike/controller/BikeNextCustomerController.java
git commit -m "feat: POST /bikes/{bikeId}/next-customer/promote endpoint"
```

---

## Task 4: 대시보드 API — BikePin 에 현재 고객 필드 추가

**Files:**
- Modify: `service-ops-api/src/main/java/com/thundercrew/opsapi/dashboard/repository/DashboardMapQueryRepository.java`
- Modify: `service-ops-api/src/main/java/com/thundercrew/opsapi/dashboard/dto/DashboardMapStateResponse.java`
- Modify: `service-ops-api/src/main/java/com/thundercrew/opsapi/dashboard/service/DashboardMapStateService.java`

- [ ] **Step 1: `DashboardMapQueryRepository.java` — SQL + BikePinRow 업데이트**

`findCurrentBikeStates` SQL SELECT 에 두 줄 추가 (기존 `bnc.longitude as next_customer_lng` 바로 다음):

```sql
                    bnc.current_customer_name  as current_customer_name,
                    bnc.current_customer_phone as current_customer_phone
```

`mapBikePinRow` 메서드의 `BikePinRow` 생성자 호출 마지막에 두 필드 추가:

```java
                rs.getString("current_customer_name"),
                rs.getString("current_customer_phone")
```

`BikePinRow` record 에 두 필드 추가 (맨 마지막):

```java
        String currentCustomerName,
        String currentCustomerPhone
```

- [ ] **Step 2: `DashboardMapStateResponse.java` — BikePin record 에 필드 추가**

`BikePin` record 의 마지막에 두 필드 추가 (`nextCustomerLng` 다음):

```java
            String currentCustomerName,
            String currentCustomerPhone
```

- [ ] **Step 3: `DashboardMapStateService.java` — toBikePin() 업데이트**

`new BikePin(...)` 생성자 호출 마지막에 두 인수 추가 (`row.nextCustomerLng()` 다음):

```java
                row.currentCustomerName(),
                row.currentCustomerPhone()
```

- [ ] **Step 4: 빌드 확인**

```bash
./gradlew compileJava
```
Expected: BUILD SUCCESSFUL

- [ ] **Step 5: Commit**

```bash
git add service-ops-api/src/main/java/com/thundercrew/opsapi/dashboard/
git commit -m "feat: add currentCustomerName/Phone to dashboard BikePin"
```

---

## Task 5: 계약 테스트 — promote + 대시보드

**Files:**
- Modify: `service-ops-api/src/test/java/com/thundercrew/opsapi/BikeNextCustomerApiContractTests.java`

- [ ] **Step 1: promote 테스트 작성**

기존 `BikeNextCustomerApiContractTests.java` 에서 `put_returnsValidationErrorForBlankName` 테스트 다음에 두 테스트를 추가한다:

```java
@Test
void promote_movesNextToCurrentAndClearsNext() throws Exception {
    // Arrange: next customer 저장
    mockMvc.perform(put("/api/v1/bikes/{id}/next-customer", CLEANING_BIKE)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""
                            {"customerName":"이순신","customerPhone":"010-1111-2222",
                             "address":"서울 종로구 세종대로 175",
                             "latitude":37.5762,"longitude":126.9769}
                            """))
            .andExpect(status().isOk());

    // Act: promote
    mockMvc.perform(post("/api/v1/bikes/{id}/next-customer/promote", CLEANING_BIKE)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
            .andExpect(status().isNoContent());

    // Assert: GET 응답에서 current=이순신, next=null
    mockMvc.perform(get("/api/v1/bikes/{id}/next-customer", CLEANING_BIKE)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.customerName").doesNotExist())
            .andExpect(jsonPath("$.currentCustomerName").value("이순신"))
            .andExpect(jsonPath("$.currentCustomerPhone").value("010-1111-2222"));
}

@Test
void promote_withNoNextCustomer_isIdempotent() throws Exception {
    // next-customer 가 없는 상태에서 promote → 204 (no-op)
    mockMvc.perform(post("/api/v1/bikes/{id}/next-customer/promote", CLEANING_BIKE)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
            .andExpect(status().isNoContent());
}
```

(import `static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post` 가 이미 있는지 확인 — 기존 코드에 `post` 임포트가 있으므로 OK)

- [ ] **Step 2: 테스트 실행**

```bash
./gradlew test --tests "com.thundercrew.opsapi.BikeNextCustomerApiContractTests"
```
Expected: 기존 5개 + 신규 2개 = 7개 테스트 모두 PASS

- [ ] **Step 3: Commit**

```bash
git add service-ops-api/src/test/java/com/thundercrew/opsapi/BikeNextCustomerApiContractTests.java
git commit -m "test: promote endpoint contract tests for BikeNextCustomer"
```

---

## Task 6: 프론트엔드 타입 + API 클라이언트 + Server Actions

**Files:**
- Modify: `front-admin-web/lib/services/service-ops-api.ts`
- Modify: `front-admin-web/app/actions.ts`

- [ ] **Step 1: `service-ops-api.ts` — `ServiceOpsDashboardBikePin` 타입에 currentCustomer 필드 추가**

기존:
```ts
export type ServiceOpsDashboardBikePin = {
  ...
  nextCustomerName?: string | null;
  nextCustomerPhone?: string | null;
  nextCustomerLat?: number | string | null;
  nextCustomerLng?: number | string | null;
};
```

`nextCustomerLng?: number | string | null;` 다음에 추가:
```ts
  currentCustomerName?: string | null;
  currentCustomerPhone?: string | null;
```

- [ ] **Step 2: `ServiceOpsBikeNextCustomer` 타입 업데이트**

기존:
```ts
export type ServiceOpsBikeNextCustomer = {
  bikeId: string;
  customerName: string;
  customerPhone: string;
  address: string;
  latitude: number;
  longitude: number;
};
```

를 아래로 교체:
```ts
export type ServiceOpsBikeNextCustomer = {
  bikeId: string;
  /** 다음 고객. promote() 후 null. */
  customerName: string | null;
  customerPhone: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  /** 현재 고객. 아직 한 번도 이동 안 했으면 null. */
  currentCustomerName: string | null;
  currentCustomerPhone: string | null;
  currentCustomerAddress: string | null;
  currentCustomerLat: number | null;
  currentCustomerLng: number | null;
};
```

- [ ] **Step 3: `ServiceOpsApiClient` 인터페이스에 `promoteNextToCurrentBikeCustomer` 추가**

`clearBikeNextCustomer` 라인 다음에 추가:
```ts
  promoteNextToCurrentBikeCustomer: (bikeId: string) => Promise<void>;
```

- [ ] **Step 4: `createServiceOpsApiClient` 구현체에 메서드 추가**

`clearBikeNextCustomer` 구현 다음에 추가:
```ts
    promoteNextToCurrentBikeCustomer: async (bikeId) => {
      await request<void>(
        `/bikes/${encodeURIComponent(bikeId)}/next-customer/promote`,
        { method: "POST" }
      );
    },
```

- [ ] **Step 5: `app/actions.ts` — `promoteNextToCurrentAction` 추가**

기존 `clearNextCustomerAction` 함수 다음에 추가:

```ts
/**
 * CLEANING 차량의 다음 고객 → 현재 고객으로 승격.
 * 시동 ON(WORKING→MOVING) 시점에 FleetSimulationContext 가 호출.
 */
export async function promoteNextToCurrentAction(bikeId: string): Promise<{ ok: boolean }> {
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: false });
  if (!client) return { ok: false };
  try {
    await client.promoteNextToCurrentBikeCustomer(bikeId);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
```

- [ ] **Step 6: TypeScript 빌드 확인**

```bash
cd front-admin-web && npx tsc --noEmit
```
Expected: 0 오류

- [ ] **Step 7: Commit**

```bash
git add front-admin-web/lib/services/service-ops-api.ts front-admin-web/app/actions.ts
git commit -m "feat: promoteNextToCurrent API client + server action"
```

---

## Task 7: FleetSimulationContext — ignitionOnAt + deliveryCount 이펙트 수정

**Files:**
- Modify: `front-admin-web/components/overview/FleetSimulationContext.tsx`

현재 코드 (관련 섹션 요약):
- **ignitionOnAt 이펙트** (lines 173–196): CLEANING 차량 시동 ON 감지 → 알림 발송. pinsRef nextCustomer 는 건드리지 않음.
- **deliveryCount 이펙트** (lines 198–221): 도착 감지 → `clearNextCustomerAction(bikeId)` 호출 + pinsRef nextCustomer 초기화.

변경 사항:
- **ignitionOnAt 이펙트**: CLEANING 차량 시동 ON 시 `promoteNextToCurrentAction(bikeId)` 호출(fire-and-forget) + pinsRef nextCustomer 필드 초기화.
- **deliveryCount 이펙트**: `clearNextCustomerAction` 호출 제거 + pinsRef nextCustomer 초기화 제거 (빈 이펙트 body — deliveryCount ref 정리 로직은 유지).

- [ ] **Step 1: imports 에 `promoteNextToCurrentAction` 추가, `clearNextCustomerAction` 제거**

기존:
```ts
import { clearNextCustomerAction } from "@/app/actions";
```

를 아래로 교체:
```ts
import { promoteNextToCurrentAction } from "@/app/actions";
```

- [ ] **Step 2: ignitionOnAt 이펙트 교체**

기존 이펙트 (lines 173–196):
```ts
  // Detect WORKING→MOVING transitions → send ignition notification.
  // pinsRef 정리/DB 삭제는 하지 않음 — 이동 중에도 고객 정보를 유지해야 하므로.
  // 도착(MOVING→WORKING) 시 정리는 아래 deliveryCount effect 에서 처리.
  useEffect(() => {
    for (const [bikeId, state] of simulated) {
      if (state.ignitionOnAt == null) continue;
      const last = lastNotifiedIgnitionOnAtRef.current.get(bikeId);
      if (last === state.ignitionOnAt) continue;
      // 클리닝 차량에만 알림 발송
      if (state.serviceType !== "CLEANING") continue;
      lastNotifiedIgnitionOnAtRef.current.set(bikeId, state.ignitionOnAt);
      const pin = pinsRef.current.find((p) => p.bikeId === bikeId);
      const plateNumber = pin?.plateNumber ?? bikeId.slice(0, 8);
      addNotification({
        plateNumber,
        startedAt: state.ignitionOnAt,
        customerName: pin?.nextCustomerName ?? undefined,
        customerPhone: pin?.nextCustomerPhone ?? undefined
      });
    }
    // Clean up ref entries for bikes that left simulation
    for (const bikeId of lastNotifiedIgnitionOnAtRef.current.keys()) {
      if (!simulated.has(bikeId)) {
        lastNotifiedIgnitionOnAtRef.current.delete(bikeId);
      }
    }
  }, [simulated, addNotification]);
```

를 아래로 교체:
```ts
  // Detect WORKING→MOVING transitions (ignitionOnAt null → non-null).
  // 클리닝 차량에 한해:
  //   1. 알림 발송 (기존 로직 유지)
  //   2. promote 호출 (fire-and-forget): DB에서 next→current 복사 후 next 초기화
  //   3. pinsRef nextCustomer 필드 초기화 — tick 루프가 이전 목적지로 재트리거하지 않도록
  useEffect(() => {
    for (const [bikeId, state] of simulated) {
      if (state.ignitionOnAt == null) continue;
      const last = lastNotifiedIgnitionOnAtRef.current.get(bikeId);
      if (last === state.ignitionOnAt) continue;
      if (state.serviceType !== "CLEANING") continue;
      lastNotifiedIgnitionOnAtRef.current.set(bikeId, state.ignitionOnAt);
      const pin = pinsRef.current.find((p) => p.bikeId === bikeId);
      const plateNumber = pin?.plateNumber ?? bikeId.slice(0, 8);
      // 1. 알림
      addNotification({
        plateNumber,
        startedAt: state.ignitionOnAt,
        customerName: pin?.nextCustomerName ?? undefined,
        customerPhone: pin?.nextCustomerPhone ?? undefined
      });
      // 2. DB promote (fire-and-forget)
      promoteNextToCurrentAction(bikeId).catch(() => undefined);
      // 3. pinsRef nextCustomer 초기화 — 다음 입력 전까지 새 이동 트리거 방지
      pinsRef.current = pinsRef.current.map((p) =>
        p.bikeId === bikeId
          ? { ...p, nextCustomerLat: null, nextCustomerLng: null,
                nextCustomerName: null, nextCustomerPhone: null }
          : p
      );
    }
    // Clean up ref entries for bikes that left simulation
    for (const bikeId of lastNotifiedIgnitionOnAtRef.current.keys()) {
      if (!simulated.has(bikeId)) {
        lastNotifiedIgnitionOnAtRef.current.delete(bikeId);
      }
    }
  }, [simulated, addNotification]);
```

- [ ] **Step 3: deliveryCount 이펙트 교체**

기존 이펙트 (lines 198–221):
```ts
  // Detect MOVING→WORKING transitions (deliveryCount 증가) → DB 삭제 + pinsRef 정리.
  // 도착 후 대기 중 진입 시점에 고객 정보를 지우므로, 이동 중에는 정보가 유지됨.
  useEffect(() => {
    for (const [bikeId, state] of simulated) {
      if (state.serviceType !== "CLEANING") continue;
      const last = lastDeliveryCountRef.current.get(bikeId) ?? 0;
      if (state.deliveryCount <= last) continue;
      // deliveryCount 증가 = 도착 완료 (MOVING→WORKING)
      lastDeliveryCountRef.current.set(bikeId, state.deliveryCount);
      // 다음 고객 정보를 DB에서 제거 (fire-and-forget)
      clearNextCustomerAction(bikeId).catch(() => undefined);
      // pinsRef 초기화 — 다음 MOVING 페이즈가 새 주소 입력 전까지 대기하도록
      pinsRef.current = pinsRef.current.map((p) =>
        p.bikeId === bikeId
          ? { ...p, nextCustomerLat: null, nextCustomerLng: null,
                nextCustomerName: null, nextCustomerPhone: null }
          : p
      );
    }
    // Clean up ref entries for bikes that left simulation
    for (const bikeId of lastDeliveryCountRef.current.keys()) {
      if (!simulated.has(bikeId)) lastDeliveryCountRef.current.delete(bikeId);
    }
  }, [simulated]);
```

를 아래로 교체:
```ts
  // Detect MOVING→WORKING transitions (deliveryCount 증가) → ref 정리만.
  // 고객 정보는 도착 시 초기화하지 않음 — 현재 고객은 다음 출발 전까지 유지.
  // pinsRef nextCustomer 정리는 이제 ignitionOnAt 이펙트(출발 시)에서 수행.
  useEffect(() => {
    for (const [bikeId, state] of simulated) {
      if (state.serviceType !== "CLEANING") continue;
      const last = lastDeliveryCountRef.current.get(bikeId) ?? 0;
      if (state.deliveryCount <= last) continue;
      lastDeliveryCountRef.current.set(bikeId, state.deliveryCount);
    }
    for (const bikeId of lastDeliveryCountRef.current.keys()) {
      if (!simulated.has(bikeId)) lastDeliveryCountRef.current.delete(bikeId);
    }
  }, [simulated]);
```

- [ ] **Step 4: TypeScript 빌드 확인**

```bash
cd front-admin-web && npx tsc --noEmit
```
Expected: 0 오류

- [ ] **Step 5: Commit**

```bash
git add front-admin-web/components/overview/FleetSimulationContext.tsx
git commit -m "feat: FleetSimulationContext — promote on departure, remove clear on arrival"
```

---

## Task 8: VehicleDetailDialog — 현재 고객 / 다음 고객 두 섹션 UI

**Files:**
- Modify: `front-admin-web/components/management/VehicleDetailDialog.tsx`

현재 `NextCustomerSection` 함수 (lines 886–1017) 를 아래 구현으로 완전 교체한다.

변경 내용 요약:
- 현재 고객 state 추가 (`currentCustomerName`, `currentCustomerPhone`, `currentCustomerAddress`)
- `getNextCustomerAction` 응답에서 current + next 모두 초기 로드
- `ignitionOnAt` 이펙트: null→non-null(출발) 시 form 값을 current 로 복사 + form 초기화; non-null→null(도착) 시 아무것도 안 함
- UI: 현재 고객(읽기 전용) + 다음 고객(폼) 두 섹션

- [ ] **Step 1: `NextCustomerSection` 함수 교체**

`VehicleDetailDialog.tsx` 의 기존 `NextCustomerSection` 함수 (line 886 ~ 1017, `// ============================================================================` 주석까지) 를 아래로 교체한다:

```tsx
// ============================================================================
// 현재 고객 / 다음 고객 섹션 (CLEANING 전용)
// ============================================================================

function NextCustomerSection({ bikeId }: { bikeId: string }) {
  // 현재 고객 (read-only — promote 시 자동 갱신)
  const [currentCustomerName, setCurrentCustomerName] = useState("");
  const [currentCustomerPhone, setCurrentCustomerPhone] = useState("");
  const [currentCustomerAddress, setCurrentCustomerAddress] = useState("");

  // 다음 고객 (editable form)
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [address, setAddress] = useState("");
  const [savedCoords, setSavedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // 초기 데이터 로드 — 서버에서 현재 고객 + 다음 고객 모두 조회
  useEffect(() => {
    let cancelled = false;
    getNextCustomerAction(bikeId).then((data) => {
      if (cancelled || !data) return;
      // 현재 고객
      setCurrentCustomerName(data.currentCustomerName ?? "");
      setCurrentCustomerPhone(data.currentCustomerPhone ?? "");
      setCurrentCustomerAddress(data.currentCustomerAddress ?? "");
      // 다음 고객
      setCustomerName(data.customerName ?? "");
      setCustomerPhone(data.customerPhone ?? "");
      setAddress(data.address ?? "");
      if (data.latitude != null && data.longitude != null) {
        setSavedCoords({ lat: data.latitude, lng: data.longitude });
      } else {
        setSavedCoords(null);
      }
      setError(null);
    });
    return () => { cancelled = true; };
  }, [bikeId]);

  // ignitionOnAt 변화 감지:
  //   null → non-null (WORKING→MOVING, 출발): 다음 고객 form 값 → 현재 고객으로 승격; 폼 초기화
  //   non-null → null (MOVING→WORKING, 도착): 현재 고객 유지 (아무것도 안 함)
  const { simulated, updatePinNextCustomer } = useFleetSimulation();
  const ignitionOnAt = simulated.get(bikeId)?.ignitionOnAt ?? null;
  const prevIgnitionOnAtRef = useRef(ignitionOnAt);
  // form 값을 ref 에 보관 — ignitionOnAt 이펙트에서 stale closure 없이 읽기 위해
  const customerNameRef = useRef(customerName);
  const customerPhoneRef = useRef(customerPhone);
  const addressRef = useRef(address);
  useEffect(() => { customerNameRef.current = customerName; }, [customerName]);
  useEffect(() => { customerPhoneRef.current = customerPhone; }, [customerPhone]);
  useEffect(() => { addressRef.current = address; }, [address]);

  useEffect(() => {
    if (prevIgnitionOnAtRef.current === ignitionOnAt) return;
    const prev = prevIgnitionOnAtRef.current;
    prevIgnitionOnAtRef.current = ignitionOnAt;

    if (prev === null && ignitionOnAt !== null) {
      // 출발: 다음 고객 → 현재 고객으로 승격 (로컬 상태)
      setCurrentCustomerName(customerNameRef.current);
      setCurrentCustomerPhone(customerPhoneRef.current);
      setCurrentCustomerAddress(addressRef.current);
      // 다음 고객 폼 초기화
      setCustomerName("");
      setCustomerPhone("");
      setAddress("");
      setSavedCoords(null);
      setError(null);
    }
    // 도착(non-null → null): 현재 고객은 그대로 유지 — 아무것도 안 함
  }, [ignitionOnAt]);

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
      updatePinNextCustomer(bikeId, result.lat, result.lng, customerName, customerPhone);
    } else {
      setError(result.error);
    }
  }

  return (
    <section className="delivery-section">
      {/* ── 현재 고객 (read-only) ── */}
      <h4>📍 현재 고객 <span className="muted" style={{ fontSize: "0.8em" }}>(이동 중)</span></h4>
      {currentCustomerName ? (
        <dl className="delivery-meta">
          <div className="delivery-meta-row">
            <dt>고객 이름</dt>
            <dd>{currentCustomerName}</dd>
          </div>
          <div className="delivery-meta-row">
            <dt>전화번호</dt>
            <dd>{currentCustomerPhone}</dd>
          </div>
          {currentCustomerAddress && (
            <div className="delivery-meta-row">
              <dt>주소</dt>
              <dd>{currentCustomerAddress}</dd>
            </div>
          )}
        </dl>
      ) : (
        <p className="muted" style={{ fontSize: "0.85em", margin: "4px 0 12px" }}>아직 이동 이력 없음</p>
      )}

      {/* ── 다음 고객 (editable) ── */}
      <h4 style={{ marginTop: "14px" }}>🧹 다음 고객 <span className="muted" style={{ fontSize: "0.8em" }}>(CLEANING 전용)</span></h4>
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
              <div className="station-address-field">
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="주소 검색 버튼을 눌러 주소를 선택하세요"
                  className="next-customer-input"
                  readOnly
                />
                <AddressSearchButton onSelect={setAddress} />
              </div>
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

- [ ] **Step 2: TypeScript 빌드 확인**

```bash
cd front-admin-web && npx tsc --noEmit
```
Expected: 0 오류

- [ ] **Step 3: Next.js 빌드 확인**

```bash
cd front-admin-web && npm run build
```
Expected: BUILD SUCCESSFUL (0 errors)

- [ ] **Step 4: Commit**

```bash
git add front-admin-web/components/management/VehicleDetailDialog.tsx
git commit -m "feat: VehicleDetailDialog — split into 현재 고객 / 다음 고객 sections"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ WORKING→MOVING 시 다음 → 현재 승격: Task 2 (entity.promote), Task 3 (POST endpoint), Task 7 (FleetSimulationContext), Task 8 (VehicleDetailDialog ignitionOnAt)
- ✅ 이동 중 다음 고객 입력 가능: Task 8 (form always editable)
- ✅ MOVING→WORKING 도착 시 현재 고객 유지: Task 7 (deliveryCount 이펙트에서 clear 제거), Task 8 (ignitionOnAt non-null→null 분기 no-op)
- ✅ DB 유지: Task 1 (V28 컬럼 추가), Task 2 (promote 메서드), Task 4 (대시보드 SQL)
- ✅ 알림 기존 동작 유지: Task 7 (ignitionOnAt 이펙트에 addNotification 로직 그대로 유지)

**No placeholders:** 모든 task 에 완전한 코드 제공 확인.

**Type consistency:** 
- `promoteNextToCurrentAction` — Task 6에서 정의, Task 7에서 사용 ✅
- `ServiceOpsBikeNextCustomer.customerName: string | null` — Task 6에서 변경, Task 8에서 `data.customerName ?? ""` 로 처리 ✅
- `BikeNextCustomerResponse.latitude: Double` — Task 2에서 변경 ✅
