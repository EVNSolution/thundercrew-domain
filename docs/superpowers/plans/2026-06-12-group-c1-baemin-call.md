# Group C1 — 배민 배송 (단건 콜) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 배민 단건 콜(고객 배달지)을 웹 폼으로 입력하고 시스템 자동 배차(가장 적게 배정된 DELIVERY 차량) 또는 라이더 수락(OFFERED→accept)으로 배정한다.

**Architecture:** 기존 `DispatchOrder`를 확장 — `DispatchOrderStatus.OFFERED` 추가 + `bike_id` nullable. OFFERED 콜은 차량 미배정(차량별 ASSIGNED 쿼리에서 자연 제외), 수락/자동배차로 ASSIGNED 되면 기존 배차 큐/지도/완료 재사용. 신규 `DeliveryCallService`가 자동선택·offer·accept를 오케스트레이션한다.

**Tech Stack:** Spring Boot (Java 21), Flyway, JPA `Repository<T,UUID>`, JUnit/Testcontainers, Next.js App Router, TypeScript.

**작업 경로:** 백엔드 `development/service-ops-api`, 프론트 `development/front-admin-web`. Bash 툴 + 절대경로 `cd /c/Users/user/repositories/clever/thundercrew-domain/...` (cwd 매 호출 리셋). 브랜치 `cc-c1-baemin-call` 이미 체크아웃 — 새 브랜치 만들지 말 것.

**테스트:** ArchUnit Docker 불필요. 계약/Testcontainers는 **Docker 필요(이 머신 없음)** → 컴파일까지만, 실행은 CI. 프론트 `npm run typecheck && npm run lint && npm run build`.

---

## 파일 구조

**백엔드 (신규):** `dto/DeliveryCallCreateRequest.java`, `dto/DeliveryCallAcceptRequest.java`, `service/DeliveryCallService.java`, `db/migration/V35__dispatch_orders_offered_status.sql`, `test/.../DeliveryCallApiContractTests.java`.
**백엔드 (수정):** `domain/DispatchOrderStatus.java`(+OFFERED), `domain/DispatchOrder.java`(nullable bikeId + createOffered + assign), `repository/DispatchOrderRepository.java`(+1 메서드), `controller/DispatchOrderCommandController.java`(+3 라우트), `controller/DispatchOrderReadController.java`(+1 라우트).
**프론트 (신규):** `components/management/BaeminCallPanel.tsx`.
**프론트 (수정):** `lib/services/service-ops-api.ts`, `app/dispatch/actions.ts`, `app/management/page.tsx`, `app/globals.css`.

---

### Task 1: V35 + OFFERED status + DispatchOrder 확장

**Files:**
- Create: `development/service-ops-api/src/main/resources/db/migration/V35__dispatch_orders_offered_status.sql`
- Modify: `.../dispatch/domain/DispatchOrderStatus.java`
- Modify: `.../dispatch/domain/DispatchOrder.java`

- [ ] **Step 1: 마이그레이션**

`V35__dispatch_orders_offered_status.sql`:
```sql
alter table dispatch_orders alter column bike_id drop not null;
alter table dispatch_orders drop constraint ck_dispatch_orders_status;
alter table dispatch_orders add constraint ck_dispatch_orders_status check (status in ('OFFERED', 'ASSIGNED', 'COMPLETED'));
```

- [ ] **Step 2: OFFERED 추가**

READ `DispatchOrderStatus.java`. 현재 `{ASSIGNED, COMPLETED}` → `OFFERED` 를 맨 앞에 추가:
```java
public enum DispatchOrderStatus {
    OFFERED,
    ASSIGNED,
    COMPLETED
}
```

- [ ] **Step 3: DispatchOrder — nullable bikeId + createOffered + assign**

