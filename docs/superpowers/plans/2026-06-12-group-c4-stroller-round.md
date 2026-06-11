# Group C4 — 유모차 클리닝 (수거 → 배송 2단계 라운드) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 유모차 클리닝의 "전체 수거 → 전체 배송" 2단계 배치 흐름을, 기존 `DispatchOrder`(태스크 단위) 확장 + 신규 `DispatchBatch`(라운드 단계) 엔티티로 구축한다 (백엔드 full-stack + 프론트).

**Architecture:** `dispatch_orders`에 `kind`(PICKUP/DELIVERY)·`batch_id`를 더하고, 라운드 단계(COLLECTING→DELIVERING→DONE)를 가진 `dispatch_batch`를 신설한다. **활성 단계의 태스크만 ASSIGNED로 존재**(배송 주문은 '배송 시작' 시점 생성)시켜 대시보드·배차 큐·시동 알림 핫패스 쿼리를 C2/C3와 동일하게 유지한다. 엑셀 벌크·지오코딩·배차 큐 UI·시동 알림(C3)을 재사용한다.

**Tech Stack:** Spring Boot (Java 21), Flyway, JPA `Repository<T,UUID>`, JUnit/Testcontainers, Next.js App Router, TypeScript.

**작업 경로:** 백엔드 `development/service-ops-api`, 프론트 `development/front-admin-web` (절대경로 `cd /c/Users/user/repositories/clever/thundercrew-domain/...`, Bash 툴, cwd 매 호출 리셋). 브랜치 `cc-c4-stroller-round` 이미 체크아웃 — 새 브랜치 만들지 말 것.

**테스트 실행 주의:** ArchUnit 테스트는 Docker 불필요(바이트코드 분석). 계약/Testcontainers 테스트는 **Docker 필요(이 머신엔 없음)** → 작성·컴파일까지만, 실행은 CI. 프론트는 `npm run typecheck && npm run lint && npm run build`.

---

## 파일 구조

**백엔드 (신규)** `com.thundercrew.opsapi.dispatch`:
- `domain/DispatchOrderKind.java` — enum PICKUP/DELIVERY
- `domain/DispatchBatchStatus.java` — enum COLLECTING/DELIVERING/DONE
- `domain/DispatchBatch.java` — 라운드 엔티티
- `repository/DispatchBatchRepository.java`
- `service/DispatchRoundService.java` — createRound/startDelivery/activeRound
- `dto/DispatchRoundResponse.java`
- `controller/DispatchBatchReadController.java`, `controller/DispatchBatchCommandController.java`
- `db/migration/V34__add_dispatch_batch_and_order_kind.sql`
- `test/.../DispatchRoundApiContractTests.java`

**백엔드 (수정):** `domain/DispatchOrder.java`(kind/batchId), `repository/DispatchOrderRepository.java`(+2 메서드), `service/DispatchOrderCommandService.java`(appendForBatch + complete 확장), `dto/DispatchOrderReadResponse.java`(+kind), `dashboard/dto/DashboardMapStateResponse.java`+`dashboard/service/DashboardMapStateService.java`(+currentDispatchKind), `test/.../ArchitectureBoundaryTests.java`(allow-list).

**프론트 (신규):** `components/management/StrollerRoundPanel.tsx`.
**프론트 (수정):** `lib/services/service-ops-api.ts`, `app/dispatch/actions.ts`, `app/management/page.tsx`, `components/management/VehicleDetailDialog.tsx`(큐 수거/배송 라벨), `components/overview/FleetSimulationContext.tsx`+`components/layout/NotificationContext.tsx`+`components/layout/NotificationBell.tsx`(알림 kind 라벨).

---

### Task 1: V34 마이그레이션 + enum + 엔티티 확장 + DispatchBatch

**Files:**
- Create: `development/service-ops-api/src/main/resources/db/migration/V34__add_dispatch_batch_and_order_kind.sql`
- Create: `development/service-ops-api/src/main/java/com/thundercrew/opsapi/dispatch/domain/DispatchOrderKind.java`
- Create: `development/service-ops-api/src/main/java/com/thundercrew/opsapi/dispatch/domain/DispatchBatchStatus.java`
- Create: `development/service-ops-api/src/main/java/com/thundercrew/opsapi/dispatch/domain/DispatchBatch.java`
- Modify: `development/service-ops-api/src/main/java/com/thundercrew/opsapi/dispatch/domain/DispatchOrder.java`

- [ ] **Step 1: 마이그레이션 작성**

`V34__add_dispatch_batch_and_order_kind.sql`:
```sql
alter table dispatch_orders add column kind varchar(20) not null default 'DELIVERY';
alter table dispatch_orders add constraint ck_dispatch_orders_kind check (kind in ('PICKUP', 'DELIVERY'));
alter table dispatch_orders add column batch_id uuid;
create index ix_dispatch_orders_batch on dispatch_orders (batch_id, kind, status) where deleted_at is null;

create table dispatch_batch (
    id uuid primary key,
    idx bigserial not null unique,
    status varchar(20) not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    created_by uuid,
    updated_by uuid,
    deleted_by uuid,
    constraint ck_dispatch_batch_status check (status in ('COLLECTING', 'DELIVERING', 'DONE'))
);
```

- [ ] **Step 2: enum 2개 작성**

`DispatchOrderKind.java`:
```java
package com.thundercrew.opsapi.dispatch.domain;

public enum DispatchOrderKind {
    PICKUP,
    DELIVERY
}
```
`DispatchBatchStatus.java`:
```java
package com.thundercrew.opsapi.dispatch.domain;

public enum DispatchBatchStatus {
    COLLECTING,
    DELIVERING,
    DONE
}
```

- [ ] **Step 3: DispatchBatch 엔티티 작성**