READ `DispatchOrder.java`. 변경:
1. `bikeId` 필드의 `@Column(name = "bike_id", nullable = false)` → `@Column(name = "bike_id")` (nullable 허용).
2. 기존 `complete(Instant)` 메서드 아래에 추가:
```java
    /** 배민 라이더 수락 콜: 차량 미배정(OFFERED) 생성. 수락 시 assign 으로 차량/순번 부여. */
    public static DispatchOrder createOffered(String customerName, String customerPhone,
                                              String address, double latitude, double longitude) {
        DispatchOrder order = new DispatchOrder();
        order.bikeId = null;
        order.customerName = customerName;
        order.customerPhone = customerPhone;
        order.address = address;
        order.latitude = latitude;
        order.longitude = longitude;
        order.sequence = 0L;
        order.status = DispatchOrderStatus.OFFERED;
        order.kind = DispatchOrderKind.DELIVERY;
        order.batchId = null;
        return order;
    }

    /** OFFERED 콜을 차량에 배정. OFFERED 가 아니면 거부. */
    public void assign(UUID bikeId, long sequence) {
        if (this.status != DispatchOrderStatus.OFFERED) {
            throw new com.thundercrew.opsapi.common.api.InvalidStateTransitionException(
                    "이미 배정된 콜입니다. 현재: " + this.status);
        }
        this.bikeId = bikeId;
        this.sequence = sequence;
        this.status = DispatchOrderStatus.ASSIGNED;
    }
```
(`DispatchOrderKind`/`UUID`/`DispatchOrderStatus` 는 같은 패키지/기존 import. `InvalidStateTransitionException` 은 FQN 으로 쓰거나 import 추가. `bikeId` 필드는 `private UUID bikeId;` — null 대입 가능.)

- [ ] **Step 4: 컴파일**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/service-ops-api && ./gradlew compileJava -q
```
Expected: BUILD SUCCESSFUL.

- [ ] **Step 5: 커밋**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain && git add development/service-ops-api/src/main/resources/db/migration/V35__dispatch_orders_offered_status.sql development/service-ops-api/src/main/java/com/thundercrew/opsapi/dispatch/domain/ && git commit -m "feat(c1): V35 OFFERED status + nullable bike_id, DispatchOrder.createOffered/assign"
```

---

### Task 2: Repository — OFFERED 목록 조회

**Files:**
- Modify: `.../dispatch/repository/DispatchOrderRepository.java`

- [ ] **Step 1: 메서드 추가**

READ the file. `save` 선언 위에 추가:
```java
    List<DispatchOrder> findByStatusAndDeletedAtIsNullOrderByCreatedAtAsc(DispatchOrderStatus status);
```
(`List`, `DispatchOrderStatus` 이미 import. `createdAt` 은 `DisplaySequencedEntity` 베이스 필드 — 파생 쿼리 정렬 가능.)

- [ ] **Step 2: 컴파일 + 커밋**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/service-ops-api && ./gradlew compileJava -q
cd /c/Users/user/repositories/clever/thundercrew-domain && git add development/service-ops-api/src/main/java/com/thundercrew/opsapi/dispatch/repository/DispatchOrderRepository.java && git commit -m "feat(c1): findByStatus OrderByCreatedAtAsc for OFFERED calls"
```

---

### Task 3: DeliveryCallService + DTOs

**Files:**
- Create: `.../dispatch/dto/DeliveryCallCreateRequest.java`
- Create: `.../dispatch/dto/DeliveryCallAcceptRequest.java`
- Create: `.../dispatch/service/DeliveryCallService.java`

- [ ] **Step 1: DTOs**

먼저 READ 기존 `dto/DispatchOrderCreateRequest.java` 로 검증 애너테이션 스타일(@NotBlank/@DecimalMin 등)을 확인하고 동일하게 맞춘다. 그런 다음:

`DeliveryCallCreateRequest.java`:
```java
package com.thundercrew.opsapi.dispatch.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;

public record DeliveryCallCreateRequest(
        @NotBlank String customerName,
        @NotBlank String customerPhone,
        @NotBlank String address,
        @DecimalMin("-90.0") @DecimalMax("90.0") double latitude,
        @DecimalMin("-180.0") @DecimalMax("180.0") double longitude
) {
}
```
(만약 `DispatchOrderCreateRequest` 가 다른 검증 idiom 을 쓰면 그걸 따른다.)

`DeliveryCallAcceptRequest.java`:
```java
package com.thundercrew.opsapi.dispatch.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record DeliveryCallAcceptRequest(@NotNull UUID bikeId) {
}
```

- [ ] **Step 2: DeliveryCallService**

먼저 READ `Bike.java`(getServiceType() 존재·반환 enum 확인) + `BikeServiceType.java`(DELIVERY) + `bike/repository/BikeRepository.java`(findAllByDeletedAtIsNull 존재, 단건 조회 메서드) + `DispatchOrderCommandService.java`(appendForBike 시그니처). 그런 다음:

`DeliveryCallService.java`:
```java
package com.thundercrew.opsapi.dispatch.service;

import com.thundercrew.opsapi.bike.domain.Bike;
import com.thundercrew.opsapi.bike.domain.BikeServiceType;
import com.thundercrew.opsapi.bike.repository.BikeRepository;
import com.thundercrew.opsapi.common.api.InvalidStateTransitionException;
import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import com.thundercrew.opsapi.dispatch.domain.DispatchOrder;
import com.thundercrew.opsapi.dispatch.domain.DispatchOrderStatus;
import com.thundercrew.opsapi.dispatch.dto.DispatchOrderReadResponse;
import com.thundercrew.opsapi.dispatch.repository.DispatchOrderRepository;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 배민 단건 콜 오케스트레이션.
 * - systemDispatch: 가장 적게 배정된 DELIVERY 차량을 골라 즉시 ASSIGNED 주문 생성.
 * - offerCall: 차량 미배정(OFFERED) 콜 생성.
 * - acceptCall: OFFERED 콜을 운영자가 지정한 차량에 배정(ASSIGNED).
 */
@Service
@Transactional
public class DeliveryCallService {

    private final DispatchOrderRepository orderRepository;
    private final BikeRepository bikeRepository;
    private final DispatchOrderCommandService commandService;

    public DeliveryCallService(DispatchOrderRepository orderRepository,
                               BikeRepository bikeRepository,
                               DispatchOrderCommandService commandService) {
        this.orderRepository = orderRepository;
        this.bikeRepository = bikeRepository;
        this.commandService = commandService;
    }

    /** 시스템 자동 배차: 가장 적게 배정된 DELIVERY 차량 선택 → ASSIGNED 주문. */
    public DispatchOrderReadResponse systemDispatch(String customerName, String customerPhone,
                                                    String address, double latitude, double longitude) {
        List<Bike> deliveryBikes = bikeRepository.findAllByDeletedAtIsNull().stream()
                .filter(b -> b.getServiceType() == BikeServiceType.DELIVERY)
                .toList();
        if (deliveryBikes.isEmpty()) {
            throw new InvalidStateTransitionException("가용 배송 차량이 없습니다.");
        }
        Map<UUID, Long> assignedCount = orderRepository
                .findByStatusAndDeletedAtIsNull(DispatchOrderStatus.ASSIGNED).stream()
                .filter(o -> o.getBikeId() != null)
                .collect(Collectors.groupingBy(DispatchOrder::getBikeId, Collectors.counting()));
        Bike target = deliveryBikes.stream()
                .min(Comparator.comparingLong(b -> assignedCount.getOrDefault(b.getId(), 0L)))
                .orElseThrow(() -> new InvalidStateTransitionException("가용 배송 차량이 없습니다."));
        return commandService.appendForBike(
                target.getId(), customerName, customerPhone, address, latitude, longitude);
    }

    /** 라이더 수락 콜: 차량 미배정 OFFERED 생성. */
    public DispatchOrderReadResponse offerCall(String customerName, String customerPhone,
                                               String address, double latitude, double longitude) {
        DispatchOrder order = orderRepository.save(
                DispatchOrder.createOffered(customerName, customerPhone, address, latitude, longitude));
        return DispatchOrderReadResponse.from(order);
    }

    /** OFFERED 콜을 운영자 지정 차량에 배정. */
    public DispatchOrderReadResponse acceptCall(UUID orderId, UUID bikeId) {
        DispatchOrder order = orderRepository.findByIdAndDeletedAtIsNull(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("DispatchOrder", orderId));
        bikeRepository.findAllByIdIn(List.of(bikeId)).stream().findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Bike", bikeId));
        long nextSequence = orderRepository
                .findTopByBikeIdAndDeletedAtIsNullOrderBySequenceDesc(bikeId)
                .map(o -> o.getSequence() + 1)
                .orElse(1L);
        order.assign(bikeId, nextSequence); // dirty-checking flush
        return DispatchOrderReadResponse.from(order);
    }