`DispatchBatch.java`:
```java
package com.thundercrew.opsapi.dispatch.domain;

import com.thundercrew.opsapi.common.domain.DisplaySequencedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "dispatch_batch")
public class DispatchBatch extends DisplaySequencedEntity {

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DispatchBatchStatus status;

    public static DispatchBatch create() {
        DispatchBatch batch = new DispatchBatch();
        batch.status = DispatchBatchStatus.COLLECTING;
        return batch;
    }

    /** 전체 수거 완료 후 운영자 '배송 시작'. COLLECTING 에서만 허용. */
    public void startDelivery() {
        if (status != DispatchBatchStatus.COLLECTING) {
            throw new IllegalStateException("배송 시작은 수거 단계에서만 가능합니다. 현재: " + status);
        }
        this.status = DispatchBatchStatus.DELIVERING;
    }

    /** 전체 배송 완료. DELIVERING 에서만 허용. */
    public void markDone(UUID actorId, Instant when) {
        if (status != DispatchBatchStatus.DELIVERING) {
            throw new IllegalStateException("완료는 배송 단계에서만 가능합니다. 현재: " + status);
        }
        this.status = DispatchBatchStatus.DONE;
    }

    public DispatchBatchStatus getStatus() {
        return status;
    }

    protected DispatchBatch() {
    }
}
```

- [ ] **Step 4: DispatchOrder 에 kind/batchId 추가**

`DispatchOrder.java` — `completedAt` 필드 선언(`@Column private Instant completedAt;`) 아래에 추가:
```java
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DispatchOrderKind kind;

    @Column(name = "batch_id")
    private UUID batchId;
```
기존 `create(...)` 팩토리의 `order.status = DispatchOrderStatus.ASSIGNED;` 다음 줄에 추가(단건 주문 하위호환 = DELIVERY/배치 없음):
```java
        order.kind = DispatchOrderKind.DELIVERY;
        order.batchId = null;
```
`create(...)` 아래에 배치용 팩토리 추가:
```java
    public static DispatchOrder createForBatch(UUID bikeId, String customerName, String customerPhone,
                                               String address, double latitude, double longitude, long sequence,
                                               DispatchOrderKind kind, UUID batchId) {
        DispatchOrder order = create(bikeId, customerName, customerPhone, address, latitude, longitude, sequence);
        order.kind = kind;
        order.batchId = batchId;
        return order;
    }
```
getter 추가(`getCompletedAt()` 아래):
```java
    public DispatchOrderKind getKind() {
        return kind;
    }

    public UUID getBatchId() {
        return batchId;
    }
```

- [ ] **Step 5: 컴파일 확인**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/service-ops-api && ./gradlew compileJava -q
```
Expected: BUILD SUCCESSFUL.

- [ ] **Step 6: 커밋**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain && git add development/service-ops-api/src/main/resources/db/migration/V34__add_dispatch_batch_and_order_kind.sql development/service-ops-api/src/main/java/com/thundercrew/opsapi/dispatch/domain/ && git commit -m "feat(c4): V34 dispatch_batch + dispatch_orders kind/batch_id, DispatchBatch entity"
```

---

### Task 2: Repository — DispatchBatchRepository + DispatchOrderRepository 추가

**Files:**
- Create: `.../dispatch/repository/DispatchBatchRepository.java`
- Modify: `.../dispatch/repository/DispatchOrderRepository.java`

- [ ] **Step 1: DispatchBatchRepository 작성**

```java
package com.thundercrew.opsapi.dispatch.repository;

import com.thundercrew.opsapi.dispatch.domain.DispatchBatch;
import com.thundercrew.opsapi.dispatch.domain.DispatchBatchStatus;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.repository.Repository;

public interface DispatchBatchRepository extends Repository<DispatchBatch, UUID> {

    List<DispatchBatch> findByStatusInAndDeletedAtIsNull(Collection<DispatchBatchStatus> statuses);

    Optional<DispatchBatch> findByIdAndDeletedAtIsNull(UUID id);

    DispatchBatch save(DispatchBatch batch);
}
```

- [ ] **Step 2: DispatchOrderRepository 에 메서드 추가**

`DispatchOrderRepository.java` — `save` 선언 위에 추가 (import: `DispatchOrderKind`):
```java
    List<DispatchOrder> findByBatchIdAndDeletedAtIsNull(UUID batchId);

    List<DispatchOrder> findByBatchIdAndKindAndStatusAndDeletedAtIsNull(
            UUID batchId, DispatchOrderKind kind, DispatchOrderStatus status);
```
파일 상단에 `import com.thundercrew.opsapi.dispatch.domain.DispatchOrderKind;` 추가.

- [ ] **Step 3: 컴파일 확인**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/service-ops-api && ./gradlew compileJava -q
```
Expected: BUILD SUCCESSFUL.

- [ ] **Step 4: 커밋**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain && git add development/service-ops-api/src/main/java/com/thundercrew/opsapi/dispatch/repository/ && git commit -m "feat(c4): DispatchBatchRepository + batch/kind order queries"
```

---

### Task 3: appendForBatch + complete 확장 (배치 자동 완료)

**Files:**
- Modify: `.../dispatch/service/DispatchOrderCommandService.java`

- [ ] **Step 1: DispatchBatchRepository 주입 + appendForBatch + complete 확장**

`DispatchOrderCommandService.java` 전체를 다음으로 교체:
```java
package com.thundercrew.opsapi.dispatch.service;

import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import com.thundercrew.opsapi.dispatch.domain.DispatchBatch;
import com.thundercrew.opsapi.dispatch.domain.DispatchOrder;
import com.thundercrew.opsapi.dispatch.domain.DispatchOrderKind;
import com.thundercrew.opsapi.dispatch.domain.DispatchOrderStatus;
import com.thundercrew.opsapi.dispatch.dto.DispatchOrderCreateRequest;
import com.thundercrew.opsapi.dispatch.dto.DispatchOrderReadResponse;
import com.thundercrew.opsapi.dispatch.repository.DispatchBatchRepository;
import com.thundercrew.opsapi.dispatch.repository.DispatchOrderRepository;
import java.time.Clock;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class DispatchOrderCommandService {

    private final DispatchOrderRepository dispatchOrderRepository;
    private final DispatchBatchRepository dispatchBatchRepository;
    private final Clock clock;

    public DispatchOrderCommandService(DispatchOrderRepository dispatchOrderRepository,
                                       DispatchBatchRepository dispatchBatchRepository,
                                       Clock clock) {
        this.dispatchOrderRepository = dispatchOrderRepository;
        this.dispatchBatchRepository = dispatchBatchRepository;
        this.clock = clock;
    }

    public DispatchOrderReadResponse create(DispatchOrderCreateRequest request) {
        return appendForBike(
                request.bikeId(),
                request.customerName(),
                request.customerPhone(),
                request.address(),
                request.latitude(),
                request.longitude());
    }

    public DispatchOrderReadResponse complete(UUID id) {
        DispatchOrder order = dispatchOrderRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("DispatchOrder", id));
        // 관리 엔티티는 @Transactional 종료 시 dirty-checking 으로 flush 되므로 mutate 경로에 명시적 save() 없음.
        order.complete(clock.instant());
        // 유모차 라운드: 마지막 배송 완료 시 배치를 DONE 으로 자동 전환.
        if (order.getBatchId() != null && order.getKind() == DispatchOrderKind.DELIVERY
                && dispatchOrderRepository.findByBatchIdAndKindAndStatusAndDeletedAtIsNull(
                        order.getBatchId(), DispatchOrderKind.DELIVERY, DispatchOrderStatus.ASSIGNED).isEmpty()) {
            dispatchBatchRepository.findByIdAndDeletedAtIsNull(order.getBatchId())
                    .filter(b -> b.getStatus() == com.thundercrew.opsapi.dispatch.domain.DispatchBatchStatus.DELIVERING)
                    .ifPresent(b -> b.markDone(null, clock.instant()));
        }
        return DispatchOrderReadResponse.from(order);
    }

    public void cancel(UUID id) {
        DispatchOrder order = dispatchOrderRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("DispatchOrder", id));
        order.markDeleted(null, clock.instant());
    }

    public DispatchOrderReadResponse appendForBike(UUID bikeId, String customerName, String customerPhone,
                                                   String address, double latitude, double longitude) {
        long nextSequence = nextSequence(bikeId);
        DispatchOrder order = DispatchOrder.create(
                bikeId, customerName, customerPhone, address, latitude, longitude, nextSequence);
        return DispatchOrderReadResponse.from(dispatchOrderRepository.save(order));
    }

    /** 라운드(batch) 소속 주문을 차량 큐에 append. kind 와 batchId 를 부여한다. */
    public DispatchOrder appendForBatch(UUID bikeId, String customerName, String customerPhone, String address,
                                        double latitude, double longitude, DispatchOrderKind kind, UUID batchId) {
        long nextSequence = nextSequence(bikeId);
        DispatchOrder order = DispatchOrder.createForBatch(
                bikeId, customerName, customerPhone, address, latitude, longitude, nextSequence, kind, batchId);
        return dispatchOrderRepository.save(order);
    }

    private long nextSequence(UUID bikeId) {
        return dispatchOrderRepository
                .findTopByBikeIdAndDeletedAtIsNullOrderBySequenceDesc(bikeId)
                .map(order -> order.getSequence() + 1)
                .orElse(1L);
    }
}
```

- [ ] **Step 2: 컴파일 확인**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/service-ops-api && ./gradlew compileJava -q
```
Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: 커밋**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain && git add development/service-ops-api/src/main/java/com/thundercrew/opsapi/dispatch/service/DispatchOrderCommandService.java && git commit -m "feat(c4): appendForBatch + auto-DONE batch on last delivery complete"
```

---

### Task 4: DispatchRoundService + DispatchRoundResponse

**Files:**
- Create: `.../dispatch/dto/DispatchRoundResponse.java`
- Create: `.../dispatch/service/DispatchRoundService.java`

- [ ] **Step 1: DispatchRoundResponse 작성**

```java
package com.thundercrew.opsapi.dispatch.dto;

import com.thundercrew.opsapi.dispatch.domain.DispatchBatch;
import com.thundercrew.opsapi.dispatch.domain.DispatchBatchStatus;
import java.util.UUID;

/** 현재 유모차 라운드 + 진척. 활성 라운드 없으면 컨트롤러가 204 로 응답. */
public record DispatchRoundResponse(
        UUID batchId,
        DispatchBatchStatus status,
        int pickupTotal,
        int pickupDone,
        int deliveryTotal,
        int deliveryDone
) {
    public static DispatchRoundResponse of(DispatchBatch batch, int pickupTotal, int pickupDone,
                                           int deliveryTotal, int deliveryDone) {
        return new DispatchRoundResponse(
                batch.getId(), batch.getStatus(), pickupTotal, pickupDone, deliveryTotal, deliveryDone);
    }
}
```

- [ ] **Step 2: DispatchRoundService 작성**