    @Transactional(readOnly = true)
    public List<DispatchOrderReadResponse> listOffered() {
        return orderRepository
                .findByStatusAndDeletedAtIsNullOrderByCreatedAtAsc(DispatchOrderStatus.OFFERED).stream()
                .map(DispatchOrderReadResponse::from)
                .toList();
    }
}
```
주의: `Bike.getServiceType()`/`BikeServiceType.DELIVERY`/`Bike.getId()`/`BikeRepository.findAllByIdIn` 가 실제 존재하는지 READ 로 확인하고, 다르면 실제 API 에 맞춰 조정(예: 단건 bike 조회 메서드가 따로 있으면 그걸 사용). `appendForBike` 가 `DispatchOrderReadResponse` 를 반환하는지 확인(맞음).

- [ ] **Step 3: 컴파일 + 커밋**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/service-ops-api && ./gradlew compileJava -q
cd /c/Users/user/repositories/clever/thundercrew-domain && git add development/service-ops-api/src/main/java/com/thundercrew/opsapi/dispatch/service/DeliveryCallService.java development/service-ops-api/src/main/java/com/thundercrew/opsapi/dispatch/dto/DeliveryCallCreateRequest.java development/service-ops-api/src/main/java/com/thundercrew/opsapi/dispatch/dto/DeliveryCallAcceptRequest.java && git commit -m "feat(c1): DeliveryCallService — systemDispatch/offer/accept + DTOs"
```

---

### Task 4: 컨트롤러 라우트 (배민 콜)

**Files:**
- Modify: `.../dispatch/controller/DispatchOrderCommandController.java`
- Modify: `.../dispatch/controller/DispatchOrderReadController.java`

- [ ] **Step 1: Command 라우트 3개**

READ `DispatchOrderCommandController.java`. `DeliveryCallService` 를 생성자 주입에 추가하고(기존 두 서비스 옆) 라우트 추가. import: `DeliveryCallCreateRequest`, `DeliveryCallAcceptRequest`, `DeliveryCallService`. 클래스 내부에 추가:
```java
    @PostMapping("/calls/system")
    DispatchOrderReadResponse systemCall(@Valid @RequestBody DeliveryCallCreateRequest request) {
        return deliveryCallService.systemDispatch(request.customerName(), request.customerPhone(),
                request.address(), request.latitude(), request.longitude());
    }

    @PostMapping("/calls/offer")
    DispatchOrderReadResponse offerCall(@Valid @RequestBody DeliveryCallCreateRequest request) {
        return deliveryCallService.offerCall(request.customerName(), request.customerPhone(),
                request.address(), request.latitude(), request.longitude());
    }

    @PostMapping("/calls/{id}/accept")
    DispatchOrderReadResponse acceptCall(@PathVariable UUID id,
                                         @Valid @RequestBody DeliveryCallAcceptRequest request) {
        return deliveryCallService.acceptCall(id, request.bikeId());
    }
```
생성자: 기존 `(DispatchOrderCommandService, DispatchOrderBulkService)` 에 `DeliveryCallService deliveryCallService` 파라미터를 추가하고 필드 대입.
(ArchUnit: 이 컨트롤러는 이미 `isDispatchCommand` allow-list 에 등록돼 있어 신규 @RequestBody/write 라우트가 자동 커버됨 — ArchUnit 변경 불필요.)

- [ ] **Step 2: Read 라우트 1개**

READ `DispatchOrderReadController.java`. `DeliveryCallService` 주입 추가 + 라우트:
```java
    @GetMapping("/calls/offered")
    List<DispatchOrderReadResponse> offeredCalls() {
        return deliveryCallService.listOffered();
    }
```
생성자에 `DeliveryCallService` 추가. import `DeliveryCallService` (List 이미 import).