```java
package com.thundercrew.opsapi.dispatch.service;

import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import com.thundercrew.opsapi.dispatch.domain.DispatchBatch;
import com.thundercrew.opsapi.dispatch.domain.DispatchBatchStatus;
import com.thundercrew.opsapi.dispatch.domain.DispatchOrder;
import com.thundercrew.opsapi.dispatch.domain.DispatchOrderKind;
import com.thundercrew.opsapi.dispatch.domain.DispatchOrderStatus;
import com.thundercrew.opsapi.dispatch.dto.DispatchBulkApplyRequest;
import com.thundercrew.opsapi.dispatch.dto.DispatchBulkApplyRow;
import com.thundercrew.opsapi.dispatch.dto.DispatchRoundResponse;
import com.thundercrew.opsapi.dispatch.repository.DispatchBatchRepository;
import com.thundercrew.opsapi.dispatch.repository.DispatchOrderRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 유모차 라운드(2단계 배치) 오케스트레이션.
 * 업로드 → 수거(PICKUP) 주문 생성, '배송 시작' → 완료된 수거로부터 배송(DELIVERY) 주문 생성.
 * 활성 단계의 주문만 ASSIGNED 로 존재하도록(배송은 전환 시 생성) 하여 큐/대시보드 쿼리를 단순 유지.
 */
@Service
@Transactional
public class DispatchRoundService {

    private static final List<DispatchBatchStatus> ACTIVE =
            List.of(DispatchBatchStatus.COLLECTING, DispatchBatchStatus.DELIVERING);

    private final DispatchBatchRepository batchRepository;
    private final DispatchOrderRepository orderRepository;
    private final DispatchOrderCommandService commandService;

    public DispatchRoundService(DispatchBatchRepository batchRepository,
                                DispatchOrderRepository orderRepository,
                                DispatchOrderCommandService commandService) {
        this.batchRepository = batchRepository;
        this.orderRepository = orderRepository;
        this.commandService = commandService;
    }

    /** 새 라운드 생성. 동시 활성 라운드는 1개만 허용. 각 행을 PICKUP 주문으로 적재. */
    public DispatchRoundResponse createRound(DispatchBulkApplyRequest request) {
        if (!batchRepository.findByStatusInAndDeletedAtIsNull(ACTIVE).isEmpty()) {
            throw new IllegalStateException("이미 진행 중인 유모차 라운드가 있습니다.");
        }
        DispatchBatch batch = batchRepository.save(DispatchBatch.create());
        for (DispatchBulkApplyRow row : request.rows()) {
            commandService.appendForBatch(row.bikeId(), row.customerName(), row.customerPhone(),
                    row.address(), row.latitude(), row.longitude(), DispatchOrderKind.PICKUP, batch.getId());
        }
        return progress(batch);
    }

    /** 전체 수거 완료 후 배송 단계로 전환. 완료된 수거 각각에서 배송 주문을 생성. */
    public DispatchRoundResponse startDelivery(UUID batchId) {
        DispatchBatch batch = batchRepository.findByIdAndDeletedAtIsNull(batchId)
                .orElseThrow(() -> new ResourceNotFoundException("DispatchBatch", batchId));
        List<DispatchOrder> pickups = orderRepository.findByBatchIdAndKindAndStatusAndDeletedAtIsNull(
                batchId, DispatchOrderKind.PICKUP, DispatchOrderStatus.ASSIGNED);
        if (!pickups.isEmpty()) {
            throw new IllegalStateException("수거가 모두 완료되지 않았습니다. 남은 수거: " + pickups.size());
        }
        // 완료된 수거 = batch 의 PICKUP 전체. 같은 차량/고객/주소로 배송 주문 생성.
        List<DispatchOrder> allPickups = orderRepository.findByBatchIdAndDeletedAtIsNull(batchId).stream()
                .filter(o -> o.getKind() == DispatchOrderKind.PICKUP)
                .toList();
        for (DispatchOrder p : allPickups) {
            commandService.appendForBatch(p.getBikeId(), p.getCustomerName(), p.getCustomerPhone(),
                    p.getAddress(), p.getLatitude(), p.getLongitude(), DispatchOrderKind.DELIVERY, batchId);
        }
        batch.startDelivery();
        return progress(batch);
    }

    @Transactional(readOnly = true)
    public Optional<DispatchRoundResponse> activeRound() {
        return batchRepository.findByStatusInAndDeletedAtIsNull(ACTIVE).stream()
                .findFirst()
                .map(this::progress);
    }

    private DispatchRoundResponse progress(DispatchBatch batch) {
        List<DispatchOrder> orders = orderRepository.findByBatchIdAndDeletedAtIsNull(batch.getId());
        int pickupTotal = (int) orders.stream().filter(o -> o.getKind() == DispatchOrderKind.PICKUP).count();
        int pickupDone = (int) orders.stream()
                .filter(o -> o.getKind() == DispatchOrderKind.PICKUP && o.getStatus() == DispatchOrderStatus.COMPLETED)
                .count();
        int deliveryTotal = (int) orders.stream().filter(o -> o.getKind() == DispatchOrderKind.DELIVERY).count();
        int deliveryDone = (int) orders.stream()
                .filter(o -> o.getKind() == DispatchOrderKind.DELIVERY && o.getStatus() == DispatchOrderStatus.COMPLETED)
                .count();
        return DispatchRoundResponse.of(batch, pickupTotal, pickupDone, deliveryTotal, deliveryDone);
    }
}
```
주의: `findByBatchIdAndDeletedAtIsNull` 는 cancel(soft-delete)된 주문을 제외하므로 진척 분모는 "취소되지 않은" 기준이다.

- [ ] **Step 3: 컴파일 확인**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/service-ops-api && ./gradlew compileJava -q
```
Expected: BUILD SUCCESSFUL.

- [ ] **Step 4: 커밋**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain && git add development/service-ops-api/src/main/java/com/thundercrew/opsapi/dispatch/service/DispatchRoundService.java development/service-ops-api/src/main/java/com/thundercrew/opsapi/dispatch/dto/DispatchRoundResponse.java && git commit -m "feat(c4): DispatchRoundService — createRound/startDelivery/activeRound"
```

---

### Task 5: 컨트롤러 (Batch Read/Command) + ArchUnit allow-list

**Files:**
- Create: `.../dispatch/controller/DispatchBatchReadController.java`
- Create: `.../dispatch/controller/DispatchBatchCommandController.java`
- Modify: `development/service-ops-api/src/test/java/com/thundercrew/opsapi/ArchitectureBoundaryTests.java`

- [ ] **Step 1: DispatchBatchReadController 작성**

```java
package com.thundercrew.opsapi.dispatch.controller;

import com.thundercrew.opsapi.dispatch.dto.DispatchRoundResponse;
import com.thundercrew.opsapi.dispatch.service.DispatchRoundService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/dispatch-batches")
public class DispatchBatchReadController {

    private final DispatchRoundService dispatchRoundService;

    public DispatchBatchReadController(DispatchRoundService dispatchRoundService) {
        this.dispatchRoundService = dispatchRoundService;
    }

    /** 현재 활성 유모차 라운드 + 진척. 없으면 204. */
    @GetMapping("/active")
    ResponseEntity<DispatchRoundResponse> active() {
        return dispatchRoundService.activeRound()
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }
}
```

- [ ] **Step 2: DispatchBatchCommandController 작성**

```java
package com.thundercrew.opsapi.dispatch.controller;

import com.thundercrew.opsapi.dispatch.dto.DispatchBulkApplyRequest;
import com.thundercrew.opsapi.dispatch.dto.DispatchRoundResponse;
import com.thundercrew.opsapi.dispatch.service.DispatchRoundService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/dispatch-batches")
public class DispatchBatchCommandController {

    private final DispatchRoundService dispatchRoundService;

    public DispatchBatchCommandController(DispatchRoundService dispatchRoundService) {
        this.dispatchRoundService = dispatchRoundService;
    }

    /** 새 라운드 생성(프론트 지오코딩 완료 행, JSON). */
    @PostMapping("/round")
    DispatchRoundResponse createRound(@Valid @RequestBody DispatchBulkApplyRequest request) {
        return dispatchRoundService.createRound(request);
    }

    @PostMapping("/{id}/start-delivery")
    DispatchRoundResponse startDelivery(@PathVariable UUID id) {
        return dispatchRoundService.startDelivery(id);
    }
}
```

- [ ] **Step 3: ArchUnit allow-list 등록**

`ArchitectureBoundaryTests.java` 를 읽고, 기존 `isDispatchCommand` predicate(DispatchOrderCommandController owner-keyed) 정의부를 찾아 바로 아래에 동일 패턴으로 추가:
```java
    private static final DescribedPredicate<JavaClass> isDispatchBatchCommand =
            owner("com.thundercrew.opsapi.dispatch.controller.DispatchBatchCommandController");
```
(실제 헬퍼 이름이 `owner(...)`가 아니면 `isDispatchCommand` 가 쓰는 그 헬퍼/형식을 그대로 따른다.) 그런 다음 `isDispatchCommand` 가 OR 로 들어가 있는 **두 규칙**(write-route 예외 `issue_70_..._write_route_exceptions` + @RequestBody 예외 `..._request_body_exceptions`) 각각에 `.or(isDispatchBatchCommand)` 를 추가한다.

- [ ] **Step 4: ArchUnit 테스트 실행 (Docker 불필요)**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/service-ops-api && ./gradlew test --tests "com.thundercrew.opsapi.ArchitectureBoundaryTests" -q
```
Expected: PASS — dispatch-batch 컨트롤러 write/@RequestBody 위반 0.

- [ ] **Step 5: 커밋**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain && git add development/service-ops-api/src/main/java/com/thundercrew/opsapi/dispatch/controller/ development/service-ops-api/src/test/java/com/thundercrew/opsapi/ArchitectureBoundaryTests.java && git commit -m "feat(c4): dispatch-batch read/command controllers + arch allow-list"
```

---

### Task 6: Dashboard — currentDispatchKind + DispatchOrderReadResponse.kind

**Files:**
- Modify: `.../dispatch/dto/DispatchOrderReadResponse.java`
- Modify: `.../dashboard/dto/DashboardMapStateResponse.java`
- Modify: `.../dashboard/service/DashboardMapStateService.java`

- [ ] **Step 1: DispatchOrderReadResponse 에 kind 추가**

`DispatchOrderReadResponse.java` — record 컴포넌트에 `DispatchOrderStatus status,` 다음 줄에 `DispatchOrderKind kind,` 추가(import `DispatchOrderKind`), `from(...)` 의 `order.getStatus(),` 다음에 `order.getKind(),` 추가.

- [ ] **Step 2: Dashboard BikePin 에 currentDispatchKind 추가**

`DashboardMapStateResponse.java` 를 읽고, BikePin 레코드/필드에서 기존 `currentDispatchCustomerName` 옆에 nullable `DispatchOrderKind currentDispatchKind` 필드를 추가한다(기존 currentDispatch* 필드와 동일 위치/직렬화 방식). `DashboardMapStateService.java` 의 `toBikePin`(또는 현재 배차 집계 부분)에서, 현재 배차(최저 sequence ASSIGNED) 주문의 `getKind()` 를 `currentDispatchKind` 로 매핑한다. 현재 배차 없으면 null.

(정확한 필드 형태는 `currentDispatchCustomerName`/`currentDispatchAddress` 가 들어간 줄을 그대로 미러링. enum 직렬화는 Jackson 기본 — 문자열 PICKUP/DELIVERY.)

- [ ] **Step 3: 컴파일 + 관련 테스트**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/service-ops-api && ./gradlew compileJava -q
```
Expected: BUILD SUCCESSFUL.

- [ ] **Step 4: 커밋**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain && git add development/service-ops-api/src/main/java/com/thundercrew/opsapi/dispatch/dto/DispatchOrderReadResponse.java development/service-ops-api/src/main/java/com/thundercrew/opsapi/dashboard/ && git commit -m "feat(c4): expose currentDispatchKind on dashboard + order read response"
```