- [ ] **Step 3: 컴파일 + ArchUnit (Docker 불필요)**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/service-ops-api && ./gradlew compileJava -q && ./gradlew test --tests "com.thundercrew.opsapi.ArchitectureBoundaryTests" -q
```
Expected: 컴파일 성공. ArchUnit 은 기존 pre-red 베이스라인(타 도메인)만 실패 — **dispatch-orders 컨트롤러의 새 라우트가 위반에 등장하면 안 됨**(이미 allow-list). 실패 목록에 `DispatchOrderCommandController` 가 새로 나타나면 조사.

- [ ] **Step 4: 커밋**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain && git add development/service-ops-api/src/main/java/com/thundercrew/opsapi/dispatch/controller/ && git commit -m "feat(c1): baemin call routes (system/offer/accept/offered)"
```

---

### Task 5: 계약 테스트 (DeliveryCallApiContractTests)

**Files:**
- Create: `development/service-ops-api/src/test/java/com/thundercrew/opsapi/DeliveryCallApiContractTests.java`

- [ ] **Step 1: 작성**

READ `DispatchOrderApiContractTests.java`(베이스/시드/MockMvc 방식) 와 `DispatchRoundApiContractTests.java`(409 IllegalState→InvalidStateTransition 매핑 확인 — `InvalidStateTransitionException`→409). 동일 harness 로 작성. 케이스:
1. **시스템 배차**: 차량 2대 시드(둘 다 DELIVERY). `POST /api/v1/dispatch-orders/calls/system` (고객/주소/좌표) → 200, 응답 `status=="ASSIGNED"`, `bikeId != null`. `GET /api/v1/dispatch-orders?bikeId={배정차량}` 에 등장.
2. **least-loaded 선택**: 차량 A에 ASSIGNED 주문 1건 선등록, B는 0건. systemDispatch → 응답 bikeId == B(적게 배정된 쪽).
3. **가용 차량 없음**: DELIVERY 차량이 없도록 시드(또는 모두 다른 serviceType) → systemDispatch → 409, 메시지 "배송 차량".
4. **offer + 목록**: `POST /calls/offer` → 200 `status=="OFFERED"`, `bikeId==null`. `GET /calls/offered` 에 그 콜 포함.
5. **accept**: offer 후 `POST /calls/{id}/accept` body `{"bikeId":"..."}` → 200 `status=="ASSIGNED"`, `bikeId` 설정. `GET /dispatch-orders?bikeId=` 에 등장. `GET /calls/offered` 에서 사라짐.
6. **이미 ASSIGNED accept**: 5의 주문을 다시 accept → 409 (InvalidStateTransition).

(좌표는 요청 body 에 포함. 차량 serviceType 시드 방법은 기존 테스트의 bikes insert SQL 에 service_type 컬럼을 'DELIVERY'/다른 값으로 넣어 제어 — 기존 seedBike SQL 확인.)

- [ ] **Step 2: 컴파일 (실행은 Docker/CI)**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/service-ops-api && ./gradlew compileTestJava -q
```
Expected: BUILD SUCCESSFUL. (`./gradlew test` 로 이 테스트는 돌리지 말 것 — Docker 필요.)

- [ ] **Step 3: 커밋**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain && git add development/service-ops-api/src/test/java/com/thundercrew/opsapi/DeliveryCallApiContractTests.java && git commit -m "test(c1): DeliveryCall contract tests (system/least-loaded/offer/accept)"
```

---

### Task 6: 프론트 — 타입 + 클라이언트 + 서버 액션

**Files:**
- Modify: `development/front-admin-web/lib/services/service-ops-api.ts`
- Modify: `development/front-admin-web/app/dispatch/actions.ts`

- [ ] **Step 1: 타입 + 클라이언트**