---

### Task 7: 계약 테스트 (DispatchRoundApiContractTests)

**Files:**
- Create: `development/service-ops-api/src/test/java/com/thundercrew/opsapi/DispatchRoundApiContractTests.java`

- [ ] **Step 1: 계약 테스트 작성**

기존 `DispatchOrderApiContractTests` 를 읽어 동일한 베이스(`PostgresContainerSupport`), 시드(bike plate `서울CC-0001` + bike_current_states), MockMvc/RestAssured 호출 방식을 그대로 따른다. 케이스:
1. **라운드 생성:** `POST /api/v1/dispatch-batches/round` (rows N건, 좌표 포함) → 200, `pickupTotal=N, pickupDone=0, deliveryTotal=0`, status `COLLECTING`. `GET /api/v1/dispatch-orders?bikeId=` → PICKUP N건 ASSIGNED.
2. **동시 라운드 거부:** 활성 라운드 존재 시 두 번째 `/round` → 4xx(IllegalState).
3. **수거 미완료 start-delivery 거부:** `POST /{id}/start-delivery` → 4xx, 메시지에 "수거".
4. **전체 수거 → 전환:** 모든 PICKUP `POST /{orderId}/complete` 후 `/start-delivery` → 200 status `DELIVERING`, `deliveryTotal=N`. 큐에 DELIVERY N건 ASSIGNED.
5. **배송 완료 → DONE:** 모든 DELIVERY complete 후 `GET /active` → 204 (활성 없음; 배치 DONE 으로 빠짐).
6. **dashboard currentDispatchKind:** 라운드 생성 후 `GET /api/v1/dashboard/map-state` → 해당 bike pin `currentDispatchKind == "PICKUP"`.

(4xx 검증은 GlobalExceptionHandler 의 IllegalStateException 매핑을 따른다 — 기존 테스트에서 IllegalState/validation 이 어떤 status 로 매핑되는지 확인해 일치시킬 것.)

- [ ] **Step 2: 컴파일 확인 (Docker 없어 실행 불가 → 컴파일만)**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/service-ops-api && ./gradlew compileTestJava -q
```
Expected: BUILD SUCCESSFUL. (테스트 실행은 Docker 필요 → CI 에서.)

- [ ] **Step 3: 커밋**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain && git add development/service-ops-api/src/test/java/com/thundercrew/opsapi/DispatchRoundApiContractTests.java && git commit -m "test(c4): DispatchRound contract tests (round create/gate/transition/done)"
```

---

### Task 8: 프론트 — 타입 + API 클라이언트 + 정규화 + 서버 액션

**Files:**
- Modify: `development/front-admin-web/lib/services/service-ops-api.ts`
- Modify: `development/front-admin-web/app/dispatch/actions.ts`

- [ ] **Step 1: 타입 + BikePin + 클라이언트 메서드**

`service-ops-api.ts`:
- `ServiceOpsDispatchOrder` 타입에 `kind: "PICKUP" | "DELIVERY"` 필드 추가(백엔드 read response 에 kind 추가됨).
- 신규 타입:
```ts
export type ServiceOpsDispatchOrderKind = "PICKUP" | "DELIVERY";
export type ServiceOpsDispatchRoundStatus = "COLLECTING" | "DELIVERING" | "DONE";
export type ServiceOpsDispatchRound = {
  batchId: string;
  status: ServiceOpsDispatchRoundStatus;
  pickupTotal: number;
  pickupDone: number;
  deliveryTotal: number;
  deliveryDone: number;
};
```
- BikePin raw + Frontend 타입에 `currentDispatchKind?: ServiceOpsDispatchOrderKind | null` 추가, 정규화(`toFrontendDashboardMapState`)에서 `currentDispatchKind: pin.currentDispatchKind ?? null` (기존 currentDispatch* 미러링).
- 클라이언트 메서드 추가(기존 dispatch 메서드 옆):
```ts
    getActiveDispatchRound: () => Promise<ServiceOpsDispatchRound | null>;
    createDispatchRound: (rows: DispatchBulkApplyRow[]) => Promise<ServiceOpsDispatchRound>;
    startDispatchDelivery: (batchId: string) => Promise<ServiceOpsDispatchRound>;
```
구현(factory):
```ts
    getActiveDispatchRound: async () => {
      const res = await rawRequest("/dispatch-batches/active", { method: "GET" });
      if (res.status === 204) return null;
      return (await res.json()) as ServiceOpsDispatchRound;
    },
    createDispatchRound: (rows) =>
      request<ServiceOpsDispatchRound>("/dispatch-batches/round", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows })
      }),
    startDispatchDelivery: (batchId) =>
      request<ServiceOpsDispatchRound>(`/dispatch-batches/${batchId}/start-delivery`, { method: "POST" }),
```
주의: `getActiveDispatchRound` 는 204(빈 본문)를 다뤄야 하므로 `request<T>`(JSON 파싱 가정)가 아닌 저수준 fetch 가 필요하다. 기존 클라이언트에 raw fetch 접근자가 있으면 사용하고, 없으면 `request` 가 204 를 어떻게 처리하는지 확인해 null 반환하도록 맞춘다(구현 디테일은 기존 `cancelDispatchOrder` 가 204 를 어떻게 다루는지 참고 — 그 패턴 재사용).

- [ ] **Step 2: 서버 액션**

`app/dispatch/actions.ts` 에 추가(기존 `applyDispatchAction` 패턴 미러링 — 미리보기/지오코딩은 기존 `previewDispatchAction` 그대로 재사용):
```ts
export async function getActiveRoundAction(): Promise<ServiceOpsDispatchRound | null> {
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: false });
  if (!client) return null;
  return client.getActiveDispatchRound().catch(() => null);
}

export async function createRoundAction(
  rows: DispatchBulkApplyRow[]
): Promise<{ ok: true; round: ServiceOpsDispatchRound } | { ok: false; error: string }> {
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) return { ok: false, error: "로그인이 필요합니다." };
  try {
    const round = await client.createDispatchRound(rows);
    revalidatePath("/management");
    revalidatePath("/");
    return { ok: true, round };
  } catch (err) {
    return { ok: false, error: extractError(err) };
  }
}

export async function startDeliveryAction(
  batchId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) return { ok: false, error: "로그인이 필요합니다." };
  try {
    await client.startDispatchDelivery(batchId);
    revalidatePath("/management");
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: extractError(err) };
  }
}
```
`ServiceOpsDispatchRound` import 추가.

- [ ] **Step 3: 타입체크 + 린트**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web && npm run typecheck && npm run lint
```
Expected: 통과.

- [ ] **Step 4: 커밋**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain && git add development/front-admin-web/lib/services/service-ops-api.ts development/front-admin-web/app/dispatch/actions.ts && git commit -m "feat(c4): frontend round types/client/actions + currentDispatchKind"
```

---

### Task 9: 프론트 — /management 유모차 라운드 섹션 + 큐 수거/배송 라벨

**Files:**
- Create: `development/front-admin-web/components/management/StrollerRoundPanel.tsx`
- Modify: `development/front-admin-web/app/management/page.tsx`
- Modify: `development/front-admin-web/components/management/VehicleDetailDialog.tsx`
- Modify: `development/front-admin-web/app/globals.css`

- [ ] **Step 1: StrollerRoundPanel 작성**

`"use client"` 컴포넌트. props 로 초기 활성 라운드(`ServiceOpsDispatchRound | null`)를 받거나, 마운트 시 `getActiveRoundAction()` 로 로드. 구성:
- 헤더 "유모차 라운드" + 단계 배지: status null→"진행 라운드 없음", COLLECTING→"수거 중", DELIVERING→"배송 중".
- 진척: `수거 {pickupDone}/{pickupTotal}`, `배송 {deliveryDone}/{deliveryTotal}`.
- 업로드: 기존 배차 업로드 UI(ExcelImportButton + 미리보기) 재사용하되 apply 를 `createRoundAction(rows)` 로. (기존 DispatchPanel 의 업로드/미리보기 흐름을 참고해 그대로 따르고, 적용 함수만 교체.)
- `배송 시작` 버튼: `status === "COLLECTING" && pickupTotal > 0 && pickupDone === pickupTotal` 일 때만 enabled. onClick → `startDeliveryAction(batchId)` (useTransition), 성공 시 라운드 재로드, 실패 시 error 표시.

구현은 기존 `components/management/DispatchPanel.tsx`(있다면) / BulkPreviewModal / ExcelImportButton 패턴을 그대로 미러링한다. 새 CSS 클래스는 `globals.css` 에 추가(Step 3).

- [ ] **Step 2: /management 에 섹션 추가**

`app/management/page.tsx` — 기존 배차(DispatchPanel) 섹션 옆/아래에 `<StrollerRoundPanel ... />` 추가. SSR 에서 `getActiveRoundAction()` 로 초기 라운드를 받아 prop 으로 넘기거나, 클라이언트 로드. (page.tsx 가 server component 면 `getActiveRoundAction()` 를 await 해 prop 전달.)

- [ ] **Step 3: 배차 큐에 수거/배송 라벨 + CSS**

`VehicleDetailDialog.tsx` 의 `DispatchOrderRow` 에서 `order.kind` 에 따라 라벨 칩을 표시: `PICKUP`→"수거", `DELIVERY`→"배송". 고객 이름 행 옆 또는 헤더에 작은 배지. (`ServiceOpsDispatchOrder.kind` 사용.) `globals.css` 에 `.dispatch-kind-badge`(+ pickup/delivery 변형)와 `.stroller-round-*` 클래스 추가.

- [ ] **Step 4: 타입체크 + 린트**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web && npm run typecheck && npm run lint
```
Expected: 통과.

- [ ] **Step 5: 커밋**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain && git add development/front-admin-web/components/management/StrollerRoundPanel.tsx development/front-admin-web/app/management/page.tsx development/front-admin-web/components/management/VehicleDetailDialog.tsx development/front-admin-web/app/globals.css && git commit -m "feat(c4): /management stroller-round panel + 수거/배송 queue labels"
```

---

### Task 10: 프론트 — 시동 알림에 수거/배송 라벨

**Files:**
- Modify: `development/front-admin-web/components/layout/NotificationContext.tsx`
- Modify: `development/front-admin-web/components/layout/NotificationBell.tsx`
- Modify: `development/front-admin-web/components/overview/FleetSimulationContext.tsx`

- [ ] **Step 1: IgnitionNotification 에 kind 추가**

`NotificationContext.tsx` — `IgnitionNotification` 타입에 `kind?: "PICKUP" | "DELIVERY"` 추가(주소 필드 옆, optional).

- [ ] **Step 2: 출발 effect 에서 currentDispatchKind 전달**

`FleetSimulationContext.tsx` — 출발 감지 effect 의 `addNotification({...})` 에 `kind: pin?.currentDispatchKind ?? undefined` 추가. (pin 은 `FrontendDashboardBikePin`, currentDispatchKind 필드 Task 8 에서 추가됨.)

- [ ] **Step 3: 벨 표시에 라벨**

`NotificationBell.tsx` — 항목 텍스트에서 고객명 앞/뒤에 kind 라벨을 붙인다: `kind === "PICKUP" ? "수거" : kind === "DELIVERY" ? "배송" : ""`. 예: `🔑 {plate} 출발 ({수거}) → {고객명} ({주소})`. kind 없으면 라벨 생략.