READ `service-ops-api.ts`. 변경:
- `ServiceOpsDispatchOrderStatus` 에 `"OFFERED"` 추가 (현재 `"ASSIGNED" | "COMPLETED"` → `"OFFERED" | "ASSIGNED" | "COMPLETED"`).
- `ServiceOpsDispatchOrder.bikeId` 를 `string | null` 로 (현재 string).
- 신규 payload 타입:
```ts
export type DeliveryCallPayload = {
  customerName: string;
  customerPhone: string;
  address: string;
  latitude: number;
  longitude: number;
};
```
- 클라이언트 메서드(타입 + factory, 기존 dispatch 메서드 옆):
```ts
    systemDispatchCall: (payload: DeliveryCallPayload) => Promise<ServiceOpsDispatchOrder>;
    offerCall: (payload: DeliveryCallPayload) => Promise<ServiceOpsDispatchOrder>;
    acceptCall: (orderId: string, bikeId: string) => Promise<ServiceOpsDispatchOrder>;
    listOfferedCalls: () => Promise<ServiceOpsDispatchOrder[]>;
```
factory 구현(기존 `request<T>` + JSON POST 패턴 미러링):
```ts
    systemDispatchCall: (payload) =>
      request<ServiceOpsDispatchOrder>("/dispatch-orders/calls/system", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
      }),
    offerCall: (payload) =>
      request<ServiceOpsDispatchOrder>("/dispatch-orders/calls/offer", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
      }),
    acceptCall: (orderId, bikeId) =>
      request<ServiceOpsDispatchOrder>(`/dispatch-orders/calls/${orderId}/accept`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bikeId })
      }),
    listOfferedCalls: () =>
      request<ServiceOpsDispatchOrder[]>("/dispatch-orders/calls/offered", { method: "GET" }),
```
(실제 `request` 시그니처/헤더 관례는 기존 `createDispatchRound`/`applyDispatchOrders` 호출부를 그대로 따른다.)

- [ ] **Step 2: 서버 액션**

READ `app/dispatch/actions.ts`. `geocodeAddress`(ncp-geocoder), `extractError`, `createAuthenticatedServiceOpsApiClient`, `DeliveryCallPayload` import. 추가:
```ts
async function geocodeFormToPayload(formData: FormData):
  Promise<{ ok: true; payload: DeliveryCallPayload } | { ok: false; error: string }> {
  const customerName = String(formData.get("customerName") ?? "").trim();
  const customerPhone = String(formData.get("customerPhone") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  if (!customerName || !customerPhone || !address) {
    return { ok: false, error: "모든 항목을 입력해주세요." };
  }
  const coords = await geocodeAddress(address);
  if (!coords) return { ok: false, error: "주소를 찾을 수 없습니다. 다시 확인해주세요." };
  return { ok: true, payload: { customerName, customerPhone, address, latitude: coords.latitude, longitude: coords.longitude } };
}

export async function createSystemCallAction(
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) return { ok: false, error: "로그인이 필요합니다." };
  const geo = await geocodeFormToPayload(formData);
  if (!geo.ok) return geo;
  try {
    await client.systemDispatchCall(geo.payload);
    revalidatePath("/management"); revalidatePath("/");
    return { ok: true };
  } catch (err) { return { ok: false, error: extractError(err) }; }
}

export async function createOfferedCallAction(
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) return { ok: false, error: "로그인이 필요합니다." };
  const geo = await geocodeFormToPayload(formData);
  if (!geo.ok) return geo;
  try {
    await client.offerCall(geo.payload);
    revalidatePath("/management"); revalidatePath("/");
    return { ok: true };
  } catch (err) { return { ok: false, error: extractError(err) }; }
}

export async function acceptCallAction(
  orderId: string, bikeId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) return { ok: false, error: "로그인이 필요합니다." };
  try {
    await client.acceptCall(orderId, bikeId);
    revalidatePath("/management"); revalidatePath("/");
    return { ok: true };
  } catch (err) { return { ok: false, error: extractError(err) }; }
}

export async function listOfferedCallsAction(): Promise<ServiceOpsDispatchOrder[]> {
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: false });
  if (!client) return [];
  return client.listOfferedCalls().catch(() => []);
}
```
import 에 `DeliveryCallPayload`, `ServiceOpsDispatchOrder` 추가(이미 있으면 생략).

- [ ] **Step 3: typecheck + lint**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web && npm run typecheck && npm run lint
```
Expected: 통과.

- [ ] **Step 4: 커밋**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain && git add development/front-admin-web/lib/services/service-ops-api.ts development/front-admin-web/app/dispatch/actions.ts && git commit -m "feat(c1): frontend baemin call types/client/actions"
```

---

### Task 7: 프론트 — /management 배민 콜 섹션

**Files:**
- Create: `development/front-admin-web/components/management/BaeminCallPanel.tsx`
- Modify: `development/front-admin-web/app/management/page.tsx`
- Modify: `development/front-admin-web/app/globals.css`

- [ ] **Step 1: BaeminCallPanel 작성**

`"use client"` 컴포넌트, 섹션 "배민 콜". props: `initialOffered: ServiceOpsDispatchOrder[]`, `deliveryVehicles: { id: string; plateNumber: string }[]` (수락 시 차량 선택용 — 서버 페이지에서 DELIVERY 차량 추출해 전달). 구성:
- **콜 입력 폼**: 고객명(input) / 연락처(input) / 배달지(읽기전용 input + `AddressSearchButton` onSelect 로 주소 채움 — `VehicleDetailDialog` 의 옛 NextCustomer 폼 또는 station 폼에서 AddressSearchButton 사용법 참고) / 모드 라디오(`system` | `offer`). 제출(useTransition): FormData 구성(customerName/customerPhone/address) → 모드가 system 이면 `createSystemCallAction(fd)`, offer 면 `createOfferedCallAction(fd)`. 성공 시 폼 초기화 + offered 목록 reload(`listOfferedCallsAction()`); 실패 시 `error` 표시(가용 차량 없음 등 409 메시지).
- **OFFERED 목록**: `offered` state(초기 prop), 각 콜 카드(고객명/연락처/주소) + 차량 선택 `<select>`(deliveryVehicles) + **수락** 버튼 → `acceptCallAction(order.id, selectedBikeId)`; 성공 시 목록 reload.
- AddressSearchButton import: `@/components/management/AddressSearchButton`.

CSS 클래스는 `globals.css`(Step 3)에 추가, 기존 `.dispatch-*`/관리 폼 스타일 관례 따름.

- [ ] **Step 2: page.tsx 연결**

READ `app/management/page.tsx`(서버 컴포넌트). `listOfferedCallsAction()` 으로 초기 OFFERED 를 await 하고, 차량 목록(이미 페이지가 로드하는 vehicles 데이터에서 serviceType==="DELIVERY" 추출해 `{id, plateNumber}[]`)을 만들어 `<BaeminCallPanel initialOffered={...} deliveryVehicles={...} />` 로 전달. 기존 DispatchPanel/StrollerRoundPanel 섹션 옆에 배치. (페이지가 차량 데이터를 어떻게 로드하는지 확인 후 DELIVERY 필터; 없으면 차량 로더 재사용.)

- [ ] **Step 3: CSS**

`app/globals.css` 에 `.baemin-call-*`(폼, 모드 라디오, OFFERED 카드, 수락 행) 클래스 추가. 기존 관리 폼/`.dispatch-*` 스타일 미러링.

- [ ] **Step 4: typecheck + lint + 커밋**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web && npm run typecheck && npm run lint
cd /c/Users/user/repositories/clever/thundercrew-domain && git add development/front-admin-web/components/management/BaeminCallPanel.tsx development/front-admin-web/app/management/page.tsx development/front-admin-web/app/globals.css && git commit -m "feat(c1): /management 배민 콜 섹션 (입력 폼 + OFFERED 수락)"
```

---

### Task 8: 최종 검증 + PR

- [ ] **Step 1: 백엔드 + 프론트 풀 검증**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/service-ops-api && ./gradlew compileJava compileTestJava -q && ./gradlew test --tests "com.thundercrew.opsapi.ArchitectureBoundaryTests" -q
cd /c/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web && npm run typecheck && npm run lint && npm run build
```
Expected: 백엔드 컴파일 성공, ArchUnit dispatch 위반 0(기존 베이스라인만), 프론트 빌드 성공.