- [ ] **Step 4: 타입체크 + 린트**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web && npm run typecheck && npm run lint
```
Expected: 통과.

- [ ] **Step 5: 커밋**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain && git add development/front-admin-web/components/layout/NotificationContext.tsx development/front-admin-web/components/layout/NotificationBell.tsx development/front-admin-web/components/overview/FleetSimulationContext.tsx && git commit -m "feat(c4): ignition notification shows 수거/배송 kind label"
```

---

### Task 11: 최종 검증 + PR

- [ ] **Step 1: 백엔드 컴파일 + ArchUnit**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/service-ops-api && ./gradlew compileJava compileTestJava && ./gradlew test --tests "com.thundercrew.opsapi.ArchitectureBoundaryTests" -q
```
Expected: BUILD SUCCESSFUL, ArchUnit PASS. (계약 테스트는 Docker 필요 → CI.)

- [ ] **Step 2: 프론트 풀 빌드**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/front-admin-web && npm run typecheck && npm run lint && npm run build
```
Expected: 통과, Next 빌드 성공.

- [ ] **Step 3: 변경 요약 + PR (→ dev)**

```bash
cd /c/Users/user/repositories/clever/thundercrew-domain && git diff dev --stat && git push -u origin cc-c4-stroller-round && gh pr create --base dev --title "Group C4: 유모차 클리닝 (수거→배송 2단계 라운드)" --body "$(cat <<'EOF'
## Summary
- DispatchOrder 확장(kind PICKUP/DELIVERY + batch_id) + 신규 DispatchBatch(라운드 단계) 로 유모차 2단계 배치 흐름 구축 (V34)
- 엑셀 업로드 → 수거 주문 생성 → 전체 수거 완료 → '배송 시작' → 배송 주문 생성 → 전체 배송 완료 → 라운드 DONE
- /management 유모차 라운드 섹션(단계·진척·업로드·배송 시작), 배차 큐 + 시동 알림에 수거/배송 라벨
- 활성 단계만 ASSIGNED 유지 → 대시보드/큐/알림 핫패스 무변경

## 배포 영향
- **V34 마이그레이션 신규** (dispatch_orders ALTER + dispatch_batch) — 재기동 시 Flyway 적용
- 백엔드 + 프론트

## Test Plan
- [x] 백엔드 컴파일 + ArchUnit PASS
- [ ] 계약 테스트(DispatchRoundApiContractTests) — Docker/CI 에서 실행
- [x] 프론트 typecheck/lint/build
- [ ] 프로덕션 QA: 유모차 엑셀 업로드 → 수거 완료 → 배송 시작 → 배송 완료 → 라운드 종료

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

**1. Spec coverage:**
- V34(dispatch_orders ALTER + dispatch_batch) → Task 1. ✓
- DispatchOrder kind/batchId + DispatchBatch(startDelivery/markDone) → Task 1. ✓
- Repository(batch + kind 쿼리) → Task 2. ✓
- createRound/startDelivery(게이트)/activeRound → Task 4; appendForBatch + 자동 DONE → Task 3. ✓
- 컨트롤러 Read/Command + ArchUnit → Task 5. ✓
- currentDispatchKind(대시보드) → Task 6. ✓
- 계약 테스트(생성·게이트·전환·완료·dashboard) → Task 7. ✓
- 프론트 타입/클라이언트/액션 → Task 8. ✓
- /management 라운드 섹션 + 큐 라벨 → Task 9. ✓
- 시동 알림 라벨 → Task 10. ✓
- 동시 라운드 1개 → Task 4 createRound 거부. ✓
- CLEANING serviceType 재사용 → 별도 백엔드 변경 없음(유모차 차량은 CLEANING 으로 등록; 알림은 기존 serviceType==CLEANING 게이트 그대로). ✓

**2. Placeholder scan:** 신규 백엔드 파일은 완전한 코드. 일부 프론트 태스크(Task 8 raw-204 처리, Task 9 업로드 모달 재사용, Task 6 dashboard 필드 위치)는 "기존 X 패턴을 읽고 미러링"으로 위임 — 해당 파일들의 정확한 형태가 코드베이스에 의존하고(예: request<T> 의 204 처리, DashboardMapStateService 의 toBikePin 구조), 구현자가 그 파일을 읽어야 정확하기 때문. 각 위임에는 따를 구체 대상(파일·기존 심볼)을 명시했다. 순수 새 로직(게이트·전환·진척)은 전부 완전 코드로 제공.

**3. Type consistency:** `DispatchOrderKind{PICKUP,DELIVERY}`, `DispatchBatchStatus{COLLECTING,DELIVERING,DONE}`, `DispatchRoundResponse(batchId,status,pickupTotal,pickupDone,deliveryTotal,deliveryDone)`, `appendForBatch(...,kind,batchId)`, `createForBatch(...,kind,batchId)`, repo `findByBatchIdAndKindAndStatusAndDeletedAtIsNull`/`findByBatchIdAndDeletedAtIsNull`/`findByStatusInAndDeletedAtIsNull` — Task 간 일관. 프론트 `ServiceOpsDispatchRound`/`currentDispatchKind`/`createRoundAction`/`startDeliveryAction` 일관.

**구현자 주의:** 백엔드 Task(1–7)는 순차 의존(엔티티→레포→서비스→컨트롤러→대시보드→테스트). 프론트 Task(8–10)는 백엔드 read response 의 `kind` + dashboard `currentDispatchKind` 에 의존하므로 백엔드 이후. Task 6 의 dashboard 변경은 실제 `DashboardMapStateService`/`DashboardMapStateResponse` 구조를 읽고 기존 currentDispatch* 필드를 그대로 미러링할 것.