- [ ] **Step 2: PR (→ dev)**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain && git diff dev --stat && git push -u origin cc-c1-baemin-call && gh pr create --base dev --title "Group C1: 배민 배송 (단건 콜: 시스템 배차/라이더 수락)" --body "$(cat <<'EOF'
## Summary
- DispatchOrder 확장(OFFERED status + nullable bike_id, V35)으로 배민 단건 콜
- 시스템 자동 배차(가장 적게 배정된 DELIVERY 차량) 또는 라이더 수락(OFFERED→운영자 차량 지정 accept)
- /management 배민 콜 섹션(입력 폼 + 모드 라디오 + OFFERED 목록/수락)
- OFFERED 는 차량별 ASSIGNED 쿼리에서 제외 → 대시보드/큐/완료 핫패스 무변경; 수락 후 합류

## 배포 영향
- **V35 마이그레이션 신규**(bike_id nullable + status check OFFERED 추가) — 재기동 시 Flyway 적용, 기존 데이터 영향 없음
- 백엔드 + 프론트

## Test Plan
- [x] 백엔드 compileJava/compileTestJava, ArchUnit(dispatch 위반 0), 프론트 typecheck/lint/build
- [ ] 계약 테스트 DeliveryCallApiContractTests — Docker/CI
- [ ] 프로덕션 QA: 배민 콜 입력(시스템 배차 → 차량 자동 배정 / 라이더 수락 → OFFERED → 수락) → 차량 배차 큐 반영

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

**1. Spec coverage:**
- V35(bike_id nullable + status OFFERED) → Task 1. ✓
- OFFERED status + createOffered/assign → Task 1. ✓
- 시스템 자동 배차(least-loaded DELIVERY) → Task 3 systemDispatch. ✓
- 라이더 수락(offer + accept) → Task 3 offerCall/acceptCall. ✓
- 가용 차량 없음 409 → Task 3 (InvalidStateTransitionException). ✓
- 컨트롤러 라우트(system/offer/accept/offered) → Task 4. ArchUnit 기존 allow-list 커버. ✓
- OFFERED 목록 → Task 2 repo + Task 3 listOffered + Task 4 read route. ✓
- 계약 테스트(시스템/least-loaded/없음/offer/accept/재배정) → Task 5. ✓
- 프론트 타입/클라이언트/액션 → Task 6. ✓
- /management 배민 콜 섹션 + 수락 → Task 7. ✓
- 지도/차량상세 자동 반영(별도 UI 없음) → 기존 C0/C2 재사용, 신규 작업 없음. ✓
- DELIVERY serviceType 재사용 → 신규 enum 없음. ✓

**2. Placeholder scan:** 백엔드 신규 파일은 완전 코드. 프론트(Task 6/7)는 일부 "기존 X 패턴 미러링"으로 위임 — request<T> 호출 관례, page.tsx 차량 로더 구조, AddressSearchButton 사용법이 코드베이스 의존이라 구현자가 해당 파일을 읽어야 정확. 위임마다 따를 구체 대상(파일/심볼) 명시. 순수 신규 로직(systemDispatch/accept/least-loaded)은 완전 코드 제공.

**3. Type consistency:** `DispatchOrderStatus{OFFERED,ASSIGNED,COMPLETED}`, `DispatchOrder.createOffered(name,phone,address,lat,lng)`/`assign(bikeId,sequence)`, `DeliveryCallService.systemDispatch/offerCall/acceptCall/listOffered`, repo `findByStatusAndDeletedAtIsNullOrderByCreatedAtAsc`, `DeliveryCallCreateRequest(customerName,customerPhone,address,latitude,longitude)`, `DeliveryCallAcceptRequest(bikeId)` — Task 간 일관. 프론트 `DeliveryCallPayload`/`systemDispatchCall`/`offerCall`/`acceptCall`/`listOfferedCalls` + 액션 `createSystemCallAction`/`createOfferedCallAction`/`acceptCallAction`/`listOfferedCallsAction` 일관. `ServiceOpsDispatchOrder.bikeId: string|null` + status OFFERED 추가.

**구현자 주의:** 백엔드 순차 의존(엔티티→레포→서비스→컨트롤러→테스트). 프론트(6→7)는 백엔드 status/bikeId 변경에 의존. Task 3 의 `Bike.getServiceType()`/`BikeServiceType.DELIVERY`/`BikeRepository` 단건조회는 실제 API 를 READ 로 확인 후 조정.
